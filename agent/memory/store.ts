import { supabase } from '@/lib/supabase';

/**
 * Memoria a largo plazo persistente (tabla messages)
 */
export const memoryStore = {
  async addMessage(sessionId: string, role: string, content: string) {
    const { error } = await supabase
      .from('messages')
      .insert({ session_id: sessionId, role, content });

    if (error) throw error;
  },

  async getHistory(sessionId: string, limit = 20) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data.reverse();
  }
};
