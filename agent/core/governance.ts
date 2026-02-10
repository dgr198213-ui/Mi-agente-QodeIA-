/**
 * Sistema de Gobernanza PageRank para persistencia y actualización de scores.
 */

import { supabase } from '@/lib/supabase';
import { computePageRank, Node, Transition } from './pagerank';

/**
 * Ejecuta el proceso de gobernanza para actualizar los scores de PageRank.
 * Puede ser global o específico a un contexto.
 */
export async function runGovernance(contextName?: string) {
  try {
    // 1. Obtener nodos
    const { data: nodesData, error: nodesError } = await supabase
      .from('agent_nodes')
      .select('id, rank_score');

    if (nodesError) throw nodesError;
    if (!nodesData || nodesData.length === 0) return;

    // 2. Obtener transiciones y configuración según el ámbito
    let transitionsData;
    let governanceConfig;

    if (contextName) {
      // Gobernanza por contexto
      const { data: ctxData } = await supabase
        .from('agent_contexts')
        .select('id')
        .eq('name', contextName)
        .single();

      if (!ctxData) throw new Error(`Contexto ${contextName} no encontrado`);

      const { data: tData, error: tError } = await supabase
        .from('agent_transitions_ctx')
        .select('from_node, to_node, weight')
        .eq('context_id', ctxData.id);

      if (tError) throw tError;
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

      if (tError) throw tError;
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
    let contextId: string | null = null;
    if (contextName) {
      const { data: ctxData } = await supabase
        .from('agent_contexts')
        .select('id')
        .eq('name', contextName)
        .single();
      if (ctxData) contextId = ctxData.id;
    }

    for (const [nodeId, score] of newRanks.entries()) {
      if (contextId) {
        await supabase
          .from('agent_node_ranks')
          .upsert({
            node_id: nodeId,
            context_id: contextId,
            rank_score: score,
            updated_at: new Date().toISOString()
          });
      } else if (!contextName) {
        await supabase
          .from('agent_nodes')
          .update({
            rank_score: score,
            updated_at: new Date().toISOString()
          })
          .eq('id', nodeId);
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

    console.log(`[Governance] PageRank actualizado para ${contextName || 'global'}`);
  } catch (error) {
    console.error('[Governance] Error en ejecución:', error);
  }
}

/**
 * Registra una transición entre dos nodos (herramientas, memorias, etc.)
 */
export async function recordTransition(fromKey: string, toKey: string, contextName?: string) {
  try {
    // Obtener IDs de los nodos por sus keys
    const { data: nodes } = await supabase
      .from('agent_nodes')
      .select('id, node_key')
      .in('node_key', [fromKey, toKey]);

    if (!nodes || nodes.length === 0) return;

    const fromNode = nodes.find(n => n.node_key === fromKey);
    const toNode = nodes.find(n => n.node_key === toKey);

    if (!fromNode || !toNode) return;

    if (contextName) {
      const { data: ctx } = await supabase
        .from('agent_contexts')
        .select('id')
        .eq('name', contextName)
        .single();

      if (ctx) {
        // Upsert con incremento de peso para contexto
        const { data: existing } = await supabase
          .from('agent_transitions_ctx')
          .select('weight')
          .match({ from_node: fromNode.id, to_node: toNode.id, context_id: ctx.id })
          .single();

        await supabase
          .from('agent_transitions_ctx')
          .upsert({
            from_node: fromNode.id,
            to_node: toNode.id,
            context_id: ctx.id,
            weight: (existing?.weight || 0) + 1
          });
      }
    }

    // También registrar en transiciones globales
    const { data: existingGlobal } = await supabase
      .from('agent_transitions')
      .select('weight')
      .match({ from_node: fromNode.id, to_node: toNode.id })
      .single();

    await supabase
      .from('agent_transitions')
      .upsert({
        from_node: fromNode.id,
        to_node: toNode.id,
        weight: (existingGlobal?.weight || 0) + 1
      });

  } catch (error) {
    console.error('[Governance] Error registrando transición:', error);
  }
}

/**
 * Asegura que una herramienta esté registrada como nodo
 */
export async function ensureToolNode(toolKey: string) {
  try {
    await supabase
      .from('agent_nodes')
      .upsert({
        node_key: toolKey,
        node_type: 'tool',
        rank_score: 0.1 // Score inicial bajo
      }, { onConflict: 'node_key' });
  } catch (error) {
    console.error(`[Governance] Error asegurando nodo para herramienta ${toolKey}:`, error);
  }
}
