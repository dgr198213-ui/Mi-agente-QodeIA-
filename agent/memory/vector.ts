/**
 * Sistema de Memoria Híbrida: Similitud Vectorial + PageRank Structural
 */

import { supabase } from '@/lib/supabase';

/**
 * Función de logging consistente con el resto del ecosistema
 */
function logError(message: string, error: any) {
  console.error(JSON.stringify({
    level: 'error',
    module: 'agent-memory-vector',
    message,
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  }));
}

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
 * Recupera memorias usando una combinación de similitud semántica y relevancia estructural (PageRank).
 *
 * @param embedding Vector de consulta (1536 dimensiones)
 * @param options Opciones de búsqueda
 * @returns Lista de memorias rankeadas
 */
export async function searchHybridMemory(
  embedding: number[],
  options: {
    match_threshold?: number;
    match_count?: number;
    context?: string;
  } = {}
): Promise<MemoryResult[]> {
  const {
    match_threshold = 0.5,
    match_count = 5,
    context
  } = options;

  // Validar que el embedding contenga solo números finitos
  if (embedding.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
    logError('Búsqueda híbrida fallida: El embedding contiene valores no numéricos o no finitos', { invalidValues: embedding.filter(n => typeof n !== 'number' || !Number.isFinite(n)) });
    return [];
  }

  try {
    // Llamar a la función RPC definida en el esquema SQL
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
 * Guarda una nueva memoria y la registra como nodo en el sistema de gobernanza.
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

    if (memError) throw memError;

    // 2. Registrar como nodo en PageRank
    const { error: nodeError } = await supabase
      .from('agent_nodes')
      .insert({
        node_key: memory.id,
        node_type: 'memory',
        rank_score: 0.1 // Score inicial
      });

    if (nodeError) {
      console.warn('[Memory] No se pudo registrar la memoria como nodo:', nodeError);
    }

    return memory;
  } catch (error) {
    console.error('[Memory] Error al guardar memoria:', error);
    throw error;
  }
}
