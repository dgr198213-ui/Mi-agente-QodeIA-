/**
 * Motor PageRank para Gobernanza del Agente QodeIA
 */

export type Node = {
  id: string;
  rank: number;
};

export type Transition = {
  from: string;
  to: string;
  weight: number;
};

/**
 * Compute PageRank scores for a set of nodes connected by weighted directed transitions.
 *
 * Filters out transitions that reference unknown nodes, treats nodes with no outgoing weight
 * as sinks whose rank is redistributed uniformly, and guards against invalid numeric results
 * by falling back to a uniform rank for the affected node.
 *
 * @param nodes - Array of nodes to rank (each must have an `id`)
 * @param transitions - Array of weighted directed transitions with `from`, `to`, and `weight`
 * @param d - Damping factor in [0, 1] that controls random jump probability (default 0.85)
 * @param iterations - Number of fixed-point iterations to perform (default 20)
 * @returns Map from node id to PageRank score; scores sum to approximately 1
 */
export function computePageRank(
  nodes: Node[],
  transitions: Transition[],
  d = 0.85,
  iterations = 20
): Map<string, number> {
  const N = nodes.length;
  if (N === 0) return new Map();

  const ranks = new Map<string, number>();

  // Inicialización: distribución uniforme
  nodes.forEach((n) => ranks.set(n.id, 1 / N));

  // Mapa de adyacencia para optimizar el cálculo
  const outgoing = new Map<string, Transition[]>();
  const incoming = new Map<string, Transition[]>();

  // Filtrar transiciones que referencian nodos inexistentes (defensa de integridad)
  const nodeIds = new Set(nodes.map(n => n.id));
  const validTransitions = transitions.filter(t => nodeIds.has(t.from) && nodeIds.has(t.to));

  validTransitions.forEach((t) => {
    if (!outgoing.has(t.from)) outgoing.set(t.from, []);
    outgoing.get(t.from)!.push(t);

    if (!incoming.has(t.to)) incoming.set(t.to, []);
    incoming.get(t.to)!.push(t);
  });

  // Cálculo de pesos totales de salida por nodo para normalización
  const totalOutgoingWeights = new Map<string, number>();
  for (const [nodeId, outs] of outgoing.entries()) {
    totalOutgoingWeights.set(
      nodeId,
      outs.reduce((sum, t) => sum + t.weight, 0)
    );
  }

  // Iteraciones
  for (let i = 0; i < iterations; i++) {
    const newRanks = new Map<string, number>();

    // Manejo de sumideros (nodos sin salida)
    let sinkRank = 0;
    nodes.forEach((node) => {
      if (!outgoing.has(node.id) || totalOutgoingWeights.get(node.id) === 0) {
        sinkRank += ranks.get(node.id) || 0;
      }
    });

    nodes.forEach((node) => {
      let sum = 0;
      const incomings = incoming.get(node.id) || [];

      incomings.forEach((t) => {
        // Defensa: usar 0 si el nodo de origen no está en ranks (no debería pasar por el filtro previo)
        const fromRank = ranks.get(t.from) ?? 0;
        const totalWeight = totalOutgoingWeights.get(t.from) || 0;

        if (totalWeight > 0) {
          sum += (fromRank * t.weight) / totalWeight;
        }
      });

      // Fórmula de PageRank con factor de amortiguación y redistribución de sumideros
      let newRank = d * (sum + sinkRank / N) + (1 - d) / N;

      // Validación final contra NaN o valores infinitos
      if (isNaN(newRank) || !isFinite(newRank)) {
        newRank = 1 / N; // Fallback a distribución uniforme si algo sale mal
      }

      newRanks.set(node.id, newRank);
    });

    // Actualizar ranks para la siguiente iteración
    newRanks.forEach((v, k) => ranks.set(k, v));
  }

  return ranks;
}
