/**
 * Integración MCP en el Core del Agente QodeIA
 *
 * Este archivo incorpora las herramientas MCP sin romper la funcionalidad existente.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getMCPClient } from '@/mcp/client';
import mcpConfig from '@/mcp_config.json';
import {
  queryDocumentation,
  analyzeImpact,
  syncSolutionToKnowledgeBase,
  verifyArchitecturalDecision
} from '@/agent/tools/mcp_notebooklm';
import { supabaseTools } from '@/agent/tools/supabase';
import { githubTools } from '@/agent/tools/github';
import { vercelTools } from '@/agent/tools/vercel';
import { inferContext } from './context';
import { recordTransition, ensureToolNode } from './governance';
import { supabase } from '@/lib/supabase';

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

  // Inicializar cliente MCP (sin conectar ansiosamente)
  let mcpClient = null;
  if (enableMCP) {
    try {
      mcpClient = getMCPClient(mcpConfig);
      logInfo('[Agent] MCP configurado (lazy connection habilitada)');
    } catch (error) {
      logError('[Agent] Error al configurar MCP:', error);
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
  // Nota: Esto se hace de forma asíncrona pero sin bloquear la respuesta inicial
  Object.keys(tools).forEach(toolKey => ensureToolNode(toolKey));
  ensureToolNode('user_input');

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

      const result = await generateText({
        model: openai('gpt-4-turbo'),
        system: `${SYSTEM_PROMPT}\n\n## CONTEXTO OPERATIVO: ${currentContext.toUpperCase()}\nUsa las herramientas priorizadas para este contexto.`,
        messages: [{ role: 'user', content: message }],
        tools: rankedTools,
        maxSteps: 10,
        onStepFinish: async (step) => {
          // Registrar transiciones entre herramientas con contexto de usuario
          if (step.toolCalls) {
            for (const call of step.toolCalls) {
              await recordTransition(lastNodeKey, call.toolName, {
                contextName: currentContext,
                userId
              });
              lastNodeKey = call.toolName;
            }
          }
        }
      });

      return {
        response: result.text,
        steps: result.steps,
        toolCalls: result.toolCalls,
        memoryUsed: 0 // Placeholder para integración con memoria
      };
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
    const { data: ranks, error } = await supabase
      .from('agent_node_ranks')
      .select('rank_score, agent_nodes!inner(node_key), agent_contexts!inner(name)')
      .eq('agent_contexts.name', context)
      .order('rank_score', { ascending: false });

    if (error) {
      logError('[Agent] Error obteniendo ranks de herramientas:', error);
      return tools;
    }

    // Si no hay ranks aún, devolver tools originales
    if (!ranks || ranks.length === 0) return tools;

    const prioritizedTools = { ...tools };
    for (const rank of ranks) {
      const toolKey = (rank as any).agent_nodes.node_key;
      if (prioritizedTools[toolKey]) {
        // Inyectar la prioridad en la descripción para que el LLM lo sepa
        prioritizedTools[toolKey].description = `[RELEVANCIA ESTRUCTURAL: ${rank.rank_score.toFixed(2)}] ${prioritizedTools[toolKey].description}`;
      }
    }

    return prioritizedTools;
  } catch (error) {
    logError('[Agent] Error crítico rankeando herramientas:', error);
    return tools;
  }
}

/**
 * Helpers para logging estructurado
 */
function logInfo(message: string, data?: any) {
  console.log(JSON.stringify({
    level: 'info',
    module: 'agent-core',
    message,
    timestamp: new Date().toISOString(),
    ...data
  }));
}

function logError(message: string, error: any) {
  console.error(JSON.stringify({
    level: 'error',
    module: 'agent-core',
    message,
    error: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString()
  }));
}
