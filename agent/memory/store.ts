import { supabase } from '@/lib/supabase';

/**
 * Memoria a largo plazo persistente (tabla messages)
 */
export const memoryStore = {
  async addMessage(sessionId: string, role: string, content: string) {
    const { error } = await supabase
      .from('messages')
      .insert({ session_id: sessionId, role, content });

    if (error) {
      logError(`Error guardando mensaje para sesión ${sessionId}`, error);
      throw error;
    }
  },

  async getHistory(sessionId: string, limit = 20) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logError(`Error obteniendo historial para sesión ${sessionId}`, error);
      // En lugar de retornar [] silenciosamente, lanzamos el error
      // para que el llamador decida cómo manejarlo (o al menos se registre)
      throw error;
    }

    return data.reverse();
  }
};

/**
 * Logs a structured error record to the console's error stream.
 *
 * The logged payload includes severity level, module identifier, the provided message,
 * the error's message when `error` is an `Error` (otherwise the raw `error`), and an ISO timestamp.
 *
 * @param message - A human-readable description of the error context
 * @param error - The error object or value to record; if an `Error`, its `message` is logged
 */
function logError(message: string, error: any) {
  console.error(JSON.stringify({
    level: 'error',
    module: 'memory-store',
    message,
    error: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString()
  }));
}
