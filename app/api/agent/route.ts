import { NextRequest, NextResponse } from 'next/server';
import { createAgent } from '@/agent/core/agent';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTimeout, TimeoutError, savePartialState } from '@/lib/timeout-handler';

// Configuración de timeouts
const CONFIG = {
  MAX_EXECUTION_TIME: 55000, // 55s (margen de 5s antes del timeout de Vercel)
  MCP_TIMEOUT: 30000, // 30s para llamadas MCP
};

// Crear cliente de Supabase con service role para acceso completo
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verifica el token JWT del usuario
 */
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    logger.error('Error verifying auth', error as Error, 'auth');
    return null;
  }
}

/**
 * Obtiene el contexto del proyecto desde Supabase
 */
async function getProjectContext(projectId: string, userId: string) {
  try {
    // Verificar que el usuario tiene acceso al proyecto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .or(`user_id.eq.${userId},id.in.(select project_id from user_projects where user_id='${userId}')`)
      .single();

    if (projectError || !project) {
      throw new Error('Proyecto no encontrado o sin acceso');
    }

    // Obtener contexto del proyecto desde context_memory
    const { data: contextData, error: contextError } = await supabase
      .from('context_memory')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (contextError && contextError.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('Error fetching context', contextError as any, 'project_context', { projectId });
    }

    return {
      project,
      context: contextData || null
    };
  } catch (error) {
    logger.error('Error getting project context', error as Error, 'project_context', { projectId });
    return null;
  }
}

/**
 * Lógica principal de procesamiento del agente
 */
async function processAgentMessage(agent: any, message: string, projectContext: any, editorContext: any) {
  // Construir mensaje con contexto del proyecto y del editor
  let enhancedMessage = "";

  // 1. Añadir contexto del editor (Monaco) si existe
  if (editorContext) {
    enhancedMessage += `
CONTEXTO DEL EDITOR ACTUAL:
Lenguaje: ${editorContext.language}
Líneas: ${editorContext.lineCount}
${editorContext.selectedCode ? `CÓDIGO SELECCIONADO:\n\`\`\`${editorContext.language}\n${editorContext.selectedCode}\n\`\`\`\n(Solo modifica esta parte si el usuario lo pide)\n` : ''}
CÓDIGO COMPLETO:
\`\`\`${editorContext.language}
${editorContext.code}
\`\`\`
`;
  }
  
  // 2. Añadir contexto del proyecto desde Supabase si existe
  if (projectContext?.context) {
    enhancedMessage += `
CONTEXTO GLOBAL DEL PROYECTO:
Proyecto: ${projectContext.project.name}
Descripción: ${projectContext.project.description || 'Sin descripción'}
Archivos: ${projectContext.context.files_count}

ÍNDICE SEMÁNTICO:
${JSON.stringify(projectContext.context.semantic_index, null, 2)}

CONTEXTO COMPRIMIDO RELEVANTE:
${projectContext.context.compressed_context.substring(0, 1500)}...
`;
  }

  // 3. Añadir instrucciones de formato
  enhancedMessage += `
REGLAS DEL ASISTENTE:
- Eres un asistente de código experto.
- Cuando generes código, usa bloques markdown: \`\`\`lenguaje
- Si el usuario pide "modificar", "arreglar" o "cambiar", devuelve el bloque de código corregido.
- Si el usuario pide "explicar", prioriza la explicación sobre el código.

MENSAJE DEL USUARIO:
${message}
`;

  // Procesar mensaje con el agente
  return await agent.processMessage(enhancedMessage);
}

/**
 * Endpoint principal del agente
 * POST /api/agent
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let agent: any = null;
  let body: any;

  try {
    // Verificar autenticación
    const user = await verifyAuth(request);
    
    if (!user) {
      logger.warn('Unauthorized access attempt', 'auth');
      return NextResponse.json(
        { error: 'No autorizado. Por favor inicia sesión.' },
        { status: 401 }
      );
    }

    // Parsear body
    body = await request.json();
    const { message, sessionId, projectId, context: editorContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Mensaje inválido' },
        { status: 400 }
      );
    }

    logger.info('Agent request received', 'agent_execution', { projectId, userId: user.id });

    // Obtener contexto del proyecto si se proporciona
    let projectContext = null;
    if (projectId) {
      projectContext = await getProjectContext(projectId, user.id);
    }

    // Crear agente con configuración MCP habilitada
    agent = await createAgent({
      sessionId: sessionId || user.id,
      userId: user.id,
      enableMCP: true
    });

    // Ejecutar procesamiento con timeout global
    const result = await withTimeout(
      processAgentMessage(agent, message, projectContext, editorContext),
      {
        maxDuration: CONFIG.MAX_EXECUTION_TIME,
        context: 'agent_execution',
        onTimeout: async () => {
          // Guardar estado parcial antes de timeout
          await savePartialState(supabase, projectId || user.id, {
            message,
            timedOutAt: new Date().toISOString(),
            duration: Date.now() - startTime,
          });
        },
      }
    );

    const duration = Date.now() - startTime;
    logger.info('Agent request completed', 'agent_execution', { projectId, duration });

    // Retornar respuesta
    return NextResponse.json({
      success: true,
      response: result.response,
      steps: result.steps,
      toolCalls: result.toolCalls,
      projectContext: projectContext ? {
        projectName: projectContext.project.name,
        filesCount: projectContext.context?.files_count || 0,
        tokensEstimate: projectContext.context?.token_estimate || 0
      } : null,
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    if (error instanceof TimeoutError) {
      logger.error('Agent execution timed out', error, 'agent_execution', { 
        projectId: body?.projectId,
        duration,
        maxDuration: error.duration,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'execution_timeout',
          message: 'La tarea está tomando más tiempo de lo esperado y se ha guardado para procesamiento en segundo plano.',
          partialState: true,
          metadata: {
            duration,
            maxDuration: error.duration,
          },
        },
        { status: 202 }
      );
    }

    logger.error('Agent execution failed', error as Error, 'agent_execution', { 
      projectId: body?.projectId,
      duration,
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'execution_error',
        message: error.message || 'Error al procesar la solicitud',
        metadata: { duration }
      },
      { status: 500 }
    );
  } finally {
    // Limpiar recursos del agente
    if (agent && typeof agent.cleanup === 'function') {
      try {
        await agent.cleanup();
      } catch (cleanupError) {
        logger.error('Error in agent cleanup', cleanupError as Error, 'agent_execution');
      }
    }
  }
}

/**
 * Endpoint para streaming (opcional)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Método no soportado. Use POST.' },
    { status: 405 }
  );
}

// Configuración de runtime para Vercel
export const runtime = 'nodejs';
export const maxDuration = 60;
