/**
 * Sistema de Gobernanza PageRank para persistencia y actualización de scores.
 */

import { supabase } from '@/lib/supabase';
import { computePageRank, Node, Transition } from './pagerank';

/**
 * Run a PageRank governance cycle to compute and persist node scores for either global or context-specific scope.
 *
 * Computes PageRank from stored nodes and transitions, updates persistent rank values, updates the last-run timestamp for the chosen scope, and records an audit entry.
 *
 * @param options.contextName - Optional name of the context to run contextual governance for; omit to run global governance.
 * @param options.userId - Optional user identifier to include in the audit record.
 */
export async function runGovernance(options: { contextName?: string; userId?: string } = {}) {
  const { contextName, userId } = options;

  try {
    // 1. Obtener nodos
    const { data: nodesData, error: nodesError } = await supabase
      .from('agent_nodes')
      .select('id, rank_score');

    if (nodesError) {
      logError('Error obteniendo nodos', nodesError);
      throw nodesError;
    }

    if (!nodesData || nodesData.length === 0) return;

    // 2. Obtener transiciones y configuración según el ámbito
    let transitionsData;
    let governanceConfig;
    let contextId: string | null = null;

    if (contextName) {
      // Gobernanza por contexto
      const { data: ctxData, error: ctxError } = await supabase
        .from('agent_contexts')
        .select('id')
        .eq('name', contextName)
        .single();

      if (ctxError || !ctxData) {
        throw new Error(`Contexto ${contextName} no encontrado: ${ctxError?.message}`);
      }

      contextId = ctxData.id;

      const { data: tData, error: tError } = await supabase
        .from('agent_transitions_ctx')
        .select('from_node, to_node, weight')
        .eq('context_id', ctxData.id);

      if (tError) {
        logError(`Error obteniendo transiciones para contexto ${contextName}`, tError);
        throw tError;
      }
      transitionsData = tData;

      const { data: gData } = await supabase
        .from('agent_governance_ctx')
        .select('damping_factor')
        .eq('context_id', ctxData.id)
        .single();

      governanceConfig = gData;
    } else {
      // Gobernanza global
      const { data: tData, error: tError } = await supabase
        .from('agent_transitions')
        .select('from_node, to_node, weight');

      if (tError) {
        logError('Error obteniendo transiciones globales', tError);
        throw tError;
      }
      transitionsData = tData;

      const { data: gData } = await supabase
        .from('agent_governance')
        .select('damping_factor')
        .single();

      governanceConfig = gData;
    }

    // 3. Preparar datos para el motor
    const nodes: Node[] = nodesData.map(n => ({ id: n.id, rank: n.rank_score }));
    const transitions: Transition[] = transitionsData.map(t => ({
      from: t.from_node,
      to: t.to_node,
      weight: t.weight
    }));

    // 4. Calcular PageRank
    const dampingFactor = governanceConfig?.damping_factor ?? 0.85;
    const newRanks = computePageRank(nodes, transitions, dampingFactor);

    // 5. Persistir resultados
    for (const [nodeId, score] of newRanks.entries()) {
      if (contextId) {
        const { error: upsertError } = await supabase
          .from('agent_node_ranks')
          .upsert({
            node_id: nodeId,
            context_id: contextId,
            rank_score: score,
            updated_at: new Date().toISOString()
          });
        if (upsertError) logError(`Error actualizando rank para nodo ${nodeId}`, upsertError);
      } else if (!contextName) {
        const { error: updateError } = await supabase
          .from('agent_nodes')
          .update({
            rank_score: score,
            updated_at: new Date().toISOString()
          })
          .eq('id', nodeId);
        if (updateError) logError(`Error actualizando rank global para nodo ${nodeId}`, updateError);
      }
    }

    // 6. Actualizar timestamp de última ejecución
    if (contextId) {
      await supabase
        .from('agent_governance_ctx')
        .upsert({
          context_id: contextId,
          last_run: new Date().toISOString()
        });
    } else if (!contextName) {
      await supabase
        .from('agent_governance')
        .upsert({
          last_run: new Date().toISOString()
        });
    }

    // 7. Registrar auditoría
    await supabase.from('agent_governance_audit').insert({
      action: 'run_governance',
      user_id: userId,
      context_id: contextId,
      metadata: {
        nodes_processed: nodes.length,
        transitions_processed: transitions.length,
        scope: contextName || 'global'
      }
    });

    logInfo(`PageRank actualizado para ${contextName || 'global'}`);
  } catch (error) {
    logError('Error en ejecución de gobernanza', error);
  }
}

