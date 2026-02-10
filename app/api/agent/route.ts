import { NextRequest, NextResponse } from 'next/server';
import { createAgent } from '@/agent/core/agent_with_mcp';
import { createClient } from '@supabase/supabase-js';

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
    console.error('Error verifying auth:', error);
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
      console.error('Error fetching context:', contextError);
    }

    return {
      project,
      context: contextData || null
    };
  } catch (error) {
    console.error('Error getting project context:', error);
    return null;
  }
}

/**
 * Endpoint principal del agente
 * POST /api/agent
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await verifyAuth(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado. Por favor inicia sesión.' },
        { status: 401 }
      );
    }

    // Parsear body
    const body = await request.json();
    const { message, sessionId, projectId, context: editorContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Mensaje inválido' },
        { status: 400 }
      );
    }

    // Obtener contexto del proyecto si se proporciona
    let projectContext = null;
    if (projectId) {
      projectContext = await getProjectContext(projectId, user.id);
    }

    // Crear agente con configuración MCP habilitada
    const agent = await createAgent({
      sessionId: sessionId || user.id,
      userId: user.id,
      enableMCP: true
    });

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

    // Procesar mensaje
    const result = await agent.processMessage(enhancedMessage);

    // Retornar respuesta
    return NextResponse.json({
      response: result.response,
      steps: result.steps,
      toolCalls: result.toolCalls,
      projectContext: projectContext ? {
        projectName: projectContext.project.name,
        filesCount: projectContext.context?.files_count || 0,
        tokensEstimate: projectContext.context?.token_estimate || 0
      } : null
    });

  } catch (error: any) {
    console.error('Error in agent endpoint:', error);
    
    return NextResponse.json(
      { 
        error: 'Error al procesar la solicitud',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Endpoint para streaming (opcional)
 * GET /api/agent/stream
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Método no soportado. Use POST.' },
    { status: 405 }
  );
}
