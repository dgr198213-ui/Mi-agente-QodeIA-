import { OpenAI } from 'openai';
import { supabase, withRetry } from '../db/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import type { AgentPlan, PlanStep } from '../types/index.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface PlanContext {
  project_id: string;
  session_id: string;
  recent_memory?: string[];
  constraints?: string[];
}

export async function generatePlan(
  goal: string,
  context: PlanContext,
  traceId: string
): Promise<AgentPlan> {
  console.log(`[${traceId}] Generating plan for goal:`, goal);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { 
        role: 'system', 
        content: 'You are a planning agent. Generate detailed, executable plans in JSON format with steps array.'
      },
      { role: 'user', content: goal }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const planData = JSON.parse(completion.choices[0].message.content!);
  const steps: PlanStep[] = planData.steps || [];
  const estimatedRisk = calculateOverallRisk(steps);

  const { data: plan, error } = await withRetry(() =>
    supabase.from('agent_plans').insert({
      session_id: context.session_id,
      goal,
      steps,
      estimated_risk: estimatedRisk,
    }).select().single()
  );

  if (error) throw new Error(`Failed to save plan: ${error.message}`);
  return plan as AgentPlan;
}

function calculateOverallRisk(steps: PlanStep[]): 'low' | 'medium' | 'high' {
  const riskScores = { low: 1, medium: 2, high: 3 };
  const totalScore = steps.reduce((sum, step) => sum + (riskScores[step.risk_level || 'low'] || 1), 0);
  const avgScore = totalScore / steps.length;
  if (avgScore >= 2.5) return 'high';
  if (avgScore >= 1.5) return 'medium';
  return 'low';
}
