import { describe, it, expect } from 'vitest';
import { computePageRank, Node, Transition } from './pagerank';

describe('computePageRank', () => {
  // --- Basic correctness ---

  it('returns empty map for empty nodes', () => {
    const result = computePageRank([], []);
    expect(result.size).toBe(0);
  });

  it('returns uniform rank for single node with no transitions', () => {
    const nodes: Node[] = [{ id: 'a', rank: 0 }];
    const result = computePageRank(nodes, []);
    expect(result.get('a')).toBeCloseTo(1.0, 5);
  });

  it('distributes rank uniformly across isolated nodes with no transitions', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
      { id: 'c', rank: 0 },
    ];
    const result = computePageRank(nodes, []);
    // All are sinks, so rank redistributes uniformly
    expect(result.get('a')).toBeCloseTo(result.get('b')!, 5);
    expect(result.get('b')).toBeCloseTo(result.get('c')!, 5);
  });

  it('ranks sum to approximately 1 for a connected graph', () => {
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
    const total = [...result.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 3);
  });

  it('gives higher rank to node with more incoming links', () => {
    // 'hub' receives links from both 'a' and 'b'; 'a' and 'b' only link to 'hub'
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
      { id: 'hub', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'a', to: 'hub', weight: 1 },
      { from: 'b', to: 'hub', weight: 1 },
    ];
    const result = computePageRank(nodes, transitions);
    expect(result.get('hub')!).toBeGreaterThan(result.get('a')!);
    expect(result.get('hub')!).toBeGreaterThan(result.get('b')!);
  });

  // --- PR #changes: invalid transition filtering ---

  it('filters out transitions that reference non-existent nodes', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
    ];
    // 'x' and 'y' do not exist in the node list
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: 1 },
      { from: 'x', to: 'b', weight: 5 },   // invalid from
      { from: 'a', to: 'y', weight: 5 },   // invalid to
    ];
    const result = computePageRank(nodes, transitions);
    // Should not throw, should return valid ranks
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('filters out all transitions when all nodes are invalid, returning uniform ranks', () => {
    const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
    const transitions: Transition[] = [
      { from: 'ghost', to: 'spectre', weight: 10 },
    ];
    const result = computePageRank(nodes, transitions);
    // No valid transitions; both are sinks so ranks are distributed uniformly
    expect(result.get('a')).toBeCloseTo(result.get('b')!, 5);
  });

  // --- PR #changes: NaN / Infinity safeguard ---

  it('returns finite ranks even with zero-weight transitions', () => {
    const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: 0 },
    ];
    const result = computePageRank(nodes, transitions);
    for (const [, score] of result) {
      expect(isFinite(score)).toBe(true);
      expect(isNaN(score)).toBe(false);
    }
  });

  it('never produces NaN or Infinite ranks regardless of inputs', () => {
    const nodes: Node[] = [
      { id: '1', rank: 0 },
      { id: '2', rank: 0 },
      { id: '3', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: '1', to: '2', weight: 0 },
      { from: '2', to: '3', weight: 0 },
    ];
    const result = computePageRank(nodes, transitions);
    for (const score of result.values()) {
      expect(Number.isFinite(score)).toBe(true);
    }
  });

  // --- PR #changes: sinkRank uses || 0 (null safety) ---

  it('handles single-node sink correctly (no outgoing transitions)', () => {
    const nodes: Node[] = [{ id: 'sink', rank: 0 }];
    const transitions: Transition[] = [];
    const result = computePageRank(nodes, transitions);
    const rank = result.get('sink')!;
    expect(rank).toBeGreaterThan(0);
    expect(isFinite(rank)).toBe(true);
  });

  // --- Damping factor parameter ---

  it('respects custom damping factor (d=0 = uniform distribution)', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
      { id: 'c', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'c', weight: 1 },
    ];
    const result = computePageRank(nodes, transitions, 0, 20);
    // With d=0, formula is (1-0)/N = 1/3 for all nodes
    for (const score of result.values()) {
      expect(score).toBeCloseTo(1 / 3, 3);
    }
  });

  it('uses 20 iterations by default and converges on a simple chain', () => {
    const nodes: Node[] = [
      { id: 'a', rank: 0 },
      { id: 'b', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'a', weight: 1 },
    ];
    const result = computePageRank(nodes, transitions);
    // Symmetric graph → equal ranks
    expect(result.get('a')).toBeCloseTo(result.get('b')!, 5);
  });

  // --- Weight influence ---

  it('proportionally increases rank for higher-weight incoming transitions', () => {
    const nodes: Node[] = [
      { id: 'src', rank: 0 },
      { id: 'highPriority', rank: 0 },
      { id: 'lowPriority', rank: 0 },
    ];
    const transitions: Transition[] = [
      { from: 'src', to: 'highPriority', weight: 10 },
      { from: 'src', to: 'lowPriority', weight: 1 },
    ];
    const result = computePageRank(nodes, transitions);
    expect(result.get('highPriority')!).toBeGreaterThan(result.get('lowPriority')!);
  });

  // --- Custom iterations ---

  it('accepts custom iterations parameter', () => {
    const nodes: Node[] = [{ id: 'a', rank: 0 }, { id: 'b', rank: 0 }];
    const transitions: Transition[] = [{ from: 'a', to: 'b', weight: 1 }];
    // Should not throw with iterations = 1
    const result = computePageRank(nodes, transitions, 0.85, 1);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('returns a map with exactly N entries equal to the number of nodes', () => {
    const nodes: Node[] = [
      { id: 'x', rank: 0 },
      { id: 'y', rank: 0 },
      { id: 'z', rank: 0 },
    ];
    const result = computePageRank(nodes, []);
    expect(result.size).toBe(3);
  });

  // --- Regression: mixed valid + invalid transitions ---
  it('correctly computes rank when some transitions are invalid (regression)', () => {
    const nodes: Node[] = [
      { id: 'toolA', rank: 0.1 },
      { id: 'toolB', rank: 0.1 },
    ];
    const transitions: Transition[] = [
      { from: 'toolA', to: 'toolB', weight: 3 },
      { from: 'ghost', to: 'toolB', weight: 999 },  // invalid - should be ignored
    ];
    const result = computePageRank(nodes, transitions);
    // toolB should still receive rank from toolA
    expect(result.get('toolB')!).toBeGreaterThan(result.get('toolA')!);
  });
});