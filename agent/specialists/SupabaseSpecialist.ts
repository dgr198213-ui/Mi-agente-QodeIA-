/**
 * Supabase Specialist - Usa Gemini 2.5 Flash
 * Especializado en base de datos, autenticación, búsqueda vectorial
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';
import { supabaseTools } from '../tools/supabase';

export interface SupabaseSpecialistRequest {
  task: string;
  context?: string;
  table?: string;
  query?: Record<string, any>;
}

export interface SupabaseSpecialistResponse {
  success: boolean;
  result: string;
  data?: any;
  toolsUsed: string[];
  executionTime: number;
}

export class SupabaseSpecialist {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    const config = SPECIALIST_CONFIGS.supabase;
    this.llm = await createLLMClient(config);
    console.log(`✅ Supabase Specialist initialized with ${config.provider.toUpperCase()}`);
  }

  /**
   * Procesar una solicitud de Supabase
   */
  async processRequest(request: SupabaseSpecialistRequest): Promise<SupabaseSpecialistResponse> {
    const startTime = Date.now();

    try {
      // Construir mensaje del usuario
      const userMessage = this.buildUserMessage(request);

      // Agregar a historial
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Llamar al LLM con herramientas de Supabase
      const result = await generateText({
        model: this.llm,
        system: SPECIALIST_CONFIGS.supabase.systemPrompt,
        messages: this.conversationHistory,
        tools: supabaseTools,
        maxSteps: 5,
        temperature: SPECIALIST_CONFIGS.supabase.temperature,
      });

      // Procesar resultado
      const toolsUsed = result.toolCalls?.map(tc => tc.toolName) || [];

      // Agregar respuesta al historial
      this.conversationHistory.push({
        role: 'assistant',
        content: result.text
      });

      return {
        success: true,
        result: result.text,
        toolsUsed,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Supabase Specialist error:', error);
      return {
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsUsed: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Consultar tabla
   */
  async queryTable(table: string, filters?: Record<string, any>, limit: number = 10) {
    return this.processRequest({
      task: `Query the ${table} table with the following criteria:
        - Filters: ${JSON.stringify(filters || {})}
        - Limit: ${limit}
        - Return formatted results`,
      table,
      query: filters
    });
  }

  /**
   * Insertar datos
   */
  async insertData(table: string, data: Record<string, any>) {
    return this.processRequest({
      task: `Insert data into the ${table} table:
        - Data: ${JSON.stringify(data)}
        - Validate data types
        - Return inserted record with ID`,
      table
    });
  }

  /**
   * Actualizar datos
   */
  async updateData(table: string, filters: Record<string, any>, updates: Record<string, any>) {
    return this.processRequest({
      task: `Update records in ${table} table:
        - Filters: ${JSON.stringify(filters)}
        - Updates: ${JSON.stringify(updates)}
        - Return updated records count`,
      table,
      query: filters
    });
  }

  /**
   * Búsqueda vectorial
   */
  async vectorSearch(query: string, table: string = 'documents', topK: number = 5) {
    return this.processRequest({
      task: `Perform semantic vector search:
        - Query: ${query}
        - Table: ${table}
        - Top K results: ${topK}
        - Return results with similarity scores`,
      table
    });
  }

  /**
   * Crear embedding
   */
  async createEmbedding(text: string) {
    return this.processRequest({
      task: `Create an embedding for the following text and store in pgvector:
        - Text: ${text}
        - Model: text-embedding-3-small
        - Store in embeddings table`
    });
  }

  /**
   * Obtener información de usuario
   */
  async getUserInfo(email: string) {
    return this.processRequest({
      task: `Get authentication and profile information for user:
        - Email: ${email}
        - Include auth metadata
        - Include profile data if available`
    });
  }

  /**
   * Listar tablas
   */
  async listTables() {
    return this.processRequest({
      task: 'List all tables in the Supabase database with their schemas and row counts'
    });
  }

  /**
   * Análisis de datos
   */
  async analyzeData(table: string, analysis: string) {
    return this.processRequest({
      task: `Analyze data in ${table} table:
        - Analysis type: ${analysis}
        - Provide insights and statistics
        - Suggest optimizations if applicable`,
      table
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
  private buildUserMessage(request: SupabaseSpecialistRequest): string {
    let message = request.task;

    if (request.context) {
      message += `\n\nContext: ${request.context}`;
    }

    if (request.table) {
      message += `\nTable: ${request.table}`;
    }

    if (request.query) {
      message += `\nQuery parameters: ${JSON.stringify(request.query)}`;
    }

    return message;
  }
}

/**
 * Factory para crear instancia del especialista
 */
export async function createSupabaseSpecialist(): Promise<SupabaseSpecialist> {
  const specialist = new SupabaseSpecialist();
  await specialist.initialize();
  return specialist;
}
