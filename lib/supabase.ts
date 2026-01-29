import { createClient } from '@supabase/supabase-js';

// Validar que las variables de entorno estén configuradas
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

// Cliente de Supabase con Service Role Key para operaciones del servidor
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Tipos para las tablas de la base de datos
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  session_id?: string;
}

export interface AgentState {
  id?: string;
  key: string;
  value: any;
  updated_at?: string;
}

export interface Task {
  id?: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  created_at?: string;
  completed_at?: string;
  metadata?: any;
}

export interface MemoryVector {
  id?: string;
  content: string;
  embedding: number[];
  metadata?: any;
  created_at?: string;
}

// Funciones auxiliares para interactuar con la base de datos

/**
 * Guarda un mensaje en la base de datos
 */
export async function saveMessage(message: Message) {
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtiene los últimos N mensajes de una sesión
 */
export async function getRecentMessages(sessionId: string, limit = 20) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data?.reverse() || [];
}

/**
 * Guarda o actualiza el estado del agente
 */
export async function saveAgentState(key: string, value: any) {
  const { data, error } = await supabase
    .from('agent_state')
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtiene el estado del agente por clave
 */
export async function getAgentState(key: string) {
  const { data, error } = await supabase
    .from('agent_state')
    .select('*')
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Crea una nueva tarea
 */
export async function createTask(task: Omit<Task, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza el estado de una tarea
 */
export async function updateTaskStatus(
  id: string,
  status: Task['status'],
  completedAt?: string
) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status, completed_at: completedAt })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtiene tareas pendientes ordenadas por prioridad
 */
export async function getPendingTasks(limit = 10) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['pending', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
