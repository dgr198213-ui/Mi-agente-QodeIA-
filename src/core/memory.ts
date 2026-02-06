import { OpenAI } from 'openai';
import { supabase, withRetry } from '../db/supabase.js';
import type { MemoryEntry, MemoryType, MemorySearchResult } from '../types/index.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface WriteMemoryParams {
  type: MemoryType;
  content: string;
  tags?: string[];
  project_id: string;
  session_id?: string;
}

export async function writeMemory(params: WriteMemoryParams, traceId: string): Promise<MemoryEntry> {
  const { data: memory, error } = await withRetry(async () => {
    const result = await supabase.from('agent_memory').insert({
      type: params.type,
      content: params.content,
      tags: params.tags || [],
      project_id: params.project_id,
      session_id: params.session_id,
      embedding_status: 'pending',
    }).select().single();
    return result;
  }) as any;

  if (error) throw new Error(`Failed to write memory: ${error.message}`);
  return memory as MemoryEntry;
}

export async function searchMemory(params: any, traceId: string): Promise<MemorySearchResult[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: params.query,
  });

  const queryEmbedding = response.data[0].embedding;

  const { data, error } = await supabase.rpc('search_memory', {
    query_embedding: queryEmbedding,
    match_threshold: params.threshold || 0.7,
    match_count: params.limit || 10,
    filter_project: params.project_id || null,
    filter_tags: params.tags || null,
  });

  if (error) throw new Error(`Memory search failed: ${error.message}`);
  return (data || []) as MemorySearchResult[];
}

export async function readMemory(projectId: string, filters?: any): Promise<MemoryEntry[]> {
  let query = supabase
    .from('agent_memory')
    .select('*')
    .eq('project_id', projectId)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (filters?.tags) query = query.contains('tags', filters.tags);
  if (filters?.type) query = query.eq('type', filters.type);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to read memory: ${error.message}`);
  return (data || []) as MemoryEntry[];
}
