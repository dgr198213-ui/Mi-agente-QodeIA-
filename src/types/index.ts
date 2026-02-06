export type PermissionAction =
  | 'plan:create'
  | 'plan:read'
  | 'exec:create'
  | 'exec:read'
  | 'memory:write'
  | 'memory:read';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ExecutionMode = 'dry-run' | 'apply';
export type MemoryType = 'decision' | 'fact' | 'rule' | 'note' | 'error' | 'success';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface PlanStep {
  action: string;
  description: string;
  estimated_duration?: string;
  risk_level?: 'low' | 'medium' | 'high';
}

export interface AgentPlan {
  plan_id: string;
  session_id: string;
  goal: string;
  steps: PlanStep[];
  estimated_risk?: string;
  created_at: string;
}

export interface AgentExecution {
  execution_id: string;
  plan_id: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  result?: any;
  error?: string;
  started_at: string;
  ended_at?: string;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  tags: string[];
  project_id: string;
  session_id?: string;
  embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: string;
}

export interface MemorySearchResult {
  memory_id: string;
  content: string;
  type: MemoryType;
  tags: string[];
  similarity: number;
  timestamp: string;
}

export interface LogEntry {
  id: string;
  session_id?: string;
  execution_id?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  trace_id?: string;
  timestamp: string;
}
