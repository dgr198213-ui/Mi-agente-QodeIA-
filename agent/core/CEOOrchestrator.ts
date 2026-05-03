/**
 * CEO Orchestrator - Supervisor que coordina todos los especialistas
 * Usa Groq Llama-3.3-70B para orquestación de alto nivel
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from './MultiLLMConfig';
import { createGitHubSpecialist, GitHubSpecialist } from '../specialists/GitHubSpecialist';
import { createSupabaseSpecialist, SupabaseSpecialist } from '../specialists/SupabaseSpecialist';
import { createVercelSpecialist, VercelSpecialist } from '../specialists/VercelSpecialist';
import { createMCPSpecialist, MCPSpecialist } from '../specialists/MCPSpecialist';
import { createLogicSpecialist, LogicSpecialist } from '../specialists/LogicSpecialist';
import { createProValidator, ProValidator } from '../specialists/ProValidator';

export interface CEORequest {
  userMessage: string;
  context?: string;
  sessionId?: string;
}

export interface CEOResponse {
  success: boolean;
  response: string;
  delegatedTasks: DelegatedTask[];
  totalExecutionTime: number;
  tokensUsed?: number;
}

export interface DelegatedTask {
  specialist: string;
  task: string;
  result: string;
  executionTime: number;
}

export interface SpecialistRegistry {
  github: GitHubSpecialist;
  supabase: SupabaseSpecialist;
  vercel: VercelSpecialist;
  mcp: MCPSpecialist;
  logic: LogicSpecialist;
  proValidator: ProValidator;
}

export class CEOOrchestrator {
  private llm: any;
  private specialists: SpecialistRegistry | null = null;
  private conversationHistory: CoreMessage[] = [];
  private delegatedTasks: DelegatedTask[] = [];

  async initialize() {
    const config = SPECIALIST_CONFIGS.ceo;
    this.llm = await createLLMClient(config);
    console.log(`✅ CEO Orchestrator initialized with ${config.provider.toUpperCase()}`);

    // Inicializar especialistas
    await this.initializeSpecialists();
  }

  /**
   * Inicializar todos los especialistas
   */
  private async initializeSpecialists() {
    console.log('\n🚀 Initializing specialist agents...\n');

    try {
      const [github, supabase, vercel, mcp, logic, proValidator] = await Promise.all([
        createGitHubSpecialist(),
        createSupabaseSpecialist(),
        createVercelSpecialist(),
        createMCPSpecialist(),
        createLogicSpecialist(),
        createProValidator()
      ]);

      this.specialists = { github, supabase, vercel, mcp, logic, proValidator };
      console.log('✅ All specialists initialized successfully\n');
    } catch (error) {
      console.error('Error initializing specialists:', error);
      throw error;
    }
  }

  /**
   * Procesar solicitud del usuario
   */
  async processRequest(request: CEORequest): Promise<CEOResponse> {
    const startTime = Date.now();

    if (!this.specialists) {
      throw new Error('CEO Orchestrator not initialized. Call initialize() first.');
    }

    try {
      // Agregar mensaje del usuario al historial
      this.conversationHistory.push({
        role: 'user',
        content: request.userMessage
      });

      // CEO analiza la solicitud y decide qué especialista usar (v3.0)
      const analysisResult = await this.analyzeRequest(request.userMessage);

      // Ejecutar tareas delegadas
      const delegatedTasks = await this.executeDelegatedTasks(analysisResult);
      this.delegatedTasks = delegatedTasks;

      // Generar respuesta final
      const finalResponse = await this.generateFinalResponse(
        request.userMessage,
        delegatedTasks
      );

      // Agregar respuesta al historial
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse
      });

      return {
        success: true,
        response: finalResponse,
        delegatedTasks,
        totalExecutionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('CEO Orchestrator error:', error);
      return {
        success: false,
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        delegatedTasks: [],
        totalExecutionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Analizar solicitud y determinar especialistas necesarios (v3.0)
   */
  private async analyzeRequest(userMessage: string): Promise<SpecialistTask[]> {
    const analysisPrompt = `
You are analyzing a user request to determine which specialist agents should handle it (v3.0).

User request: "${userMessage}"

Analyze and respond with a JSON array of tasks to delegate. Each task should have:
- specialist: 'github' | 'supabase' | 'vercel' | 'mcp' | 'logic' | 'pro_validator'
- task: specific task description for that specialist

Specialist selection rules:
- 'github': Repository operations, code management, PRs, issues
- 'supabase': Database, auth, vector search
- 'vercel': Deployments, environment variables
- 'mcp': Documentation, analysis, NotebookLM
- 'logic': Logical reasoning, mathematical analysis, counting problems (Minimax M2.5)
- 'pro_validator': Critical code validation, architecture review (DeepSeek V4 Pro)

Example response format:
[
  { "specialist": "github", "task": "Create a new repository named 'my-app'" },
  { "specialist": "pro_validator", "task": "Validate the code architecture" }
]

Only include specialists that are actually needed. Respond ONLY with valid JSON array.
`;

    try {
      const result = await generateText({
        model: this.llm,
        system: analysisPrompt,
        messages: [{ role: 'user', content: userMessage }],
        maxSteps: 1,
        temperature: 0.3
      });

      // Parsear respuesta JSON
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      console.error('Error analyzing request:', error);
      return [];
    }
  }

  /**
   * Ejecutar tareas delegadas
   */
  private async executeDelegatedTasks(tasks: SpecialistTask[]): Promise<DelegatedTask[]> {
    const results: DelegatedTask[] = [];

    for (const task of tasks) {
      try {
        let result;

        switch (task.specialist) {
          case 'github':
            result = await this.specialists!.github.processRequest({
              task: task.task
            });
            break;

          case 'supabase':
            result = await this.specialists!.supabase.processRequest({
              task: task.task
            });
            break;

          case 'vercel':
            result = await this.specialists!.vercel.processRequest({
              task: task.task
            });
            break;

          case 'mcp':
            result = await this.specialists!.mcp.processRequest({
              task: task.task
            });
            break;

          case 'logic':
            result = await this.specialists!.logic.processRequest({
              task: task.task,
              requiresStepByStep: true,
              precision: 'high'
            });
            break;

          case 'pro_validator':
            result = await this.specialists!.proValidator.processRequest({
              task: task.task,
              severity: 'critical'
            });
            break;

          default:
            result = { success: false, result: 'Unknown specialist' };
        }

        results.push({
          specialist: task.specialist,
          task: task.task,
          result: result.result,
          executionTime: result.executionTime
        });
      } catch (error) {
        results.push({
          specialist: task.specialist,
          task: task.task,
          result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          executionTime: 0
        });
      }
    }

    return results;
  }

  /**
   * Generar respuesta final del CEO
   */
  private async generateFinalResponse(
    userMessage: string,
    delegatedTasks: DelegatedTask[]
  ): Promise<string> {
    const taskSummary = delegatedTasks
      .map(
        task =>
          `[${task.specialist.toUpperCase()}] ${task.task}\nResult: ${task.result}`
      )
      .join('\n\n');

    const synthesisPrompt = `
You are the QodeIA CEO. Based on the specialist reports below, provide a concise, actionable summary for the user.

User request: "${userMessage}"

Specialist reports:
${taskSummary}

Provide a clear, professional response that:
1. Summarizes what was accomplished
2. Highlights key results
3. Suggests next steps if applicable
4. Uses friendly but professional tone
`;

    try {
      const result = await generateText({
        model: this.llm,
        system: SPECIALIST_CONFIGS.ceo.systemPrompt,
        messages: [{ role: 'user', content: synthesisPrompt }],
        maxSteps: 1,
        temperature: 0.5
      });

      return result.text;
    } catch (error) {
      console.error('Error generating final response:', error);
      return 'Unable to generate response. Please try again.';
    }
  }

  /**
   * Obtener historial de conversación
   */
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Obtener tareas delegadas
   */
  getDelegatedTasks() {
    return [...this.delegatedTasks];
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.conversationHistory = [];
    this.delegatedTasks = [];

    if (this.specialists) {
      this.specialists.github.clearHistory();
      this.specialists.supabase.clearHistory();
      this.specialists.vercel.clearHistory();
      this.specialists.mcp.clearHistory();
    }
  }

  /**
   * Obtener estado del sistema
   */
  getSystemStatus() {
    return {
      initialized: this.specialists !== null,
      specialistsReady: {
        github: !!this.specialists?.github,
        supabase: !!this.specialists?.supabase,
        vercel: !!this.specialists?.vercel,
        mcp: !!this.specialists?.mcp
      },
      conversationHistory: this.conversationHistory.length,
      delegatedTasks: this.delegatedTasks.length
    };
  }

  /**
   * Limpiar recursos
   */
  async cleanup() {
    this.conversationHistory = [];
    this.delegatedTasks = [];
    this.specialists = null;
    console.log('✅ CEO Orchestrator cleaned up');
  }
}

/**
 * Interfaz para tarea delegada (v3.0)
 */
interface SpecialistTask {
  specialist: 'github' | 'supabase' | 'vercel' | 'mcp' | 'logic' | 'pro_validator';
  task: string;
}

/**
 * Factory para crear instancia del CEO
 */
export async function createCEOOrchestrator(): Promise<CEOOrchestrator> {
  const ceo = new CEOOrchestrator();
  await ceo.initialize();
  return ceo;
}

/**
 * Ejemplo de uso
 */
export async function exampleUsage() {
  console.log('🚀 QodeIA Multi-Agent System Example\n');

  const ceo = await createCEOOrchestrator();

  // Ejemplo 1: Tarea simple
  console.log('📝 Example 1: Simple GitHub task\n');
  const response1 = await ceo.processRequest({
    userMessage: 'Create a new GitHub repository called "qodeia-test" with a README',
    sessionId: 'session_1'
  });

  console.log('Response:', response1.response);
  console.log('Execution time:', response1.totalExecutionTime, 'ms\n');

  // Ejemplo 2: Tarea compleja multi-especialista
  console.log('📝 Example 2: Complex multi-specialist task\n');
  const response2 = await ceo.processRequest({
    userMessage: `
      I need to:
      1. Create a new GitHub repo for our new feature
      2. Set up Supabase database schema for user profiles
      3. Deploy to Vercel production
      4. Document the API endpoints
    `,
    sessionId: 'session_2'
  });

  console.log('Response:', response2.response);
  console.log('Delegated tasks:', response2.delegatedTasks.length);
  console.log('Total execution time:', response2.totalExecutionTime, 'ms\n');

  // Limpiar
  await ceo.cleanup();
}
