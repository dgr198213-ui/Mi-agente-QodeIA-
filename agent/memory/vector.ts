import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

// Cliente de OpenAI para generar embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Genera un embedding vectorial para un texto dado
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Guarda un texto con su embedding en la base de datos
 */
export async function saveMemoryWithEmbedding(
  content: string,
  metadata?: Record<string, any>
): Promise<void> {
  const embedding = await generateEmbedding(content);

  const { error } = await supabase.from('memory_vectors').insert({
    content,
    embedding,
    metadata,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save memory: ${error.message}`);
  }
}

/**
 * Busca memorias similares usando búsqueda vectorial
 * Utiliza la función match_memory_vectors de Supabase
 */
export async function searchSimilarMemories(
  query: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<
  Array<{
    id: string;
    content: string;
    metadata: any;
    similarity: number;
    created_at: string;
  }>
> {
  // Generar embedding de la consulta
  const queryEmbedding = await generateEmbedding(query);

  // Buscar memorias similares usando la función RPC de Supabase
  const { data, error } = await supabase.rpc('match_memory_vectors', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    console.error('Error searching memories:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene las memorias más recientes
 */
export async function getRecentMemories(limit: number = 10) {
  const { data, error } = await supabase
    .from('memory_vectors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get recent memories: ${error.message}`);
  }

  return data || [];
}

/**
 * Elimina memorias antiguas (más de N días)
 */
export async function cleanOldMemories(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { data, error } = await supabase
    .from('memory_vectors')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select();

  if (error) {
    throw new Error(`Failed to clean old memories: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Genera un resumen de conversación y lo guarda como memoria
 */
export async function summarizeAndSaveConversation(
  messages: Array<{ role: string; content: string }>,
  metadata?: Record<string, any>
): Promise<void> {
  // Crear un resumen de la conversación
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  // Generar un resumen usando OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content:
          'Eres un asistente que resume conversaciones de forma concisa y precisa. Extrae los puntos clave y la información importante.',
      },
      {
        role: 'user',
        content: `Resume la siguiente conversación:\n\n${conversationText}`,
      },
    ],
    max_tokens: 500,
  });

  const summary = completion.choices[0].message.content || '';

  // Guardar el resumen como memoria
  await saveMemoryWithEmbedding(summary, {
    ...metadata,
    type: 'conversation_summary',
    message_count: messages.length,
  });
}

/**
 * Recupera contexto relevante para una consulta
 * Combina búsqueda vectorial con memorias recientes
 */
export async function retrieveRelevantContext(
  query: string,
  options: {
    vectorLimit?: number;
    recentLimit?: number;
    threshold?: number;
  } = {}
): Promise<string> {
  const {
    vectorLimit = 3,
    recentLimit = 5,
    threshold = 0.7,
  } = options;

  // Buscar memorias similares
  const similarMemories = await searchSimilarMemories(
    query,
    vectorLimit,
    threshold
  );

  // Obtener memorias recientes
  const recentMemories = await getRecentMemories(recentLimit);

  // Combinar y formatear el contexto
  const context: string[] = [];

  if (similarMemories.length > 0) {
    context.push('## Memorias Relevantes:');
    similarMemories.forEach((mem, idx) => {
      context.push(
        `${idx + 1}. [Similitud: ${mem.similarity.toFixed(2)}] ${mem.content}`
      );
    });
  }

  if (recentMemories.length > 0) {
    context.push('\n## Memorias Recientes:');
    recentMemories.slice(0, 3).forEach((mem, idx) => {
      context.push(`${idx + 1}. ${mem.content}`);
    });
  }

  return context.join('\n');
}
