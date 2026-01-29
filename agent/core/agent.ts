import { openai } from '@ai-sdk/openai';
import { generateText, streamText, CoreMessage } from 'ai';
import { MemoryStore, createMemoryStore } from '../memory/store';
import {
  getStateManager,
  StateKeys,
  getAgentStateSummary,
  initializeAgentState,
} from '../memory/state';
import { retrieveRelevantContext } from '../memory/vector';
import { getGitHubToolsForAI } from '../tools/github';
import { getSupabaseToolsForAI } from '../tools/supabase';
import { getVercelToolsForAI } from '../tools/vercel';

/**
 * Configuración del agente
 */
export interface AgentConfig {
  sessionId: string;
  model?: string;
  temperature?: number;
  maxSteps?: number;
  enableMemory?: boolean;
  enableTools?: boolean;
}

/**
 * Resultado de la ejecución del agente
 */
export interface AgentResult {
  response: string;
  steps: AgentStep[];
  toolCalls: number;
  memoryUsed: boolean;
  error?: string;
}

/**
 * Paso del agente (para razonamiento)
 */
export interface AgentStep {
  type: 'thinking' | 'tool_call' | 'observation' | 'decision';
  content: string;
  timestamp: string;
  metadata?: any;
}

/**
 * Clase principal del agente autónomo
 * Implementa el ciclo de vida: Pensar → Decidir → Actuar → Guardar Memoria
 */
export class AutonomousAgent {
  private config: AgentConfig;
  private memory: MemoryStore | null = null;
  private stateManager = getStateManager();
  private steps: AgentStep[] = [];
  private tools: Record<string, any> = {};

  constructor(config: AgentConfig) {
    this.config = {
      model: 'gpt-4.1-mini',
      temperature: 0.7,
      maxSteps: 10,
      enableMemory: true,
      enableTools: true,
      ...config,
    };

    // Inicializar herramientas si están habilitadas
    if (this.config.enableTools) {
      this.tools = {
        ...getGitHubToolsForAI(),
        ...getSupabaseToolsForAI(),
        ...getVercelToolsForAI(),
      };
    }
  }

  /**
   * Inicializa el agente y su memoria
   */
  async initialize(): Promise<void> {
    // Inicializar estado del agente si es necesario
    await initializeAgentState();

    // Inicializar memoria si está habilitada
    if (this.config.enableMemory) {
      this.memory = await createMemoryStore(this.config.sessionId);
    }

    this.addStep('thinking', 'Agente inicializado y listo para procesar solicitudes');
  }

  /**
   * Procesa un mensaje del usuario
   */
  async processMessage(userMessage: string): Promise<AgentResult> {
    try {
      // Incrementar contador de mensajes procesados
      await this.stateManager.increment(StateKeys.TOTAL_MESSAGES_PROCESSED);

      // Guardar mensaje del usuario en memoria
      if (this.memory) {
        await this.memory.addMessage('user', userMessage);
      }

      // FASE 1: PENSAR - Analizar el contexto y recuperar memoria relevante
      this.addStep('thinking', 'Analizando solicitud y recuperando contexto relevante...');

      let contextualInfo = '';
      if (this.config.enableMemory) {
        // Recuperar contexto relevante de la memoria de largo plazo
        contextualInfo = await retrieveRelevantContext(userMessage, {
          vectorLimit: 3,
          recentLimit: 5,
        });
      }

      // Obtener resumen del estado del agente
      const stateSummary = await getAgentStateSummary();

      // FASE 2: DECIDIR - Construir el prompt del sistema con contexto
      const systemPrompt = this.buildSystemPrompt(contextualInfo, stateSummary);

      // Obtener historial de conversación
      const conversationHistory = this.memory
        ? this.memory.formatShortTermMemoryForPrompt()
        : [];

      // FASE 3: ACTUAR - Ejecutar el modelo con herramientas
      this.addStep('decision', 'Generando respuesta y ejecutando herramientas si es necesario...');

      const messages: CoreMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      const result = await generateText({
        model: openai(this.config.model!),
        messages,
        tools: this.tools,
        maxSteps: this.config.maxSteps,
        temperature: this.config.temperature,
        onStepFinish: async (step) => {
          // Registrar cada paso del razonamiento
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              this.addStep('tool_call', `Ejecutando herramienta: ${toolCall.toolName}`, {
                toolName: toolCall.toolName,
                args: toolCall.args,
              });
            }
          }

          if (step.toolResults && step.toolResults.length > 0) {
            for (const toolResult of step.toolResults) {
              this.addStep('observation', `Resultado de herramienta: ${toolResult.toolName}`, {
                result: toolResult.result,
              });
            }
          }
        },
      });

      const responseText = result.text;
      const toolCallsCount = result.steps.reduce(
        (acc, step) => acc + (step.toolCalls?.length || 0),
        0
      );

      // FASE 4: GUARDAR MEMORIA - Persistir la respuesta y actualizar estado
      if (this.memory) {
        await this.memory.addMessage('assistant', responseText);

        // Si hubo llamadas a herramientas importantes, guardar en memoria de largo plazo
        if (toolCallsCount > 0) {
          await this.memory.saveToLongTermMemory(
            `Acción realizada: ${responseText.substring(0, 200)}...`,
            {
              tool_calls: toolCallsCount,
              user_query: userMessage.substring(0, 100),
            }
          );
        }

        // Registrar evento en el log del agente
        await this.memory.logAgentEvent('message_processed', 'Mensaje procesado exitosamente', {
          tool_calls: toolCallsCount,
          steps: this.steps.length,
        });
      }

