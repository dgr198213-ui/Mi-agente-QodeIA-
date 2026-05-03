/**
 * No-Code Specialist - Agente de Diseño Visual de QodeIA
 * Especializado en generación de UI, componentes React/Tailwind y prototipado rápido.
 * v4.0: Impulsado por Gemini Flash Latest por su velocidad y visión.
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';

export interface NoCodeRequest {
  instruction: string;
  componentType?: 'landing' | 'dashboard' | 'form' | 'card' | 'navigation';
  style?: string;
}

export class NoCodeSpecialist {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    const config = {
      ...SPECIALIST_CONFIGS.ceo,
      name: 'No-Code Specialist',
      systemPrompt: `You are the No-Code Specialist for QodeIA.
Powered by Google Gemini Flash Latest.

## Your Role
1. Generate high-quality UI components using React and Tailwind CSS.
2. Design layouts for landings, dashboards, and mobile apps.
3. Convert natural language descriptions into functional code.
4. Suggest UI/UX improvements and modern design patterns.
5. Ensure accessibility and responsiveness in all designs.

## Guidelines
- Use modern Tailwind CSS v4 patterns.
- Focus on clean, modular, and reusable code.
- Provide a preview description of the design.
- Use Lucide-React for icons.

## Output Format
Always wrap the generated code in triple backticks with the language specified (e.g., \`\`\`tsx).

Respond in the same language as the user request.`
    };
    
    this.llm = await createLLMClient(config as any);
    console.log(`✅ No-Code Specialist initialized with Gemini Flash Latest`);
  }

  async processRequest(request: NoCodeRequest) {
    const startTime = Date.now();
    try {
      this.conversationHistory.push({
        role: 'user',
        content: `Instruction: ${request.instruction}\nType: ${request.componentType || 'general'}\nStyle: ${request.style || 'modern/clean'}`
      });

      const result = await generateText({
        model: this.llm,
        system: (SPECIALIST_CONFIGS as any).nocode?.systemPrompt || "You are the No-Code Specialist.",
        messages: this.conversationHistory,
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
      console.error('No-Code Specialist error:', error);
      return {
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime
      };
    }
  }
}

export async function createNoCodeSpecialist(): Promise<NoCodeSpecialist> {
  const specialist = new NoCodeSpecialist();
  await specialist.initialize();
  return specialist;
}
