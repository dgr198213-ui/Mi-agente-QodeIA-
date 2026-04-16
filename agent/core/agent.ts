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
 * Create an agent instance configured with optional MCP integrations and PageRank-based tool prioritization.
 *
 * The agent initializes MCP lazily (no eager connection), ensures PageRank nodes for available tools asynchronously,
 * and exposes a message processing flow that infers context, ranks tools for that context, executes tool-enabled
 * generation steps, and records tool transition traces.
 *
 * @param options - Configuration for the agent instance
 * @param options.sessionId - Unique identifier for the agent session
 * @param options.userId - Optional identifier for the user associated with the session
 * @param options.enableMCP - When true (default), attempt to configure MCP client; the client is used only if configuration succeeds
 * @returns An object representing the agent with the following properties:
 *  - `sessionId`: the provided session identifier
 *  - `userId`: the provided user identifier (if any)
 *  - `tools`: consolidated tool set (GitHub, Supabase, Vercel and optional MCP tools)
 *  - `mcpEnabled`: `true` when MCP was requested and successfully configured, `false` otherwise
 *  - `processMessage(message)`: processes a user message by inferring context, ranking tools for that context, executing the generation flow with prioritized tools, recording tool transitions, and returning `{ response, steps, toolCalls, memoryUsed }`
 *  - `cleanup()`: disconnects the MCP client if it was configured
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
 * Annotates tool descriptions with structural relevance scores to prioritize tools for a given context.
 *
 * @param tools - Mapping of tool keys to tool definition objects
 * @param context - Name of the operational context used to determine ranking scores
 * @returns A mapping of tools where descriptions for ranked tools are prefixed with `[RELEVANCIA ESTRUCTURAL: <score>]`; returns the original `tools` unchanged if no ranks are available or an error occurs
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
 * Emits a structured info-level log entry as JSON to stdout.
 *
 * The log object contains `level`, `module`, `message`, `timestamp`, and any additional
 * top-level fields merged from `data`.
 *
 * @param message - Primary log message
 * @param data - Optional additional fields to merge into the log object
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

/**
 * Logs an error event as a structured JSON object to the process error stream.
 *
 * The emitted JSON includes a severity level (`error`), module identifier (`agent-core`), the
 * provided message, a string representation of the `error`, and an ISO8601 timestamp.
 *
 * @param message - Human-readable description of the error event
 * @param error - Error instance or any value providing additional error details; if an `Error`
 *                object is supplied, its `message` is used
 */
function logError(message: string, error: any) {
  console.error(JSON.stringify({
    level: 'error',
    module: 'agent-core',
    message,
    error: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString()
  }));
}
