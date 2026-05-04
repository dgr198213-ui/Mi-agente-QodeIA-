import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock fns are available inside vi.mock factory
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('./pagerank', () => ({
  computePageRank: vi.fn().mockReturnValue(new Map([['node-1', 0.5], ['node-2', 0.3]])),
}));

import { ensureToolNode, recordTransition, runGovernance } from './governance';
import { computePageRank } from './pagerank';

// ======================================================
// ensureToolNode
// ======================================================
describe('ensureToolNode – PR changes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls supabase upsert with correct data for tool node', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertFn });

    await ensureToolNode('my-tool');

    expect(upsertFn).toHaveBeenCalledWith(
      { node_key: 'my-tool', node_type: 'tool', rank_score: 0.1 },
      { onConflict: 'node_key' }
    );
  });

  it('does not throw when upsert succeeds', async () => {
    mockFrom.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) });
    await expect(ensureToolNode('tool-ok')).resolves.toBeUndefined();
  });

  it('logs error but does not throw when upsert returns an error (PR change)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const upsertFn = vi.fn().mockResolvedValue({ error: { message: 'upsert failed' } });
    mockFrom.mockReturnValue({ upsert: upsertFn });

    await expect(ensureToolNode('bad-tool')).resolves.toBeUndefined(); // no throw
    expect(consoleSpy).toHaveBeenCalled();
    const logArg = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logArg);
    expect(parsed.level).toBe('error');
    expect(parsed.module).toBe('governance');
    consoleSpy.mockRestore();
  });

  it('logs error but does not throw when upsert throws (unexpected error)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockRejectedValue(new Error('network down')),
    });

    await expect(ensureToolNode('throwing-tool')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('logs structured JSON with correct fields on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const upsertError = { message: 'conflict' };
    mockFrom.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: upsertError }) });

    await ensureToolNode('conflict-tool');

    const logArg = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logArg);
    expect(parsed).toMatchObject({
      level: 'error',
      module: 'governance',
    });
    expect(parsed.timestamp).toBeDefined();
    consoleSpy.mockRestore();
  });
});

// ======================================================
// recordTransition – PR changes
// ======================================================
describe('recordTransition – PR changes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs error and returns early when nodes query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB unreachable' } }),
    });

    await expect(recordTransition('toolA', 'toolB')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns early when fewer than 2 nodes are found, calling ensureToolNode', async () => {
    // Only one node found (missing the second)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'id-a', node_key: 'toolA' }],
            error: null,
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { upsert: vi.fn().mockResolvedValue({ error: null }) };
    });

    await expect(recordTransition('toolA', 'toolB')).resolves.toBeUndefined();
    // No RPC calls should have been made
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls increment_transition_global RPC when both nodes exist', async () => {
    const nodes = [
      { id: 'id-a', node_key: 'toolA' },
      { id: 'id-b', node_key: 'toolB' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: nodes, error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockRpc.mockResolvedValue({ error: null });

    await recordTransition('toolA', 'toolB');

    expect(mockRpc).toHaveBeenCalledWith('increment_transition_global', expect.objectContaining({
      p_from_node: 'id-a',
      p_to_node: 'id-b',
      p_increment: 1.0,
    }));
  });

  it('calls increment_transition_ctx RPC when contextName is provided', async () => {
    const nodes = [
      { id: 'id-a', node_key: 'toolA' },
      { id: 'id-b', node_key: 'toolB' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: nodes, error: null }),
        };
      }
      if (table === 'agent_contexts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'ctx-id' }, error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockRpc.mockResolvedValue({ error: null });

    await recordTransition('toolA', 'toolB', { contextName: 'coding' });

    const rpcCalls = mockRpc.mock.calls.map((c) => c[0]);
    expect(rpcCalls).toContain('increment_transition_ctx');
    expect(rpcCalls).toContain('increment_transition_global');
  });

  it('logs error but continues when contextual RPC fails (PR: does not throw)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const nodes = [
      { id: 'id-a', node_key: 'toolA' },
      { id: 'id-b', node_key: 'toolB' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: nodes, error: null }),
        };
      }
      if (table === 'agent_contexts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'ctx-id' }, error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    // Context RPC fails, global RPC succeeds
    mockRpc.mockImplementation((name: string) => {
      if (name === 'increment_transition_ctx') {
        return Promise.resolve({ error: { message: 'rpc failed' } });
      }
      return Promise.resolve({ error: null });
    });

    await expect(
      recordTransition('toolA', 'toolB', { contextName: 'coding' })
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('inserts audit record with action=record_transition', async () => {
    const nodes = [
      { id: 'id-a', node_key: 'toolA' },
      { id: 'id-b', node_key: 'toolB' },
    ];
    const auditInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: nodes, error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: auditInsert };
      }
      return {};
    });

    mockRpc.mockResolvedValue({ error: null });

    await recordTransition('toolA', 'toolB', { userId: 'user-123' });

    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'record_transition',
      user_id: 'user-123',
    }));
  });
});

// ======================================================
// runGovernance – option signature change (PR)
// ======================================================
describe('runGovernance – PR option signature change', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns early without error when no nodes exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    await expect(runGovernance()).resolves.toBeUndefined();
    expect(computePageRank).not.toHaveBeenCalled();
  });

  it('catches and logs error when nodes query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: 'nodes query failed' } }),
    });

    await expect(runGovernance()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('accepts new options object instead of plain contextName string (PR change)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: vi.fn().mockResolvedValue({ data: null, error: { message: 'forced early exit' } }),
        };
      }
      return {};
    });

    // Should not throw with new signature
    await expect(runGovernance({ contextName: 'coding', userId: 'u-1' }))
      .resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('catches error inside catch block when context is not found', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const nodesData = [{ id: 'n1', rank_score: 0.5 }];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: vi.fn().mockResolvedValue({ data: nodesData, error: null }),
        };
      }
      if (table === 'agent_contexts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        };
      }
      return {};
    });

    // runGovernance catches the error internally, so it should resolve (not reject)
    await expect(runGovernance({ contextName: 'missing-ctx' })).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('accepts no options (global governance) with new signature', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    await expect(runGovernance({})).resolves.toBeUndefined();
    await expect(runGovernance()).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });
});

// ======================================================
// Logging helpers (via observable side-effects)
// ======================================================
describe('governance structured logging (PR change)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logError outputs JSON with level=error and module=governance', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: 'fail' } }) });

    await ensureToolNode('log-test-tool');

    expect(consoleSpy).toHaveBeenCalled();
    const raw = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe('error');
    expect(parsed.module).toBe('governance');
    expect(typeof parsed.timestamp).toBe('string');
    consoleSpy.mockRestore();
  });

  it('logError includes error.message when error is an Error instance', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockRejectedValue(new Error('boom!')),
    });

    await ensureToolNode('error-instance-tool');

    const raw = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(raw);
    expect(parsed.error).toBe('boom!');
    consoleSpy.mockRestore();
  });
});