      this.addStep('decision', 'Respuesta generada y memoria actualizada');

      return {
        response: responseText,
        steps: this.steps,
        toolCalls: toolCallsCount,
        memoryUsed: this.config.enableMemory || false,
      };
    } catch (error: any) {
      console.error('Error processing message:', error);

      // Registrar error en el estado
      await this.stateManager.increment(StateKeys.TOTAL_ERRORS);

      if (this.memory) {
        await this.memory.logAgentEvent('error', error.message, {
          stack: error.stack,
        });
      }

      return {
        response: 'Lo siento, ocurrió un error al procesar tu solicitud.',
        steps: this.steps,
        toolCalls: 0,
        memoryUsed: false,
        error: error.message,
      };
    }
  }

  /**
   * Procesa un mensaje con streaming
   */
  async processMessageStream(userMessage: string) {
    try {
      // Incrementar contador de mensajes procesados
      await this.stateManager.increment(StateKeys.TOTAL_MESSAGES_PROCESSED);

      // Guardar mensaje del usuario en memoria
      if (this.memory) {
        await this.memory.addMessage('user', userMessage);
      }

      // Recuperar contexto
      let contextualInfo = '';
      if (this.config.enableMemory) {
        contextualInfo = await retrieveRelevantContext(userMessage);
      }

      const stateSummary = await getAgentStateSummary();
      const systemPrompt = this.buildSystemPrompt(contextualInfo, stateSummary);

      const conversationHistory = this.memory
        ? this.memory.formatShortTermMemoryForPrompt()
        : [];

      const messages: CoreMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      const result = streamText({
        model: openai(this.config.model!),
        messages,
        tools: this.tools,
        maxSteps: this.config.maxSteps,
        temperature: this.config.temperature,
        onFinish: async (event) => {
          // Guardar respuesta en memoria cuando termine
          if (this.memory) {
            await this.memory.addMessage('assistant', event.text);

            const toolCallsCount = event.steps.reduce(
              (acc, step) => acc + (step.toolCalls?.length || 0),
              0
            );

            if (toolCallsCount > 0) {
              await this.memory.saveToLongTermMemory(
                `Acción realizada: ${event.text.substring(0, 200)}...`,
                {
                  tool_calls: toolCallsCount,
                  user_query: userMessage.substring(0, 100),
                }
              );
            }
          }
        },
      });

      return result;
    } catch (error: any) {
      console.error('Error processing message stream:', error);
      throw error;
    }
  }

  /**
   * Construye el prompt del sistema con contexto
   */
  private buildSystemPrompt(contextualInfo: string, stateSummary: string): string {
    return `Eres un agente autónomo altamente capaz que puede:
- Gestionar repositorios de GitHub (leer archivos, crear ramas, hacer commits, abrir PRs)
- Interactuar con bases de datos Supabase (consultar, insertar, actualizar datos)
- Gestionar deployments en Vercel (consultar estado, listar proyectos)
- Mantener memoria de conversaciones pasadas
- Ejecutar tareas de forma autónoma

Tu objetivo es ayudar al usuario de la manera más eficiente posible, utilizando las herramientas disponibles cuando sea necesario.

## Contexto Relevante:
${contextualInfo || 'No hay contexto adicional disponible.'}

## Estado Actual del Agente:
${stateSummary}

## Instrucciones:
1. Analiza cuidadosamente la solicitud del usuario
2. Decide qué herramientas necesitas usar (si alguna)
3. Ejecuta las herramientas en el orden correcto
4. Proporciona una respuesta clara y útil
5. Si modificas código, asegúrate de crear una rama nueva y abrir un PR

Sé proactivo, preciso y siempre explica qué estás haciendo y por qué.`;
  }

  /**
   * Agrega un paso al razonamiento del agente
   */
  private addStep(
    type: AgentStep['type'],
    content: string,
    metadata?: any
  ): void {
    this.steps.push({
      type,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /**
   * Obtiene el historial de pasos del agente
   */
  getSteps(): AgentStep[] {
    return this.steps;
  }

  /**
   * Limpia el historial de pasos
   */
  clearSteps(): void {
    this.steps = [];
  }

  /**
   * Obtiene la memoria del agente
   */
  getMemory(): MemoryStore | null {
    return this.memory;
  }

  /**
   * Ejecuta una tarea autónoma sin intervención del usuario
   */
  async executeAutonomousTask(taskDescription: string): Promise<AgentResult> {
    this.addStep('thinking', `Ejecutando tarea autónoma: ${taskDescription}`);

    const result = await this.processMessage(
      `Ejecuta la siguiente tarea de forma autónoma: ${taskDescription}`
    );

    // Actualizar contador de tareas completadas si fue exitoso
    if (!result.error) {
      await this.stateManager.increment(StateKeys.TOTAL_TASKS_COMPLETED);
    }

    return result;
  }
}

/**
 * Factory function para crear una instancia del agente
 */
export async function createAgent(config: AgentConfig): Promise<AutonomousAgent> {
  const agent = new AutonomousAgent(config);
  await agent.initialize();
  return agent;
}
