/**
 * Logic Specialist - Usa Minimax M2.5 (vía OpenRouter)
 * Especializado en razonamiento lógico, matemático y análisis preciso
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';

export interface LogicSpecialistRequest {
  task: string;
  context?: string;
  requiresStepByStep?: boolean;
  precision?: 'high' | 'medium' | 'low';
}

export interface LogicSpecialistResponse {
  success: boolean;
  result: string;
  reasoning?: string;
  executionTime: number;
}

export class LogicSpecialist {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    const config = SPECIALIST_CONFIGS.logic;
    this.llm = await createLLMClient(config);
    console.log(`✅ Logic Specialist initialized with ${config.provider.toUpperCase()} (${config.model})`);
  }

  /**
   * Procesar una solicitud de lógica
   */
  async processRequest(request: LogicSpecialistRequest): Promise<LogicSpecialistResponse> {
    const startTime = Date.now();

    try {
      // Construir mensaje del usuario
      const userMessage = this.buildUserMessage(request);

      // Agregar a historial
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Llamar al LLM con temperatura 0 para máxima precisión
      const result = await generateText({
        model: this.llm,
        system: SPECIALIST_CONFIGS.logic.systemPrompt,
        messages: this.conversationHistory,
        maxSteps: 3,
        temperature: 0.0, // Máxima precisión
      });

      // Agregar respuesta al historial
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
      console.error('Logic Specialist error:', error);
      return {
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Contar ocurrencias de un patrón
   */
  async countOccurrences(text: string, pattern: string) {
    return this.processRequest({
      task: `Count how many times the pattern "${pattern}" appears in the following text:
"${text}"

Provide:
1. The exact count
2. Step-by-step explanation of how you counted
3. Verification of the result`,
      requiresStepByStep: true,
      precision: 'high'
    });
  }

  /**
   * Resolver problema lógico
   */
  async solveLogicProblem(problem: string) {
    return this.processRequest({
      task: `Solve the following logic problem:

${problem}

Provide:
1. Step-by-step reasoning
2. Intermediate conclusions
3. Final answer with verification`,
      requiresStepByStep: true,
      precision: 'high'
    });
  }

  /**
   * Análisis matemático
   */
  async performMathematicalAnalysis(problem: string) {
    return this.processRequest({
      task: `Perform mathematical analysis on:

${problem}

Provide:
1. Problem breakdown
2. Mathematical approach
3. Calculations with steps
4. Final result
5. Verification`,
      requiresStepByStep: true,
      precision: 'high'
    });
  }

  /**
   * Validar consistencia lógica
   */
  async validateLogicalConsistency(statements: string[]) {
    const statementsText = statements.map((s, i) => `${i + 1}. ${s}`).join('\n');
    
    return this.processRequest({
      task: `Validate the logical consistency of the following statements:

${statementsText}

Provide:
1. Analysis of each statement
2. Check for contradictions
3. Logical dependencies
4. Overall consistency assessment
5. Any issues or inconsistencies found`,
      requiresStepByStep: true,
      precision: 'high'
    });
  }

  /**
   * Análisis combinatorio
   */
  async combinatorialAnalysis(problem: string) {
    return this.processRequest({
      task: `Perform combinatorial analysis:

${problem}

Provide:
1. Problem identification
2. Combinatorial approach
3. Calculations
4. Final count/result
5. Verification method`,
      requiresStepByStep: true,
      precision: 'high'
    });
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Obtener historial
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Construir mensaje del usuario
   */
  private buildUserMessage(request: LogicSpecialistRequest): string {
    let message = request.task;

    if (request.context) {
      message += `\n\nContext: ${request.context}`;
    }

    if (request.requiresStepByStep) {
      message += '\n\nIMPORTANT: Provide detailed step-by-step reasoning.';
    }

    if (request.precision === 'high') {
      message += '\n\nPrecision level: HIGH - Double-check all calculations and reasoning.';
    }

    return message;
  }
}

/**
 * Factory para crear instancia del especialista
 */
export async function createLogicSpecialist(): Promise<LogicSpecialist> {
  const specialist = new LogicSpecialist();
  await specialist.initialize();
  return specialist;
}
