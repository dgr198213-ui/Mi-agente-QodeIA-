/**
 * Sistema de Memoria Híbrida: Similitud Vectorial + PageRank Structural
 */

import { supabase } from '@/lib/supabase';

export interface MemoryResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  rank_score: number;
  combined_score: number;
  created_at: string;
}

/**
 * Searches memories by combining semantic similarity with structural relevance (PageRank).
 *
 * Validates that `embedding` is a non-empty array of numbers before performing the search.
 *
 * @param embedding - Query embedding; must be a non-empty array of numbers
 * @param options.match_threshold - Minimum semantic similarity score to consider (default: 0.5)
 * @param options.match_count - Maximum number of matches to return (default: 5)
 * @param options.context - Optional context name to restrict the search; use `null` to ignore context
 * @returns An array of `MemoryResult` objects ranked by combined semantic and PageRank relevance; returns an empty array on validation failure or error
 */
export async function searchHybridMemory(
  embedding: number[],
  options: {
    match_threshold?: number;
    match_count?: number;
    context?: string;
  } = {}
): Promise<MemoryResult[]> {
  // 1. Validación de entrada
  if (!Array.isArray(embedding) || embedding.length === 0) {
    logError('Búsqueda híbrida fallida: El embedding debe ser un array no vacío');
    return [];
  }

  // Comúnmente 1536 para OpenAI, pero permitimos flexibilidad si el modelo cambia
  if (embedding.some(n => typeof n !== 'number' || isNaN(n))) {
    logError('Búsqueda híbrida fallida: El embedding contiene valores no numéricos');
    return [];
  }

  const {
    match_threshold = 0.5,
    match_count = 5,
    context
  } = options;

  try {
    // 2. Llamar a la función RPC definida en el esquema SQL
    const { data, error } = await supabase.rpc('match_memory_vectors_ranked', {
      query_embedding: embedding,
      match_threshold,
      match_count,
      target_context_name: context || null
    });

    if (error) {
      logError('Error en RPC de búsqueda híbrida', error);
      throw error;
    }

    return (data || []) as MemoryResult[];
  } catch (error) {
    logError('Error en búsqueda híbrida:', error);
    return [];
  }
}

/**
 * Inserts a memory record with its embedding and registers it as a PageRank node.
 *
 * @param content - The text content of the memory to store.
 * @param embedding - The numeric vector representation associated with the memory.
 * @param metadata - Optional metadata object to store alongside the memory (defaults to `{}`).
 * @returns The inserted memory record returned from the database.
 * @throws When persisting the memory vector fails; node registration failures are logged as warnings but do not prevent the function from returning the inserted memory.
 */
export async function saveMemory(
  content: string,
  embedding: number[],
  metadata: any = {}
) {
  try {
    // 1. Guardar el vector
    const { data: memory, error: memError } = await supabase
      .from('memory_vectors')
      .insert({
        content,
        embedding,
        metadata
      })
      .select()
      .single();

    if (memError) {
      logError('Error insertando vector de memoria', memError);
      throw memError;
    }

    // 2. Registrar como nodo en PageRank
    const { error: nodeError } = await supabase
      .from('agent_nodes')
      .insert({
        node_key: memory.id,
        node_type: 'memory',
        rank_score: 0.1 // Score inicial
      });

    if (nodeError) {
      logWarning('No se pudo registrar la memoria como nodo en PageRank', nodeError);
    }

    return memory;
  } catch (error) {
    logError('Error al guardar memoria:', error);
    throw error;
  }
}

/**
 * Emit a structured error log with module and timestamp.
 *
 * @param message - Human-readable error message to include in the log
 * @param error - Optional error details; if an `Error` object, its `message` is used, otherwise the value is logged as-is
 */
function logError(message: string, error?: any) {
  console.error(JSON.stringify({
    level: 'error',
    module: 'memory-vector',
    message,
    error: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Emits a structured warning log entry for the `memory-vector` module.
 *
 * @param message - Human-readable warning message
 * @param data - Optional additional fields to merge into the log object
 */
function logWarning(message: string, data?: any) {
  console.warn(JSON.stringify({
    level: 'warn',
    module: 'memory-vector',
    message,
    timestamp: new Date().toISOString(),
    ...data
  }));
}
