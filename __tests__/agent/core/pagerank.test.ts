import { describe, it, expect } from 'vitest';
import { computePageRank, Node, Transition } from '@/agent/core/pagerank';

describe('computePageRank', () => {
  // ─── Basic behavior ──────────────────────────────────────────────────────────

  it('returns an empty Map when given no nodes', () => {
    const result = computePageRank([], []);
    expect(result.size).toBe(0);
  });

  it('returns a single node with rank 1 (converges to 1/N where N=1)', () => {
    const nodes: Node[] = [{ id: 'a', rank: 0 }];
    const result = computePageRank(nodes, []);
    // For a single sink node with no transitions: rank = d*(0 + 1/1) + (1-d)/1 = 1
    expect(result.get('a')).toBeCloseTo(1, 5);
  });

  it('distributes uniform initial rank across all nodes', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
      { id: 'c', rank: 0 },
    ];
    const result = computePageRank(nodes, [], 0.85, 0);
    // After 0 iterations, ranks are still the uniform initialization
    expect(result.get('a')).toBeCloseTo(1 / 3, 5);
    expect(result.get('b')).toBeCloseTo(1 / 3, 5);
    expect(result.get('c')).toBeCloseTo(1 / 3, 5);
  });

  it('ranks sum to approximately 1 after convergence', () => {
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
    const result = computePageRank(nodes, transitions);
    const total = Array.from(result.values()).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 4);
  });

  // ─── Transition filtering (new in this PR) ───────────────────────────────────

  it('filters out transitions referencing non-existent nodes', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: 1 },
      // 'ghost' does not exist in nodes
      { from: 'ghost', to: 'b', weight: 5 },
      { from: 'a', to: 'phantom', weight: 5 },
    ];
    // Should not throw; ghost transitions are silently dropped
    expect(() => computePageRank(nodes, transitions)).not.toThrow();
    const result = computePageRank(nodes, transitions);
    expect(result.size).toBe(2);
  });

  it('gives higher rank to a node that receives more incoming weight', () => {
    const nodes: Node[] = [
      { id: 'popular', rank: 0 },
      { id: 'source1', rank: 0 },
      { id: 'source2', rank: 0 },
      { id: 'source3', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'source1', to: 'popular', weight: 1 },
      { from: 'source2', to: 'popular', weight: 1 },
      { from: 'source3', to: 'popular', weight: 1 },
    ];
    const result = computePageRank(nodes, transitions, 0.85, 50);
    // 'popular' receives from 3 sources; sources are sinks (no outgoing)
    // popular should have the highest rank
    const popularRank = result.get('popular')!;
    const source1Rank = result.get('source1')!;
    expect(popularRank).toBeGreaterThan(source1Rank);
  });

  // ─── Sink node redistribution ────────────────────────────────────────────────

  it('handles all-sink graphs without throwing', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
    ];
    // No transitions → both are sinks
    expect(() => computePageRank(nodes, [])).not.toThrow();
    const result = computePageRank(nodes, []);
    // With no transitions each is a sink; uniform distribution expected
    expect(result.get('a')).toBeCloseTo(result.get('b')!, 4);
  });

  it('handles mixed graphs where some nodes are sinks', () => {
    const nodes: Node[] = [
      { id: 'active', rank: 0 },
      { id: 'sink', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'active', to: 'sink', weight: 1 },
      // 'sink' has no outgoing transitions
    ];
    expect(() => computePageRank(nodes, transitions)).not.toThrow();
    const result = computePageRank(nodes, transitions);
    expect(result.size).toBe(2);
  });

  // ─── NaN / Infinity protection (new in this PR) ──────────────────────────────

  it('never produces NaN ranks even with extreme weights', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: Number.MAX_VALUE },
    ];
    const result = computePageRank(nodes, transitions);
    for (const [, v] of result) {
      expect(isNaN(v)).toBe(false);
      expect(isFinite(v)).toBe(true);
    }
  });

  it('never produces Infinity ranks', () => {
    const nodes: Node[] = [
      { id: 'x', rank: 0 },
      { id: 'y', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'x', to: 'y', weight: Infinity },
    ];
    const result = computePageRank(nodes, transitions);
    for (const [, v] of result) {
      expect(isFinite(v)).toBe(true);
    }
  });

  it('handles zero-weight transitions without division-by-zero', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
    ];
    // A transition with weight 0 → totalOutgoingWeight = 0
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: 0 },
    ];
    expect(() => computePageRank(nodes, transitions)).not.toThrow();
    const result = computePageRank(nodes, transitions);
    for (const [, v] of result) {
      expect(isNaN(v)).toBe(false);
    }
  });

  // ─── Damping factor ──────────────────────────────────────────────────────────

  it('respects custom damping factor', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'a', weight: 1 },
    ];
    // With d=0 all nodes converge to 1/N regardless of transitions
    const resultD0 = computePageRank(nodes, transitions, 0, 20);
    expect(resultD0.get('a')).toBeCloseTo(0.5, 4);
    expect(resultD0.get('b')).toBeCloseTo(0.5, 4);
  });

  // ─── Weighted transitions ────────────────────────────────────────────────────

  it('weights heavier outgoing transitions more strongly', () => {
    const nodes: Node[] = [
      { id: 'source', rank: 0 },
      { id: 'heavy', rank: 0 },
      { id: 'light', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'source', to: 'heavy', weight: 9 },
      { from: 'source', to: 'light', weight: 1 },
    ];
    const result = computePageRank(nodes, transitions, 0.85, 100);
    const heavyRank = result.get('heavy')!;
    const lightRank = result.get('light')!;
    expect(heavyRank).toBeGreaterThan(lightRank);
  });

  // ─── Return type ─────────────────────────────────────────────────────────────

  it('returns a Map with entries for every input node', () => {
    const nodes: Node[] = [
      { id: 'n1', rank: 0 },
      { id: 'n2', rank: 0 },
      { id: 'n3', rank: 0 },
    ];
    const result = computePageRank(nodes, []);
    expect(result.size).toBe(3);
    for (const node of nodes) {
      expect(result.has(node.id)).toBe(true);
    }
  });

  // ─── Edge: single node, self-loop ────────────────────────────────────────────

  it('handles a single-node self-loop gracefully', () => {
    const nodes: Node[] = [{ id: 'self', rank: 0 }];
    const transitions: Transition[] = [
      { from: 'self', to: 'self', weight: 1 },
    ];
    expect(() => computePageRank(nodes, transitions)).not.toThrow();
    const result = computePageRank(nodes, transitions);
    expect(result.get('self')).toBeCloseTo(1, 4);
  });
});