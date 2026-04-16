import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock fns are available inside vi.mock factory
const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

import { searchHybridMemory, saveMemory } from './vector';

describe('searchHybridMemory – input validation (PR change)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when embedding is not an array', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await searchHybridMemory(null as any);
    expect(result).toEqual([]);
    // Supabase should never be called
    expect(mockRpc).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns empty array when embedding is an empty array', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await searchHybridMemory([]);
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns empty array when embedding contains NaN values', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await searchHybridMemory([0.1, NaN, 0.3]);
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns empty array when embedding contains non-number values', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await searchHybridMemory([0.1, 'oops' as any, 0.3]);
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns empty array for a mix of valid numbers and null values', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await searchHybridMemory([0.1, null as any, 0.3]);
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('calls supabase RPC when embedding is valid', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const validEmbedding = Array.from({ length: 1536 }, () => Math.random());
    const result = await searchHybridMemory(validEmbedding);

    expect(mockRpc).toHaveBeenCalledWith('match_memory_vectors_ranked', expect.objectContaining({
      query_embedding: validEmbedding,
    }));
    expect(result).toEqual([]);
  });

  it('passes match_threshold and match_count options to RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const validEmbedding = [0.1, 0.2, 0.3];
    await searchHybridMemory(validEmbedding, { match_threshold: 0.8, match_count: 10 });

    expect(mockRpc).toHaveBeenCalledWith('match_memory_vectors_ranked', expect.objectContaining({
      match_threshold: 0.8,
      match_count: 10,
    }));
  });

  it('passes context to RPC when provided', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const validEmbedding = [0.5, 0.5];
    await searchHybridMemory(validEmbedding, { context: 'my-context' });

    expect(mockRpc).toHaveBeenCalledWith('match_memory_vectors_ranked', expect.objectContaining({
      target_context_name: 'my-context',
    }));
  });

  it('passes null as target_context_name when no context provided', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await searchHybridMemory([0.1, 0.2]);

    expect(mockRpc).toHaveBeenCalledWith('match_memory_vectors_ranked', expect.objectContaining({
      target_context_name: null,
    }));
  });

  it('returns empty array and does not throw when RPC returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpcError = { message: 'DB error', code: '42P01' };
    mockRpc.mockResolvedValueOnce({ data: null, error: rpcError });

    const result = await searchHybridMemory([0.1, 0.2, 0.3]);
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('returns data array when RPC succeeds', async () => {
    const fakeMemory = {
      id: 'mem-1',
      content: 'hello',
      metadata: {},
      similarity: 0.9,
      rank_score: 0.8,
      combined_score: 0.85,
      created_at: '2024-01-01T00:00:00Z',
    };
    mockRpc.mockResolvedValueOnce({ data: [fakeMemory], error: null });

    const result = await searchHybridMemory([0.1, 0.2, 0.3]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mem-1');
  });

  it('uses default options when none provided', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await searchHybridMemory([0.1, 0.2, 0.3]);

    expect(mockRpc).toHaveBeenCalledWith('match_memory_vectors_ranked', expect.objectContaining({
      match_threshold: 0.5,
      match_count: 5,
    }));
  });

  // Boundary / regression: all-zeros embedding should be valid
  it('accepts an all-zeros embedding as valid', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const zeros = new Array(1536).fill(0);
    const result = await searchHybridMemory(zeros);
    expect(mockRpc).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe('saveMemory – error handling (PR change)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildFromChain(overrides: {
    insertError?: any;
    insertData?: any;
    nodeError?: any;
  } = {}) {
    const selectSingle = vi.fn().mockResolvedValue({
      data: overrides.insertData ?? { id: 'mem-uuid-1', content: 'test', embedding: [] },
      error: overrides.insertError ?? null,
    });
    const selectFn = vi.fn().mockReturnValue({ single: selectSingle });
    const insertChain = vi.fn().mockReturnValue({ select: selectFn });

    const nodeInsert = vi.fn().mockResolvedValue({
      data: null,
      error: overrides.nodeError ?? null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'memory_vectors') {
        return { insert: insertChain };
      }
      if (table === 'agent_nodes') {
        return { insert: nodeInsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    return { insertChain, nodeInsert };
  }

  it('throws when memory insert fails (PR: now throws instead of swallowing)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    buildFromChain({ insertError: { message: 'insert failed' } });

    await expect(saveMemory('content', [0.1, 0.2])).rejects.toMatchObject({
      message: 'insert failed',
    });
    consoleSpy.mockRestore();
  });

  it('returns memory even when agent_nodes insert fails (PR: logs warning, does not throw)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildFromChain({ nodeError: { message: 'node insert failed' } });

    const result = await saveMemory('content', [0.1, 0.2], { source: 'test' });
    expect(result).toBeDefined();
    expect(result.id).toBe('mem-uuid-1');
    consoleSpy.mockRestore();
  });

  it('returns memory object on successful save', async () => {
    buildFromChain({
      insertData: { id: 'abc', content: 'hello world', embedding: [0.1] },
    });

    const result = await saveMemory('hello world', [0.1], { key: 'value' });
    expect(result.id).toBe('abc');
    expect(result.content).toBe('hello world');
  });

  it('calls memory_vectors insert with content, embedding, and metadata', async () => {
    const { insertChain } = buildFromChain();
    await saveMemory('test content', [0.5, 0.6], { tag: 'important' });

    expect(insertChain).toHaveBeenCalledWith(expect.objectContaining({
      content: 'test content',
      embedding: [0.5, 0.6],
      metadata: { tag: 'important' },
    }));
  });

  it('calls agent_nodes insert with memory node type and initial rank_score of 0.1', async () => {
    const { nodeInsert } = buildFromChain();
    await saveMemory('content', [1.0]);

    expect(nodeInsert).toHaveBeenCalledWith(expect.objectContaining({
      node_type: 'memory',
      rank_score: 0.1,
    }));
  });
});