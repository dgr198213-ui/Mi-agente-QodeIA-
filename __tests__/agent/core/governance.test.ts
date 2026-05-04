import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const { supabaseMock, computePageRankMock } = vi.hoisted(() => {
  const supabaseMock = {
    from: vi.fn(),
    rpc: vi.fn(),
  };
  const computePageRankMock = vi.fn();
  return { supabaseMock, computePageRankMock };
});

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

vi.mock('@/agent/core/pagerank', () => ({
  computePageRank: computePageRankMock,
}));

import { runGovernance, recordTransition, ensureToolNode } from '@/agent/core/governance';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ─── ensureToolNode ───────────────────────────────────────────────────────────

describe('ensureToolNode', () => {
  it('upserts to agent_nodes with correct node_key and node_type', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ upsert: upsertMock });

    await ensureToolNode('my-tool');

    expect(supabaseMock.from).toHaveBeenCalledWith('agent_nodes');
    expect(upsertMock).toHaveBeenCalledWith(
      { node_key: 'my-tool', node_type: 'tool', rank_score: 0.1 },
      { onConflict: 'node_key' },
    );
  });

  it('logs an error when upsert fails but does not throw', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: new Error('upsert failed') });
    supabaseMock.from.mockReturnValue({ upsert: upsertMock });

    await expect(ensureToolNode('bad-tool')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('logs an error when an unexpected exception occurs', async () => {
    supabaseMock.from.mockImplementation(() => { throw new Error('unexpected'); });

    await expect(ensureToolNode('crash-tool')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

// ─── recordTransition ─────────────────────────────────────────────────────────

describe('recordTransition', () => {
  function setupNodeQuery(nodesData: any[], error: any = null) {
    const inMock = vi.fn().mockResolvedValue({ data: nodesData, error });
    supabaseMock.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ in: inMock }),
    });
  }

  it('returns early and logs error when nodes query fails', async () => {
    setupNodeQuery([], new Error('nodes query failed'));
    await recordTransition('from-key', 'to-key');
    expect(console.error).toHaveBeenCalled();
  });

  it('calls ensureToolNode for missing nodes when count < 2', async () => {
    // Only one node returned
    setupNodeQuery([{ id: 'id-from', node_key: 'from-key' }]);
    // ensureToolNode calls will go through supabase.from
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ upsert: upsertMock });

    await recordTransition('from-key', 'to-key');
    expect(upsertMock).toHaveBeenCalled();
  });

  it('calls increment_transition_global RPC when both nodes exist', async () => {
    const nodesData = [
      { id: 'id-a', node_key: 'from-key' },
      { id: 'id-b', node_key: 'to-key' },
    ];
    setupNodeQuery(nodesData);

    supabaseMock.rpc.mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });

    await recordTransition('from-key', 'to-key');

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'increment_transition_global',
      expect.objectContaining({ p_from_node: 'id-a', p_to_node: 'id-b', p_increment: 1.0 }),
    );
  });

  it('calls increment_transition_ctx RPC when contextName is provided and context exists', async () => {
    const nodesData = [
      { id: 'id-a', node_key: 'from-key' },
      { id: 'id-b', node_key: 'to-key' },
    ];
    setupNodeQuery(nodesData);

    const ctxSingle = vi.fn().mockResolvedValue({ data: { id: 'ctx-id' }, error: null });
    supabaseMock.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: ctxSingle }),
      }),
    });

    supabaseMock.rpc.mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });

    await recordTransition('from-key', 'to-key', { contextName: 'my-ctx', userId: 'u1' });

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'increment_transition_ctx',
      expect.objectContaining({ p_from_node: 'id-a', p_to_node: 'id-b', p_context_id: 'ctx-id' }),
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'increment_transition_global',
      expect.objectContaining({ p_from_node: 'id-a', p_to_node: 'id-b' }),
    );
  });

  it('logs error when increment_transition_global RPC fails', async () => {
    const nodesData = [
      { id: 'id-a', node_key: 'from-key' },
      { id: 'id-b', node_key: 'to-key' },
    ];
    setupNodeQuery(nodesData);
    supabaseMock.rpc.mockResolvedValue({ error: new Error('rpc fail') });
    supabaseMock.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });

    await recordTransition('from-key', 'to-key');
    expect(console.error).toHaveBeenCalled();
  });

  it('skips increment_transition_ctx RPC when contextName is given but context not found', async () => {
    const nodesData = [
      { id: 'id-a', node_key: 'from-key' },
      { id: 'id-b', node_key: 'to-key' },
    ];
    setupNodeQuery(nodesData);

    // Context query returns null data (context not found)
    const ctxSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    supabaseMock.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: ctxSingle }),
      }),
    });

    supabaseMock.rpc.mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });

    await recordTransition('from-key', 'to-key', { contextName: 'ghost-ctx' });

    // increment_transition_ctx should NOT be called; only global should be
    const ctxRpcCalls = supabaseMock.rpc.mock.calls.filter(
      ([name]: [string]) => name === 'increment_transition_ctx'
    );
    expect(ctxRpcCalls).toHaveLength(0);
    // Global should still be called
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'increment_transition_global',
      expect.objectContaining({ p_from_node: 'id-a', p_to_node: 'id-b' }),
    );
  });

  it('inserts an audit record with correct fields', async () => {
    const nodesData = [
      { id: 'id-a', node_key: 'from-key' },
      { id: 'id-b', node_key: 'to-key' },
    ];
    setupNodeQuery(nodesData);
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ insert: insertMock });

    await recordTransition('from-key', 'to-key', { userId: 'user-123' });

    expect(supabaseMock.from).toHaveBeenCalledWith('agent_governance_audit');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'record_transition',
        user_id: 'user-123',
        metadata: expect.objectContaining({ from_key: 'from-key', to_key: 'to-key' }),
      }),
    );
  });
});

