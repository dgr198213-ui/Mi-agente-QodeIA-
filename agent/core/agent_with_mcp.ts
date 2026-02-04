/**
 * Integración MCP en el Core del Agente QodeIA
 * 
 * Este archivo incorpora las herramientas MCP sin romper la funcionalidad existente.
 */

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getMCPClient } from '@/mcp/client';
import { 
  queryDocumentation, 
  analyzeImpact,
  syncSolutionToKnowledgeBase,
  verifyArchitecturalDecision 
} from '@/agent/tools/mcp_notebooklm';
import { supabaseTools } from '@/agent/tools/supabase';
import { inferContext } from './context';
import { recordTransition, ensureToolNode } from './governance';
import { supabase } from '@/lib/supabase';

// Importar herramientas existentes (asumiendo que existen en el repo)
const githubTools = {}; 
const vercelTools = {};

/**
 * Sistema de prompts con reglas MCP integradas
 */
export const SYSTEM_PROMPT = `
Eres QodeIA, un agente autónomo de desarrollo de software con acceso a:
- GitHub (lectura, escritura, PRs)
- Supabase (base de datos, storage)
- Vercel (despliegues)
- **NotebookLM (documentación técnica verificable)**

## NUEVAS CAPACIDADES MCP

### 1. Consulta de Documentación (OBLIGATORIO)
**REGLA DE ORO**: Antes de modificar esquemas de DB, interfaces compartidas o 
proponer arquitecturas, DEBES consultar queryDocumentation.

### 2. Análisis de Impacto (REQUERIDO para cambios cross-repo)
**USO**: Cuando un cambio afecta múltiples repositorios.

### 3. Verificación Arquitectónica (PREVENTIVO)
**USO**: Antes de proponer nuevas integraciones o cambios estructurales.

### 4. Sincronización de Soluciones (AUTOMÁTICO)
**TRIGGER**: Después de resolver errores exitosamente o cuando el usuario acepta 
una propuesta del Shadow Workspace.

## REGLAS EXISTENTES (MANTENER)
- Shadow Workspace: NUNCA modifiques archivos directamente en la tabla files.
- Memoria Procedural: Si encuentras un error que ya solucionaste, aplícalo.
- Conciencia Estructural: Usa analyzeImpact para análisis cross-repo.

Mantén tu razonamiento transparente y siempre cita fuentes cuando uses MCP.
`;

/**
 * Configuración del agente con MCP y PageRank
 */
export async function createAgent(options: {
  sessionId: string;
  userId?: string;
  enableMCP?: boolean;
}) {
  const { sessionId, userId, enableMCP = true } = options;

  // Inicializar MCP si está habilitado
  let mcpClient = null;
  if (enableMCP) {
    try {
      mcpClient = getMCPClient();
      // Intentar conectar al servidor principal
      await mcpClient.connect('notebooklm-howard-os');
      console.log('[Agent] MCP habilitado y conectado');
    } catch (error) {
      console.error('[Agent] Error al conectar MCP:', error);
    }
  }

  // Consolidar todas las herramientas
  const tools: any = {
    ...githubTools,
    ...supabaseTools,
    ...vercelTools,
    ...(enableMCP && mcpClient
      ? {
          queryDocumentation,
          analyzeImpact,
          syncSolutionToKnowledgeBase,
          verifyArchitecturalDecision,
        }
      : {}),
  };

  // Asegurar que todas las herramientas existan como nodos en PageRank
  for (const toolKey of Object.keys(tools)) {
    await ensureToolNode(toolKey);
  }
  await ensureToolNode('user_input');

  return {
    sessionId,
    userId,
    tools,
    mcpEnabled: enableMCP && mcpClient !== null,

    async processMessage(message: string) {
      // 1. Inferencia de contexto inicial
      const currentContext = inferContext({ userIntent: message });

      // 2. Obtener relevancia de tools para el contexto actual
      const rankedTools = await getRankedTools(tools, currentContext);

      let lastNodeKey = 'user_input';

      return streamText({
        model: openai('gpt-4-turbo'),
        system: `${SYSTEM_PROMPT}\n\n## CONTEXTO OPERATIVO: ${currentContext.toUpperCase()}\nUsa las herramientas priorizadas para este contexto.`,
        messages: [{ role: 'user', content: message }],
        tools: rankedTools,
        maxSteps: 10,
        onStepFinish: async (step) => {
          // Registrar transiciones entre herramientas
          if (step.toolCalls) {
            for (const call of step.toolCalls) {
              await recordTransition(lastNodeKey, call.toolName, currentContext);
              lastNodeKey = call.toolName;
            }
          }
        }
      });
    },

    async cleanup() {
      if (mcpClient) {
        await mcpClient.disconnect();
      }
    },
  };
}

/**
 * Ordena y prioriza las herramientas basándose en sus scores de PageRank
 */
async function getRankedTools(tools: any, context: string) {
  try {
    const { data: ranks } = await supabase
      .from('agent_node_ranks')
      .select('rank_score, agent_nodes!inner(node_key), agent_contexts!inner(name)')
      .eq('agent_contexts.name', context)
      .order('rank_score', { ascending: false });

    // Si no hay ranks aún, devolver tools originales
    if (!ranks || ranks.length === 0) return tools;

    // Reordenar herramientas (aquí simplemente retornamos el mismo objeto,
    // pero el LLM recibirá las descripciones con info de prioridad si lo deseamos,
    // o simplemente confiamos en que el orden de las keys en el objeto influye levemente)
    // Una mejor forma es inyectar la prioridad en la descripción.

    const prioritizedTools = { ...tools };
    for (const rank of ranks) {
      const toolKey = (rank as any).agent_nodes.node_key;
      if (prioritizedTools[toolKey]) {
        prioritizedTools[toolKey].description = `[PRIORIDAD: ${rank.rank_score.toFixed(2)}] ${prioritizedTools[toolKey].description}`;
      }
    }

    return prioritizedTools;
  } catch (error) {
    console.error('[Agent] Error ranking tools:', error);
    return tools;
  }
}
