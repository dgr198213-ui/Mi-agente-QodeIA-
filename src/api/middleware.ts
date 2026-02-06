import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../db/supabase.js';
import { v4 as uuidv4 } from 'uuid';

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.traceId = uuidv4();
  res.setHeader('X-Trace-ID', req.traceId);
  next();
}

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const action = `${req.method}:${req.path}`;
  const allowed = await checkRateLimit(userId, action, 10);

  if (!allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retry_after: 60,
    });
    return;
  }

  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.userId = payload.sub;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  console.error(`[${req.traceId}] Error:`, error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    trace_id: req.traceId,
  });
}

declare global {
  namespace Express {
    interface Request {
      traceId: string;
      userId?: string;
    }
  }
}