// ─── runGovernance ────────────────────────────────────────────────────────────

describe('runGovernance', () => {
  it('returns early when there are no nodes', async () => {
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    await runGovernance();
    expect(computePageRankMock).not.toHaveBeenCalled();
  });

  it('returns early when nodes array is null', async () => {
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    await runGovernance();
    expect(computePageRankMock).not.toHaveBeenCalled();
  });

  it('logs and does not throw when nodes fetch fails', async () => {
    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: new Error('db down') }),
    });
    await expect(runGovernance()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('calls computePageRank with default damping factor 0.85 when no governance config', async () => {
    computePageRankMock.mockReturnValue(new Map());

    let callIdx = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      callIdx++;
      if (table === 'agent_nodes' && callIdx === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'n1', rank_score: 0.1 }],
            error: null,
          }),
        };
      }
      if (table === 'agent_transitions') {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }
      if (table === 'agent_governance') {
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    await runGovernance();
    expect(computePageRankMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      0.85,
    );
  });

  it('calls computePageRank with custom damping factor from governance config', async () => {
    computePageRankMock.mockReturnValue(new Map());

    let callIdx = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      callIdx++;
      if (table === 'agent_nodes' && callIdx === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'n1', rank_score: 0.1 }],
            error: null,
          }),
        };
      }
      if (table === 'agent_transitions') {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }
      if (table === 'agent_governance') {
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { damping_factor: 0.7 }, error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    await runGovernance();
    expect(computePageRankMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      0.7,
    );
  });

  it('passes userId to audit insert', async () => {
    computePageRankMock.mockReturnValue(new Map());
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null });

    let callIdx = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      callIdx++;
      if (table === 'agent_nodes' && callIdx === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'n1', rank_score: 0.1 }],
            error: null,
          }),
        };
      }
      if (table === 'agent_transitions') {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }
      if (table === 'agent_governance') {
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: auditInsertMock };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    await runGovernance({ userId: 'user-xyz' });

    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-xyz', action: 'run_governance' }),
    );
  });

  it('upserts to agent_node_ranks (not agent_nodes) when contextName is provided', async () => {
    computePageRankMock.mockReturnValue(new Map([['n1', 0.5]]));

    let callIdx = 0;
    const upsertRanksMock = vi.fn().mockResolvedValue({ error: null });

    supabaseMock.from.mockImplementation((table: string) => {
      callIdx++;
      if (table === 'agent_nodes' && callIdx === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'n1', rank_score: 0.1 }],
            error: null,
          }),
        };
      }
      if (table === 'agent_contexts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ctx-99' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'agent_transitions_ctx') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'agent_governance_ctx') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { damping_factor: 0.85 }, error: null }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'agent_node_ranks') {
        return { upsert: upsertRanksMock };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    await runGovernance({ contextName: 'my-context' });

    expect(upsertRanksMock).toHaveBeenCalledWith(
      expect.objectContaining({ node_id: 'n1', context_id: 'ctx-99', rank_score: 0.5 }),
    );
  });

  it('does not throw when transitions fetch fails (caught internally)', async () => {
    let callIdx = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      callIdx++;
      if (table === 'agent_nodes' && callIdx === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'n1', rank_score: 0.1 }],
            error: null,
          }),
        };
      }
      if (table === 'agent_transitions') {
        return {
          select: vi.fn().mockResolvedValue({ data: null, error: new Error('trans fail') }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await expect(runGovernance()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('throws and logs error when context is not found during context governance', async () => {
    let callIdx = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      callIdx++;
      if (table === 'agent_nodes' && callIdx === 1) {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'n1', rank_score: 0.1 }],
            error: null,
          }),
        };
      }
      if (table === 'agent_contexts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    await expect(runGovernance({ contextName: 'nonexistent' })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});