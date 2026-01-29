import {
  saveMessage,
  getRecentMessages,
  Message,
} from '@/lib/supabase';
import {
  saveMemoryWithEmbedding,
  summarizeAndSaveConversation,
} from './vector';

/**
 * Clase para gestionar la memoria del agente
 * Implementa un sistema de memoria híbrida:
 * - Memoria corta: últimas N interacciones en memoria RAM
 * - Memoria media: últimas N interacciones en base de datos
 * - Memoria larga: embeddings vectoriales en Supabase
 */
export class MemoryStore {
  private sessionId: string;
  private shortTermMemory: Message[] = [];
  private maxShortTermSize: number;

  constructor(sessionId: string, maxShortTermSize: number = 20) {
    this.sessionId = sessionId;
    this.maxShortTermSize = maxShortTermSize;
  }

  /**
   * Agrega un mensaje a la memoria corta y lo persiste
   */
  async addMessage(role: 'user' | 'assistant' | 'system', content: string) {
    const message: Message = {
      role,
      content,
      session_id: this.sessionId,
      created_at: new Date().toISOString(),
    };

    // Agregar a memoria corta
    this.shortTermMemory.push(message);

    // Mantener el tamaño de la memoria corta
    if (this.shortTermMemory.length > this.maxShortTermSize) {
      this.shortTermMemory.shift();
    }

    // Persistir en base de datos
    try {
      await saveMessage(message);
    } catch (error) {
      console.error('Error saving message:', error);
    }

    return message;
  }

  /**
   * Obtiene la memoria corta actual
   */
  getShortTermMemory(): Message[] {
    return this.shortTermMemory;
  }

  /**
   * Carga la memoria corta desde la base de datos
   */
  async loadShortTermMemory() {
    try {
      const messages = await getRecentMessages(
        this.sessionId,
        this.maxShortTermSize
      );
      this.shortTermMemory = messages;
      return messages;
    } catch (error) {
      console.error('Error loading short term memory:', error);
      return [];
    }
  }

  /**
   * Guarda un hecho importante en la memoria de largo plazo
   */
  async saveToLongTermMemory(
    content: string,
    metadata?: Record<string, any>
  ) {
    try {
      await saveMemoryWithEmbedding(content, {
        ...metadata,
        session_id: this.sessionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error saving to long term memory:', error);
    }
  }

  /**
   * Genera un resumen de la conversación actual y lo guarda
   */
  async summarizeCurrentConversation() {
    if (this.shortTermMemory.length < 5) {
      // No hay suficiente contenido para resumir
      return;
    }

    try {
      await summarizeAndSaveConversation(this.shortTermMemory, {
        session_id: this.sessionId,
      });
    } catch (error) {
      console.error('Error summarizing conversation:', error);
    }
  }

  /**
   * Limpia la memoria corta
   */
  clearShortTermMemory() {
    this.shortTermMemory = [];
  }

  /**
   * Obtiene un resumen de la memoria actual para contexto
   */
  getMemorySummary(): string {
    const messageCount = this.shortTermMemory.length;
    const userMessages = this.shortTermMemory.filter(
      (m) => m.role === 'user'
    ).length;
    const assistantMessages = this.shortTermMemory.filter(
      (m) => m.role === 'assistant'
    ).length;

    return `Memoria actual: ${messageCount} mensajes (${userMessages} del usuario, ${assistantMessages} del asistente)`;
  }

  /**
   * Formatea la memoria corta para incluirla en el prompt
   */
  formatShortTermMemoryForPrompt(): Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }> {
    return this.shortTermMemory.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Guarda un evento importante del agente
   */
  async logAgentEvent(
    eventType: string,
    description: string,
    metadata?: Record<string, any>
  ) {
    const eventMessage = `[EVENTO: ${eventType}] ${description}`;

    await this.addMessage('system', eventMessage);

    // Si es un evento importante, guardarlo en memoria de largo plazo
    if (
      ['task_completed', 'error', 'decision', 'learning'].includes(eventType)
    ) {
      await this.saveToLongTermMemory(eventMessage, {
        ...metadata,
        event_type: eventType,
      });
    }
  }

  /**
   * Obtiene estadísticas de la memoria
   */
  getMemoryStats() {
    return {
      shortTermSize: this.shortTermMemory.length,
      maxShortTermSize: this.maxShortTermSize,
      sessionId: this.sessionId,
      oldestMessage: this.shortTermMemory[0]?.created_at,
      newestMessage:
        this.shortTermMemory[this.shortTermMemory.length - 1]?.created_at,
    };
  }
}

/**
 * Factory function para crear una instancia de MemoryStore
 */
export async function createMemoryStore(
  sessionId: string,
  maxShortTermSize: number = 20
): Promise<MemoryStore> {
  const store = new MemoryStore(sessionId, maxShortTermSize);
  await store.loadShortTermMemory();
  return store;
}
