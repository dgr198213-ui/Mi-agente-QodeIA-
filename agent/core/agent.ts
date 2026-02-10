/**
 * Mi-agente-QodeIA/agent/core/agent.ts
 * 
 * MODIFICACIÓN: Priorizar contexto CME cuando está disponible
 */

import { openai } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { tools } from '../tools';

interface AgentConfig {
  projectId: string;
  conversationId?: string;
  initialContext?: {
    content: string;
    strategy: string;
    tokens: number;
    source: 'cme' | 'pgvector' | 'none';
    files?: number;
  };
}

interface ExecuteTaskOptions {
  type: string;
  description: string;
  files?: string[];
  options?: Record<string, any>;
}

export class Agent {
  private projectId: string;
  private conversationId?: string;
  private context: AgentConfig['initialContext'] | null;
  private conversationHistory: any[] = [];

  constructor(config: AgentConfig) {
    this.projectId = config.projectId;
    this.conversationId = config.conversationId;
    this.context = config.initialContext || null;

    logger.info('[Agent] Inicializado', {
      projectId: this.projectId,
      contextSource: this.context?.source || 'none',
      contextTokens: this.context?.tokens || 0
    });
  }

  /**
   * Ejecuta una tarea con razonamiento y herramientas
   */
  async executeTask(task: ExecuteTaskOptions) {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    try {
      logger.info('[Agent] Ejecutando tarea', { type: task.type });

      // 1. Obtener contexto (CME o fallback a pgvector)
      const projectContext = await this._getProjectContext(task.description);

      // 2. Construir system prompt
      const systemPrompt = this._buildSystemPrompt(projectContext);

      // 3. Construir user prompt
      const userPrompt = this._buildTaskPrompt(task);

      // 4. Ejecutar con herramientas
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        tools: tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }
        })),
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 4096
      });

      const message = response.choices[0].message;

      // 5. Ejecutar herramientas si el modelo las solicita
      let finalResponse = message.content;
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolResults = [];

        for (const toolCall of message.tool_calls) {
          const tool = tools.find(t => t.name === toolCall.function.name);
          
          if (tool) {
            logger.info(`[Agent] Ejecutando herramienta: ${tool.name}`);
            toolsUsed.push(tool.name);

            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await tool.execute(args, {
                projectId: this.projectId,
                userId: 'default' // TODO: obtener del auth
              });

              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: JSON.stringify(result)
              });

            } catch (toolError) {
              logger.error(`[Agent] Error en herramienta ${tool.name}:`, toolError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: JSON.stringify({ error: toolError.message })
              });
            }
          }
        }

        // 6. Segundo round con resultados de herramientas
        if (toolResults.length > 0) {
          const secondResponse = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
              ...messages,
              message,
              ...toolResults
            ],
            temperature: 0.1,
            max_tokens: 4096
          });

          finalResponse = secondResponse.choices[0].message.content;
        }
      }

      // 7. Guardar en memoria
      await this._saveToMemory({
        task: task.description,
        response: finalResponse,
        toolsUsed
      });

      const duration = Date.now() - startTime;

      return {
        status: 'completed',
        output: finalResponse,
        duration,
        toolsUsed,
        learnings: this._extractLearnings(finalResponse)
      };

    } catch (error) {
      logger.error('[Agent] Error ejecutando tarea:', error);
      
      return {
        status: 'error',
        error: error.message,
        duration: Date.now() - startTime,
        toolsUsed
      };
    }
  }

  /**
   * Chat conversacional con streaming
   */
  async chat(message: string, options: { onChunk?: Function; stream?: boolean } = {}) {
    try {
      logger.info('[Agent] Chat message recibido');

      // 1. Obtener contexto
      const projectContext = await this._getProjectContext(message);

      // 2. Construir mensajes
      const systemPrompt = this._buildSystemPrompt(projectContext);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory,
        { role: 'user', content: message }
      ];

      // 3. Streaming
      if (options.stream && options.onChunk) {
        const stream = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048
        });

        let fullResponse = '';

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          
          if (content) {
            fullResponse += content;
            options.onChunk({
              type: 'chunk',
              content
            });
          }
        }

        // Actualizar historial
        this.conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: fullResponse }
        );

        // Guardar en Supabase
        await this._saveToMemory({
          task: message,
          response: fullResponse,
          toolsUsed: []
        });

        return fullResponse;

      } else {
        // Sin streaming
        const response = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages,
          temperature: 0.7,
          max_tokens: 2048
        });

        const content = response.choices[0].message.content;

        this.conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: content }
        );

        await this._saveToMemory({
          task: message,
          response: content,
          toolsUsed: []
        });

        return content;
      }

    } catch (error) {
      logger.error('[Agent] Error en chat:', error);
      throw error;
    }
  }

  /**
   * CLAVE: Priorizar CME sobre pgvector
   */
  private async _getProjectContext(query: string): Promise<string> {
    // 1. Si ya tenemos contexto CME, usarlo directamente
    if (this.context && this.context.source === 'cme') {
      logger.info('[Agent] Usando contexto CME', {
        strategy: this.context.strategy,
        tokens: this.context.tokens
      });
      return this.context.content;
    }

    // 2. Fallback: búsqueda vectorial en Supabase
    logger.info('[Agent] CME no disponible, usando pgvector');

    try {
      // Generar embedding del query
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Búsqueda en pgvector
      const { data, error } = await supabase.rpc('match_memory_vectors', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 10,
        p_project_id: this.projectId
      });

      if (error) {
        logger.error('[Agent] Error en búsqueda vectorial:', error);
        return '';
      }

      if (!data || data.length === 0) {
        logger.warn('[Agent] No se encontró contexto en pgvector');
        return '';
      }

      // Construir contexto desde resultados
      const context = data.map((item: any) => item.content).join('\n\n');

      logger.info('[Agent] Contexto recuperado de pgvector', {
        results: data.length,
        tokens: Math.ceil(context.length / 4)
      });

      return context;

    } catch (error) {
      logger.error('[Agent] Error recuperando contexto:', error);
      return '';
    }
  }

  private _buildSystemPrompt(projectContext: string): string {
    return `Eres un agente de desarrollo autónomo para el proyecto "${this.projectId}".

${projectContext ? `## Contexto del Proyecto\n${projectContext}\n\n` : ''}

## Capacidades
- Puedes leer y modificar archivos usando las herramientas disponibles
- Puedes crear branches, commits y pull requests en GitHub
- Puedes consultar y modificar datos en Supabase
- Puedes gestionar deployments en Vercel

## Directrices
1. Sé preciso y directo en tus respuestas
2. Siempre valida antes de modificar código
3. Explica tus decisiones técnicas
4. Si necesitas más información, pregunta
5. Usa las herramientas disponibles cuando sea apropiado`;
  }

  private _buildTaskPrompt(task: ExecuteTaskOptions): string {
    let prompt = `Tarea: ${task.description}\n\n`;

    if (task.files && task.files.length > 0) {
      prompt += `Archivos involucrados:\n${task.files.map(f => `- ${f}`).join('\n')}\n\n`;
    }

    if (task.options && Object.keys(task.options).length > 0) {
      prompt += `Opciones:\n${JSON.stringify(task.options, null, 2)}\n\n`;
    }

    prompt += 'Por favor, ejecuta esta tarea y proporciona un informe detallado.';

    return prompt;
  }

  private async _saveToMemory(interaction: {
    task: string;
    response: string;
    toolsUsed: string[];
  }) {
    try {
      // Guardar mensaje en tabla messages
      await supabase.from('messages').insert({
        conversation_id: this.conversationId || this.projectId,
        project_id: this.projectId,
        role: 'user',
        content: interaction.task,
        metadata: {
          tools_used: interaction.toolsUsed
        }
      });

      await supabase.from('messages').insert({
        conversation_id: this.conversationId || this.projectId,
        project_id: this.projectId,
        role: 'assistant',
        content: interaction.response,
        metadata: {
          tools_used: interaction.toolsUsed
        }
      });

    } catch (error) {
      logger.error('[Agent] Error guardando en memoria:', error);
    }
  }

  private _extractLearnings(response: string): any[] {
    // TODO: Implementar extracción de learnings
    // Por ahora retornamos vacío
    return [];
  }

  async syncLearningsToMemory(learnings: any[]) {
    // TODO: Implementar sincronización de learnings
    logger.info('[Agent] Sincronizando learnings:', learnings.length);
  }
}
