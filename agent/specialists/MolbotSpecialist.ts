/**
 * Molbot Specialist - Agente de Automatización de QodeIA
 * Especializado en flujos de trabajo, integraciones (Make/Zapier) y tareas repetitivas.
 * v4.0: Impulsado por DeepSeek V4 Flash con Thinking.
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';

export interface MolbotRequest {
  task: string;
  workflowType?: 'automation' | 'integration' | 'scripting' | 'monitoring';
  context?: string;
}

export class MolbotSpecialist {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    // Usamos la configuración de GitHub como base para Molbot por su capacidad de razonamiento de código
    const config = {
      ...SPECIALIST_CONFIGS.github,
      name: 'Molbot Specialist',
      systemPrompt: `You are Molbot, the Automation Specialist for QodeIA.
Powered by DeepSeek V4 Flash with Thinking.

## Your Role
1. Design and implement automation workflows.
2. Integrate external APIs (Make, Zapier, Slack, Discord).
3. Create scripts for repetitive tasks (Node.js, Python, Bash).
4. Monitor system health and deployment status.
5. Automate CI/CD pipelines and GitHub Actions.

## Guidelines
- Focus on efficiency and reliability.
- Use secure practices for API keys and secrets.
- Provide clear documentation for each automation.
- Suggest the best tools for each integration.

## Available Tools (Simulated)
- automation_create_workflow
- automation_list_integrations
- automation_trigger_webhook
- automation_schedule_task

Respond in the same language as the user request.`
    };
    
    this.llm = await createLLMClient(config as any);
    console.log(`✅ Molbot Specialist initialized with DeepSeek V4 Flash`);
  }

  async processRequest(request: MolbotRequest) {
    const startTime = Date.now();
    try {
      this.conversationHistory.push({
        role: 'user',
        content: `Task: ${request.task}\nType: ${request.workflowType || 'general'}\nContext: ${request.context || 'none'}`
      });

      const result = await generateText({
        model: this.llm,
        system: (SPECIALIST_CONFIGS as any).molbot?.systemPrompt || "You are Molbot, the Automation Specialist.",
        messages: this.conversationHistory,
        maxSteps: 5,
      });

      this.conversationHistory.push({
        role: 'assistant',
        content: result.text
      });

      return {
        success: true,
        result: result.text,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Molbot Specialist error:', error);
      return {
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime
      };
    }
  }
}

export async function createMolbotSpecialist(): Promise<MolbotSpecialist> {
  const specialist = new MolbotSpecialist();
  await specialist.initialize();
  return specialist;
}
