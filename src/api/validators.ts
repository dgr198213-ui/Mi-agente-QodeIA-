import { z } from 'zod';

export const planRequestSchema = z.object({
  goal: z.string().min(10).max(1000),
  context: z.object({
    project_id: z.string().uuid(),
    session_id: z.string().uuid(),
    constraints: z.array(z.string()).optional(),
  }),
});

export const executeRequestSchema = z.object({
  plan_id: z.string().uuid(),
  mode: z.enum(['dry-run', 'apply']),
  permissions: z.object({
    can_modify_files: z.boolean().optional(),
    can_execute_code: z.boolean().optional(),
  }).optional(),
});

export const writeMemorySchema = z.object({
  type: z.enum(['decision', 'fact', 'rule', 'note', 'error', 'success']),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional(),
  project_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
});

export const searchMemorySchema = z.object({
  query: z.string().min(1).max(500),
  project_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  threshold: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(50).optional(),
});
