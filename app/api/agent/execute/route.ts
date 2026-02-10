/**
 * Mi-agente-QodeIA/app/api/agent/execute/route.ts
 * 
 * Endpoint principal para ejecutar tareas con contexto CME
 */

import { NextRequest, NextResponse } from 'next/server';
import { Agent } from '@/agent/core/agent';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutos

export async function POST(req: NextRequest) {
  try {
    const { task, projectId, context } = await req.json();

    logger.info('[API] Nueva tarea recibida', {
      type: task.type,
      projectId,
      contextSource: context?.source || 'none',
      contextTokens: context?.tokens || 0
    });

    // Validaciones
    if (!task || !projectId) {
      return NextResponse.json(
        { error: 'Missing task or projectId' },
        { status: 400 }
      );
    }

    // 1. Inicializar agente
    const agent = new Agent({
      projectId,
      // Si viene contexto CME, usarlo directamente
      initialContext: context?.cached ? {
        content: context.content,
        strategy: context.strategy,
        tokens: context.tokens,
        source: 'cme',
        files: context.files
      } : null
    });

    // 2. Ejecutar tarea
    const result = await agent.executeTask({
      type: task.type,
      description: task.description,
      files: task.files || [],
      options: task.options || {}
    });

    logger.info('[API] Tarea completada', {
      status: result.status,
      duration: result.duration,
      toolsUsed: result.toolsUsed?.length || 0
    });

    // 3. Si la tarea generó conocimiento nuevo, sincronizar
    if (result.status === 'completed' && result.learnings) {
      await agent.syncLearningsToMemory(result.learnings);
    }

    return NextResponse.json({
      status: result.status,
      result: result.output,
      metadata: {
        duration: result.duration,
        toolsUsed: result.toolsUsed,
        contextUsed: {
          source: context?.source || 'none',
          strategy: context?.strategy || 'none',
          tokens: context?.tokens || 0
        }
      }
    });

  } catch (error) {
    logger.error('[API] Error ejecutando tarea:', error);

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
 * GET: Obtener estado de una tarea en ejecución
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId' },
        { status: 400 }
      );
    }

    // Consultar estado en Supabase
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      taskId: data.id,
      status: data.status,
      progress: data.progress,
      result: data.result,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    });

  } catch (error) {
    logger.error('[API] Error consultando tarea:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
