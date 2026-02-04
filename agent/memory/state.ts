import { supabase } from '@/lib/supabase';

/**
 * Gestión del estado del agente en Supabase
 */
export const agentState = {
  async getState(key: string) {
    const { data, error } = await supabase
      .from('agent_state')
      .select('value')
      .eq('key', key)
      .single();

    if (error) return null;
    return data.value;
  },

  async setState(key: string, value: any) {
    const { error } = await supabase
      .from('agent_state')
      .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) throw error;
  }
};
