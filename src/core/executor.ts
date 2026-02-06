import { supabase } from '../db/supabase.js';
import type { AgentExecution, ExecutionMode } from '../types/index.js';

export async function executePlan(
  planId: string,
  mode: ExecutionMode,
  permissions: any,
  traceId: string
): Promise<AgentExecution> {
  console.log(`[${traceId}] Executing plan ${planId} in mode: ${mode}`);

  const { data: plan } = await supabase
    .from('agent_plans')
    .select('*')
    .eq('plan_id', planId)
    .single();

  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const { data: execution } = await supabase
    .from('agent_executions')
    .insert({ plan_id: planId, status: 'running', mode })
    .select()
    .single();

  try {
    const results = [];
    for (const step of plan.steps) {
      const result = mode === 'dry-run' 
        ? { status: 'simulated', action: step.action }
        : { status: 'success', action: step.action };
      results.push(result);
    }

    const { data: updated } = await supabase
      .from('agent_executions')
      .update({
        status: 'completed',
        result: { steps: results },
        ended_at: new Date().toISOString(),
      })
      .eq('execution_id', execution!.execution_id)
      .select()
      .single();

    return updated as AgentExecution;
  } catch (error: any) {
    await supabase
      .from('agent_executions')
      .update({
        status: 'failed',
        error: error.message,
        ended_at: new Date().toISOString(),
      })
      .eq('execution_id', execution!.execution_id);
    throw error;
  }
}

export async function getExecutionStatus(executionId: string): Promise<AgentExecution | null> {
  const { data } = await supabase
    .from('agent_executions')
    .select('*')
    .eq('execution_id', executionId)
    .single();
  return data;
}
