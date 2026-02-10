import express from 'express';
import { router } from './api/routes.js';
import {
  traceMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  errorHandler,
} from './api/middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(traceMiddleware);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Public routes
app.get('/status', router);
app.get('/health', router);

// Protected routes
app.use('/agent', authMiddleware, rateLimitMiddleware, router);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Agent service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
