import { NextRequest } from 'next/server';
import { createAgent } from '@/agent/core/agent';
import { v4 as uuidv4 } from 'uuid';

/**
 * Endpoint principal del agente autónomo
 * POST /api/agent
 * 
 * Acepta mensajes del usuario y retorna respuestas del agente
 * Soporta tanto respuestas completas como streaming
 */

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 segundos para operaciones largas

/**
 * POST /api/agent
 * Procesa un mensaje del usuario y retorna la respuesta del agente
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, stream = false, config = {} } = body;

    // Validar mensaje
    if (!message || typeof message !== 'string') {
      return Response.json(
        { error: 'El campo "message" es requerido y debe ser un string' },
        { status: 400 }
      );
    }

    // Generar o usar sessionId existente
    const effectiveSessionId = sessionId || uuidv4();

    // Crear instancia del agente
    const agent = await createAgent({
      sessionId: effectiveSessionId,
      model: config.model || 'gpt-4.1-mini',
      temperature: config.temperature || 0.7,
      maxSteps: config.maxSteps || 10,
      enableMemory: config.enableMemory !== false,
      enableTools: config.enableTools !== false,
    });

    // Si se solicita streaming
    if (stream) {
      const result = await agent.processMessageStream(message);

      // Retornar stream
      return result.toDataStreamResponse();
    }

    // Procesar mensaje sin streaming
    const result = await agent.processMessage(message);

    // Retornar respuesta completa
    return Response.json({
      success: true,
      sessionId: effectiveSessionId,
      response: result.response,
      steps: result.steps,
      toolCalls: result.toolCalls,
      memoryUsed: result.memoryUsed,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Error in agent endpoint:', error);

    return Response.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent
 * Retorna información sobre el estado del agente
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return Response.json(
        {
          success: true,
          message: 'Agente autónomo operativo',
          version: '1.0.0',
          capabilities: [
            'GitHub repository management',
            'Supabase database operations',
            'Vercel deployment management',
            'Long-term memory with vector embeddings',
            'Autonomous task execution',
          ],
        },
        { status: 200 }
      );
    }

    // Si se proporciona sessionId, retornar información de la sesión
    const agent = await createAgent({
      sessionId,
      enableMemory: true,
      enableTools: false, // No necesitamos herramientas solo para consultar
    });

    const memory = agent.getMemory();
    const stats = memory?.getMemoryStats();

    return Response.json({
      success: true,
      sessionId,
      memory: stats,
    });
  } catch (error: any) {
    console.error('Error in agent GET endpoint:', error);

    return Response.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
