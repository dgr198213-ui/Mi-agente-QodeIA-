import { Router, Request, Response } from 'express';
import { generatePlan } from '../core/planner.js';
import { executePlan, getExecutionStatus } from '../core/executor.js';
import { writeMemory, searchMemory, readMemory } from '../core/memory.js';
import { hasPermission } from '../db/supabase.js';
import {
  planRequestSchema,
  executeRequestSchema,
  writeMemorySchema,
  searchMemorySchema,
} from './validators.js';

export const router = Router();

router.get('/status', (req: Request, res: Response) => {
  res.json({
    service: 'mi-agente-qodeia',
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    capabilities: ['planning', 'execution', 'memory-search', 'semantic-search'],
  });
});

router.post('/agent/plan', async (req: Request, res: Response) => {
  try {
    const validatedData = planRequestSchema.parse(req.body);
    const { goal, context } = validatedData;

    const canPlan = await hasPermission(context.session_id, 'plan:create');
    if (!canPlan) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const plan = await generatePlan(goal, context, req.traceId);
    res.json({ success: true, data: plan, trace_id: req.traceId });
  } catch (error: any) {
    res.status(error.name === 'ZodError' ? 400 : 500).json({
      error: 'Failed to generate plan',
      message: error.message,
      trace_id: req.traceId,
    });
  }
});

router.post('/agent/execute', async (req: Request, res: Response) => {
  try {
    const validatedData = executeRequestSchema.parse(req.body);
    const { plan_id, mode, permissions } = validatedData;

    const execution = await executePlan(plan_id, mode, permissions || {}, req.traceId);
    res.json({ success: true, data: execution, trace_id: req.traceId });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to execute plan',
      message: error.message,
      trace_id: req.traceId,
    });
  }
});

router.get('/agent/execution/:id', async (req: Request, res: Response) => {
  try {
    const execution = await getExecutionStatus(req.params.id);
    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }
    res.json({ success: true, data: execution });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/memory/write', async (req: Request, res: Response) => {
  try {
    const validatedData = writeMemorySchema.parse(req.body);
    const memory = await writeMemory(validatedData, req.traceId);
    res.json({ success: true, data: memory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/memory/search', async (req: Request, res: Response) => {
  try {
    const validatedData = searchMemorySchema.parse(req.body);
    const results = await searchMemory(validatedData, req.traceId);
    res.json({ success: true, data: { results } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/memory/read', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id as string;
    const memories = await readMemory(projectId);
    res.json({ success: true, data: { memories } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
