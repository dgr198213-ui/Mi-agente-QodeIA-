jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// Mock computePageRank so governance tests don't depend on pagerank internals
jest.mock('../agent/core/pagerank', () => ({
  computePageRank: jest.fn(() => new Map([['node-1', 0.5], ['node-2', 0.5]])),
}));

import { runGovernance, recordTransition, ensureToolNode } from '../agent/core/governance';
import { supabase } from '../lib/supabase';
import { computePageRank } from '../agent/core/pagerank';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockComputePageRank = computePageRank as jest.Mock;

// Helper to build a fluent Supabase query builder mock
function makeQueryBuilder(result: any) {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: undefined,
  };
  // make it thenable so awaiting it resolves to result
  builder.then = undefined;
  return builder;
}

describe('runGovernance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputePageRank.mockReturnValue(new Map([['node-1', 0.6], ['node-2', 0.4]]));
  });

  it('accepts empty options object (new signature)', async () => {
    // Should not throw
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'no nodes' } }),
    });
    await expect(runGovernance({})).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('accepts contextName and userId options', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });
    await expect(runGovernance({ contextName: 'ctx', userId: 'user-1' })).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('returns early when nodes list is empty', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    await runGovernance();
    // computePageRank should NOT be called since there are no nodes
    expect(mockComputePageRank).not.toHaveBeenCalled();
  });

  it('returns early when nodes data is null', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    await runGovernance();
    expect(mockComputePageRank).not.toHaveBeenCalled();
  });

  it('logs and throws internal error if nodesError occurs (caught at top level)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } }),
    });
    // runGovernance catches all errors and logs them
    await expect(runGovernance()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('logs structured error when nodes query fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });
    await runGovernance();
    const logArg = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logArg);
    expect(parsed.level).toBe('error');
    expect(parsed.module).toBe('governance');
    consoleSpy.mockRestore();
  });
});

describe('recordTransition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts new options object signature with contextName and userId', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Return error to short-circuit
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });
    await expect(
      recordTransition('toolA', 'toolB', { contextName: 'ctx', userId: 'u-1' })
    ).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('accepts empty options (backward compat with no args)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });
    await expect(recordTransition('a', 'b')).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('returns early and logs when nodes query returns an error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: null, error: { message: 'query error' } }),
    });
    await recordTransition('fromKey', 'toKey');
    expect(consoleSpy).toHaveBeenCalled();
    const logArg = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logArg);
    expect(parsed.level).toBe('error');
    consoleSpy.mockRestore();
  });

  it('returns early when fewer than 2 nodes are found and triggers ensureToolNode', async () => {
    // First call: nodes query returns only 1 node (or 0)
    const upsertFn = jest.fn().mockResolvedValue({ error: null });
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        callCount++;
        if (callCount === 1) {
          // First call: in() query returning only 1 node
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [{ id: 'id-1', node_key: 'fromKey' }], error: null }),
            upsert: upsertFn,
          };
        }
        // Subsequent calls: upsert for ensureToolNode
        return { upsert: upsertFn };
      }
      return {};
    });

    await recordTransition('fromKey', 'missingKey');
    // ensureToolNode should have been called to create missing node
    expect(upsertFn).toHaveBeenCalled();
  });

  it('calls global RPC when both nodes exist', async () => {
    const fromNode = { id: 'from-id', node_key: 'toolA' };
    const toNode = { id: 'to-id', node_key: 'toolB' };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [fromNode, toNode], error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockRpc.mockResolvedValue({ error: null });

    await recordTransition('toolA', 'toolB');

    expect(mockRpc).toHaveBeenCalledWith('increment_transition_global', {
      p_from_node: 'from-id',
      p_to_node: 'to-id',
      p_increment: 1.0,
    });
  });

  it('calls context RPC when contextName is provided and context exists', async () => {
    const fromNode = { id: 'from-id', node_key: 'toolA' };
    const toNode = { id: 'to-id', node_key: 'toolB' };
    const ctx = { id: 'ctx-id' };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [fromNode, toNode], error: null }),
        };
      }
      if (table === 'agent_contexts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: ctx, error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockRpc.mockResolvedValue({ error: null });

    await recordTransition('toolA', 'toolB', { contextName: 'myCtx', userId: 'u-1' });

    expect(mockRpc).toHaveBeenCalledWith('increment_transition_ctx', {
      p_from_node: 'from-id',
      p_to_node: 'to-id',
      p_context_id: 'ctx-id',
      p_increment: 1.0,
    });
  });

  it('logs error but does not throw when global RPC fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fromNode = { id: 'from-id', node_key: 'toolA' };
    const toNode = { id: 'to-id', node_key: 'toolB' };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_nodes') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [fromNode, toNode], error: null }),
        };
      }
      if (table === 'agent_governance_audit') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockRpc.mockResolvedValue({ error: { message: 'rpc failed' } });

    await expect(recordTransition('toolA', 'toolB')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('ensureToolNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls supabase.from("agent_nodes").upsert with correct data', async () => {
    const upsertFn = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertFn });

    await ensureToolNode('my-tool');

    expect(mockFrom).toHaveBeenCalledWith('agent_nodes');
    expect(upsertFn).toHaveBeenCalledWith(
      {
        node_key: 'my-tool',
        node_type: 'tool',
        rank_score: 0.1,
      },
      { onConflict: 'node_key' }
    );
  });

  it('sets rank_score to 0.1 as initial score', async () => {
    const upsertFn = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertFn });

    await ensureToolNode('any-tool');
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ rank_score: 0.1 }),
      expect.any(Object)
    );
  });

  it('logs error but does not throw when upsert fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const upsertFn = jest.fn().mockResolvedValue({ error: { message: 'conflict' } });
    mockFrom.mockReturnValue({ upsert: upsertFn });

    await expect(ensureToolNode('some-tool')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('logs error but does not throw when upsert throws unexpectedly', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const upsertFn = jest.fn().mockRejectedValue(new Error('unexpected'));
    mockFrom.mockReturnValue({ upsert: upsertFn });

    await expect(ensureToolNode('boom-tool')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('logs structured error message with tool key when upsert fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFrom.mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: { message: 'oops' } }) });

    await ensureToolNode('special-tool');

    const logArg = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logArg);
    expect(parsed.level).toBe('error');
    expect(parsed.module).toBe('governance');
    expect(parsed.message).toContain('special-tool');
    consoleSpy.mockRestore();
  });

  it('uses onConflict: node_key for upsert (idempotent)', async () => {
    const upsertFn = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertFn });

    await ensureToolNode('tool');
    expect(upsertFn).toHaveBeenCalledWith(
      expect.any(Object),
      { onConflict: 'node_key' }
    );
  });
});