/**
 * Records an observed transition between two nodes and updates global and optional contextual transition counters.
 *
 * @param fromKey - The originating node's `node_key`.
 * @param toKey - The destination node's `node_key`.
 * @param options.contextName - If provided, increments the contextual transition for the named context.
 * @param options.userId - Optional user id to include in the audit record.
 */
export async function recordTransition(fromKey: string, toKey: string, options: { contextName?: string; userId?: string } = {}) {
  const { contextName, userId } = options;

  try {
    // Obtener IDs de los nodos por sus keys
    const { data: nodes, error: nodesError } = await supabase
      .from('agent_nodes')
      .select('id, node_key')
      .in('node_key', [fromKey, toKey]);

    if (nodesError) {
      logError('Error obteniendo nodos para transición', nodesError);
      return;
    }

    if (!nodes || nodes.length < 2) {
      // Si falta alguno, asegurar que existan (o al menos loguear)
      if (!nodes || !nodes.find(n => n.node_key === fromKey)) await ensureToolNode(fromKey);
      if (!nodes || !nodes.find(n => n.node_key === toKey)) await ensureToolNode(toKey);

      // Re-intentar obtener una vez más si fue necesario crear
      return;
    }

    const fromNode = nodes.find(n => n.node_key === fromKey);
    const toNode = nodes.find(n => n.node_key === toKey);

    if (!fromNode || !toNode) return;

    let contextId: string | null = null;

    if (contextName) {
      const { data: ctx } = await supabase
        .from('agent_contexts')
        .select('id')
        .eq('name', contextName)
        .single();

      if (ctx) {
        contextId = ctx.id;
        // Incremento atómico via RPC
        const { error: rpcError } = await supabase.rpc('increment_transition_ctx', {
          p_from_node: fromNode.id,
          p_to_node: toNode.id,
          p_context_id: ctx.id,
          p_increment: 1.0
        });

        if (rpcError) {
          logError('Error incrementando transición contextual via RPC', rpcError);
        }
      }
    }

    // También registrar en transiciones globales via RPC
    const { error: globalRpcError } = await supabase.rpc('increment_transition_global', {
      p_from_node: fromNode.id,
      p_to_node: toNode.id,
      p_increment: 1.0
    });

    if (globalRpcError) {
      logError('Error incrementando transición global via RPC', globalRpcError);
    }

    // Registrar auditoría de transición
    await supabase.from('agent_governance_audit').insert({
      action: 'record_transition',
      user_id: userId,
      context_id: contextId,
      metadata: {
        from_key: fromKey,
        to_key: toKey
      }
    });

  } catch (error) {
    logError('Error registrando transición', error);
  }
}

/**
 * Ensures a tool is present as a node in the agent_nodes table.
 *
 * Logs an error if the database operation fails or an unexpected exception occurs.
 *
 * @param toolKey - The unique node_key identifying the tool to ensure
 */
export async function ensureToolNode(toolKey: string) {
  try {
    const { error } = await supabase
      .from('agent_nodes')
      .upsert({
        node_key: toolKey,
        node_type: 'tool',
        rank_score: 0.1 // Score inicial bajo
      }, { onConflict: 'node_key' });

    if (error) logError(`Error asegurando nodo para herramienta ${toolKey}`, error);
  } catch (error) {
    logError(`Error inesperado asegurando nodo para herramienta ${toolKey}`, error);
  }
}

/**
 * Emit an informational structured log entry for the governance module.
 *
 * Emits a JSON object containing `level: 'info'`, `module: 'governance'`, `message`, `timestamp`, and any additional `data` fields merged at the top level.
 *
 * @param message - The primary log message
 * @param data - Optional additional fields to include in the log output
 */
function logInfo(message: string, data?: any) {
  console.log(JSON.stringify({
    level: 'info',
    module: 'governance',
    message,
    timestamp: new Date().toISOString(),
    ...data
  }));
}

/**
 * Logs a structured error record to stderr using console.error.
 *
 * @param message - Short description of the error event
 * @param error - The error object or value to include; if an `Error`, its `message` and `stack` are extracted
 */
function logError(message: string, error: any) {
  console.error(JSON.stringify({
    level: 'error',
    module: 'governance',
    message,
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  }));
}
