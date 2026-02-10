/**
 * Mi-agente-QodeIA/app/api/agent/sync/route.ts
 * 
 * Sincroniza proyecto desde Howard OS al agente
 * Crea índice en memoria vectorial (L2 cache)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { embeddings } from '@/lib/openai';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { projectId, metadata, stats, fileIndex } = await req.json();

    logger.info('[Sync] Sincronizando proyecto', {
      projectId,
      files: fileIndex?.length || 0,
      tokens: stats?.tokens || 0
    });

    // Validaciones
    if (!projectId || !fileIndex) {
      return NextResponse.json(
        { error: 'Missing projectId or fileIndex' },
        { status: 400 }
      );
    }

    // 1. Guardar metadata del proyecto
    const { error: projectError } = await supabase
      .from('projects')
      .upsert({
        id: projectId,
        name: metadata.name || projectId,
        metadata: {
          ...metadata,
          cme_stats: stats,
          file_count: fileIndex.length,
          synced_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });

    if (projectError) {
      throw new Error(`Error guardando proyecto: ${projectError.message}`);
    }

    // 2. Crear embeddings del índice de archivos
    // Esto permite búsqueda semántica cuando CME no está disponible
    const embeddingsToInsert = [];

    for (const file of fileIndex) {
      // Crear descripción del archivo para embedding
      const description = `File: ${file.path}
Language: ${file.language}
Size: ${file.size} bytes
Hash: ${file.hash}`;

      try {
        // Generar embedding
        const embedding = await embeddings.create({
          input: description,
          model: 'text-embedding-3-small'
        });

        embeddingsToInsert.push({
          project_id: projectId,
          content: description,
          metadata: {
            type: 'file_index',
            path: file.path,
            language: file.language,
            size: file.size,
            hash: file.hash
          },
          embedding: embedding.data[0].embedding
        });

      } catch (embError) {
        logger.warn(`[Sync] Error generando embedding para ${file.path}:`, embError);
        // Continuar con los demás archivos
      }
    }

    // 3. Guardar embeddings en Supabase
    if (embeddingsToInsert.length > 0) {
      const { error: embError } = await supabase
        .from('memory_vectors')
        .upsert(embeddingsToInsert);

      if (embError) {
        logger.error('[Sync] Error guardando embeddings:', embError);
        // No lanzar error, continuar
      }
    }

    // 4. Actualizar estado del agente
    const { error: stateError } = await supabase
      .from('agent_state')
      .upsert({
        project_id: projectId,
        state: {
          projects_loaded: [projectId],
          last_sync: new Date().toISOString(),
          file_count: fileIndex.length,
          embeddings_count: embeddingsToInsert.length
        },
        updated_at: new Date().toISOString()
      });

    if (stateError) {
      logger.warn('[Sync] Error actualizando estado del agente:', stateError);
    }

    logger.info('[Sync] Proyecto sincronizado exitosamente', {
      projectId,
      embeddings: embeddingsToInsert.length
    });

    return NextResponse.json({
      status: 'success',
      projectId,
      stats: {
        files: fileIndex.length,
        embeddings: embeddingsToInsert.length,
        tokens: stats?.tokens || 0
      },
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Sync] Error sincronizando proyecto:', error);

    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Obtener estado de sincronización de un proyecto
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId' },
        { status: 400 }
      );
    }

    // Consultar estado
    const { data, error } = await supabase
      .from('agent_state')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { 
          synced: false,
          message: 'Project not synced'
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      synced: true,
      projectId,
      state: data.state,
      syncedAt: data.state.last_sync,
      updatedAt: data.updated_at
    });

  } catch (error) {
    logger.error('[Sync] Error consultando estado:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
