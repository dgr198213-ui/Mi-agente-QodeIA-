/**
 * API Route Principal - QodeIA Multi-Agent Orchestrator
 * Endpoint: POST /api/agent
 * 
 * Integra el nuevo CEOOrchestrator con el sistema de autenticación y contexto existente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCEOOrchestrator } from '@/agent/core/CEOOrchestrator';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Configuración de timeouts
const CONFIG = {
  MAX_EXECUTION_TIME: 55000, // 55s
};

// Crear cliente de Supabase con service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verifica el token JWT del usuario
 */
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (error) {
    logger.error('Error verifying auth', error as Error, 'auth');
    return null;
  }
}

/**
 * Endpoint principal del agente
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let ceo: any = null;

  try {
    // 1. Verificar autenticación
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Parsear body
    const body = await request.json();
    const { message, sessionId, projectId, context: editorContext } = body;

    if (!message) {
      return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 });
    }

    logger.info('CEO Orchestrator request received', 'agent_execution', { userId: user.id });

    // 3. Inicializar el Orquestador CEO (Multi-LLM: Groq, DeepSeek, Gemini, Mistral)
    ceo = await createCEOOrchestrator();

    // 4. Enriquecer mensaje con contexto si existe
    let enhancedMessage = message;
    if (editorContext) {
      enhancedMessage = `
CONTEXTO DEL EDITOR:
Lenguaje: ${editorContext.language}
Código:
\`\`\`${editorContext.language}
${editorContext.code}
\`\`\`

SOLICITUD DEL USUARIO:
${message}`;
    }

    // 5. Procesar la solicitud con el sistema multi-agente
    const result = await ceo.processRequest({
      userMessage: enhancedMessage,
      sessionId: sessionId || user.id,
      context: projectId ? `project:${projectId}` : 'general'
    });

    const duration = Date.now() - startTime;

    // 6. Persistir en Supabase para historial
    try {
      await supabase.from('messages').insert([
        { session_id: sessionId || user.id, role: 'user', content: message, user_id: user.id },
        { 
          session_id: sessionId || user.id, 
          role: 'assistant', 
          content: result.response, 
          user_id: user.id,
          metadata: {
            delegatedTasks: result.delegatedTasks,
            executionTime: result.totalExecutionTime,
            multiLLM: true
          }
        }
      ]);
    } catch (dbError) {
      logger.error('Error persisting messages', dbError as Error, 'database');
    }

    // 7. Retornar respuesta
    return NextResponse.json({
      success: result.success,
      response: result.response,
      delegatedTasks: result.delegatedTasks,
      metadata: {
        duration,
        totalExecutionTime: result.totalExecutionTime,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    logger.error('CEO Orchestrator execution failed', error as Error, 'agent_execution');
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  } finally {
    if (ceo) await ceo.cleanup();
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
