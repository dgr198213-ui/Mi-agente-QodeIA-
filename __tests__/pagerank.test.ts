import { computePageRank, Node, Transition } from '../agent/core/pagerank';

describe('computePageRank', () => {
  describe('empty and minimal inputs', () => {
    it('returns empty map for empty node list', () => {
      const result = computePageRank([], []);
      expect(result.size).toBe(0);
    });

    it('returns uniform rank for single node with no transitions', () => {
      const nodes: Node[] = [{ id: 'a', rank: 0 }];
      const result = computePageRank(nodes, []);
      expect(result.size).toBe(1);
      expect(result.get('a')).toBeCloseTo(1.0, 5);
    });

    it('returns uniform distribution for two unconnected nodes', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
      ];
      const result = computePageRank(nodes, []);
      expect(result.get('a')).toBeCloseTo(result.get('b')!, 5);
    });
  });

  describe('transition filtering (integrity defense)', () => {
    it('ignores transitions referencing non-existent nodes', () => {
      const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
      const transitions: Transition[] = [
        { from: 'a', to: 'b', weight: 1 },
        { from: 'a', to: 'nonexistent', weight: 1 },  // invalid
        { from: 'ghost', to: 'b', weight: 1 },          // invalid
      ];
      // Should not throw and should only use valid transition a->b
      const result = computePageRank(nodes, transitions);
      expect(result.size).toBe(2);
      // b should be reachable from a, so b > a after convergence
      expect(result.get('b')!).toBeGreaterThan(result.get('a')!);
    });

    it('returns uniform ranks when all transitions reference non-existent nodes', () => {
      const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
      const transitions: Transition[] = [
        { from: 'x', to: 'y', weight: 1 },
      ];
      const result = computePageRank(nodes, transitions);
      expect(result.get('a')).toBeCloseTo(result.get('b')!, 5);
    });
  });

  describe('basic PageRank computation', () => {
    it('gives higher rank to a node with more incoming links', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
        { id: 'c', rank: 0 },
      ];
      // both a and b point to c, but c points to nowhere
      const transitions: Transition[] = [
        { from: 'a', to: 'c', weight: 1 },
        { from: 'b', to: 'c', weight: 1 },
      ];
      const result = computePageRank(nodes, transitions, 0.85, 50);
      expect(result.get('c')!).toBeGreaterThan(result.get('a')!);
      expect(result.get('c')!).toBeGreaterThan(result.get('b')!);
    });

    it('all ranks sum to approximately 1 for a simple graph', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
        { id: 'c', rank: 0 },
      ];
      const transitions: Transition[] = [
        { from: 'a', to: 'b', weight: 1 },
        { from: 'b', to: 'c', weight: 1 },
        { from: 'c', to: 'a', weight: 1 },
      ];
      const result = computePageRank(nodes, transitions, 0.85, 50);
      const total = [...result.values()].reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1.0, 3);
    });

    it('converges to equal ranks for a symmetric cycle', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
        { id: 'c', rank: 0 },
      ];
      const transitions: Transition[] = [
        { from: 'a', to: 'b', weight: 1 },
        { from: 'b', to: 'c', weight: 1 },
        { from: 'c', to: 'a', weight: 1 },
      ];
      const result = computePageRank(nodes, transitions, 0.85, 50);
      expect(result.get('a')).toBeCloseTo(result.get('b')!, 3);
      expect(result.get('b')).toBeCloseTo(result.get('c')!, 3);
    });
  });

  describe('damping factor parameter', () => {
    it('uses default damping factor of 0.85 when not specified', () => {
      const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
      const transitions: Transition[] = [{ from: 'a', to: 'b', weight: 1 }];
      const resultDefault = computePageRank(nodes, transitions);
      const result085 = computePageRank(nodes, transitions, 0.85);
      expect(resultDefault.get('a')).toBeCloseTo(result085.get('a')!, 10);
      expect(resultDefault.get('b')).toBeCloseTo(result085.get('b')!, 10);
    });

    it('produces different results with different damping factors', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
        { id: 'c', rank: 0 },
      ];
      const transitions: Transition[] = [
        { from: 'a', to: 'c', weight: 1 },
        { from: 'b', to: 'c', weight: 1 },
      ];
      const lowDamping = computePageRank(nodes, transitions, 0.1, 50);
      const highDamping = computePageRank(nodes, transitions, 0.99, 50);
      // Higher damping means more link-following weight; c should be ranked higher
      expect(highDamping.get('c')!).toBeGreaterThan(lowDamping.get('c')!);
    });
  });

  describe('sink node redistribution', () => {
    it('redistributes sink rank to all nodes preventing rank leak', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },  // sink - no outgoing
      ];
      const transitions: Transition[] = [
        { from: 'a', to: 'b', weight: 1 },
      ];
      const result = computePageRank(nodes, transitions, 0.85, 50);
      // b is a sink, but ranks should still sum to ~1
      const total = [...result.values()].reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1.0, 3);
      // All ranks should be positive
      result.forEach((rank) => {
        expect(rank).toBeGreaterThan(0);
      });
    });
  });

  describe('NaN/Infinity guard', () => {
    it('produces finite non-NaN results for all valid inputs', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
        { id: 'c', rank: 0 },
      ];
      const transitions: Transition[] = [
        { from: 'a', to: 'b', weight: 0.001 },
        { from: 'b', to: 'c', weight: 999 },
      ];
      const result = computePageRank(nodes, transitions, 0.85, 20);
      result.forEach((rank, id) => {
        expect(isNaN(rank)).toBe(false);
        expect(isFinite(rank)).toBe(true);
        expect(rank).toBeGreaterThanOrEqual(0);
      });
    });

    it('handles zero-weight transitions gracefully', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
      ];
      const transitions: Transition[] = [
        { from: 'a', to: 'b', weight: 0 },
      ];
      const result = computePageRank(nodes, transitions, 0.85, 20);
      result.forEach((rank) => {
        expect(isNaN(rank)).toBe(false);
        expect(isFinite(rank)).toBe(true);
      });
    });
  });

  describe('weighted transitions', () => {
    it('proportionally ranks nodes based on edge weights', () => {
      const nodes: Node[] = [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 0 },
        { id: 'hub', rank: 0 },
      ];
      // hub gets 10x weight from a vs b
      const transitions: Transition[] = [
        { from: 'a', to: 'hub', weight: 10 },
        { from: 'b', to: 'hub', weight: 1 },
        { from: 'hub', to: 'a', weight: 1 },
        { from: 'hub', to: 'b', weight: 1 },
      ];
      const result = computePageRank(nodes, transitions, 0.85, 50);
      // hub should be highly ranked since both a and b link to it
      expect(result.get('hub')!).toBeGreaterThan(result.get('b')!);
    });
  });

  describe('iterations parameter', () => {
    it('accepts custom iteration count', () => {
      const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
      const transitions: Transition[] = [{ from: 'a', to: 'b', weight: 1 }];
      // Should not throw with custom iterations
      expect(() => computePageRank(nodes, transitions, 0.85, 1)).not.toThrow();
      expect(() => computePageRank(nodes, transitions, 0.85, 100)).not.toThrow();
    });

    it('produces valid ranks after just 1 iteration', () => {
      const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
      const result = computePageRank(nodes, [], 0.85, 1);
      expect(result.size).toBe(2);
      result.forEach((rank) => {
        expect(isFinite(rank)).toBe(true);
        expect(rank).toBeGreaterThan(0);
      });
    });
  });

  describe('large node sets', () => {
    it('handles a star graph correctly', () => {
      // One central node pointed to by many leaves
      const center: Node = { id: 'center', rank: 0 };
      const leaves: Node[] = Array.from({ length: 10 }, (_, i) => ({ id: `leaf${i}`, rank: 0 }));
      const nodes = [center, ...leaves];
      const transitions: Transition[] = leaves.map((l) => ({ from: l.id, to: 'center', weight: 1 }));
      const result = computePageRank(nodes, transitions, 0.85, 50);
      // center should rank higher than any leaf
      leaves.forEach((l) => {
        expect(result.get('center')!).toBeGreaterThan(result.get(l.id)!);
      });
    });
  });
});