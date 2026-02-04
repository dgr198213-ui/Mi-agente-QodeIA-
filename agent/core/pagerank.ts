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
 * Calcula el PageRank para un conjunto de nodos y transiciones.
 * R_{t+1} = d (M * R_t) + (1-d)/N * 1
 *
 * @param nodes Lista de nodos a rankear
 * @param transitions Matriz de transiciones (pesada)
 * @param d Factor de amortiguación (default 0.85)
 * @param iterations Número de iteraciones para convergencia
 * @returns Mapa de node_id -> rank_score
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

  transitions.forEach((t) => {
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
    // En un PageRank puro, los sumideros se redistribuyen a todos los nodos
    let sinkRank = 0;
    nodes.forEach((node) => {
      if (!outgoing.has(node.id) || totalOutgoingWeights.get(node.id) === 0) {
        sinkRank += ranks.get(node.id)!;
      }
    });

    nodes.forEach((node) => {
      let sum = 0;
      const incomings = incoming.get(node.id) || [];

      incomings.forEach((t) => {
        const fromRank = ranks.get(t.from)!;
        const totalWeight = totalOutgoingWeights.get(t.from) || 0;
        if (totalWeight > 0) {
          sum += (fromRank * t.weight) / totalWeight;
        }
      });

      // Fórmula de PageRank con factor de amortiguación y redistribución de sumideros
      const newRank = d * (sum + sinkRank / N) + (1 - d) / N;
      newRanks.set(node.id, newRank);
    });

    // Actualizar ranks para la siguiente iteración
    newRanks.forEach((v, k) => ranks.set(k, v));
  }

  return ranks;
}
