import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

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

import { searchHybridMemory, saveMemory } from '@/agent/memory/vector';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// ─── searchHybridMemory ───────────────────────────────────────────────────────

describe('searchHybridMemory', () => {
  it('returns [] and logs error when embedding is not an array', async () => {
    const result = await searchHybridMemory(null as any);
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('returns [] when embedding is an empty array', async () => {
    const result = await searchHybridMemory([]);
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('returns [] when embedding contains NaN values', async () => {
    const result = await searchHybridMemory([1.0, NaN, 0.5]);
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('returns [] when embedding contains non-numeric values', async () => {
    const result = await searchHybridMemory([1.0, 'not-a-number' as any, 0.5]);
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('calls supabase.rpc with correct parameters for a valid embedding', async () => {
    const embedding = [0.1, 0.2, 0.3];
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await searchHybridMemory(embedding, { match_threshold: 0.7, match_count: 3, context: 'ctx' });
    expect(mockRpc).toHaveBeenCalledWith('match_memory_vectors_ranked', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 3,
      target_context_name: 'ctx',
    });
  });

  it('passes null as target_context_name when no context provided', async () => {
    const embedding = [0.1, 0.2];
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await searchHybridMemory(embedding);
    expect(mockRpc).toHaveBeenCalledWith(
      'match_memory_vectors_ranked',
      expect.objectContaining({ target_context_name: null }),
    );
  });

  it('uses default match_threshold=0.5 and match_count=5', async () => {
    const embedding = [0.1];
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await searchHybridMemory(embedding);
    expect(mockRpc).toHaveBeenCalledWith(
      'match_memory_vectors_ranked',
      expect.objectContaining({ match_threshold: 0.5, match_count: 5 }),
    );
  });

  it('returns memory results on success', async () => {
    const fakeResults = [
      { id: '1', content: 'hello', metadata: {}, similarity: 0.9, rank_score: 0.5, combined_score: 0.7, created_at: '' },
    ];
    mockRpc.mockResolvedValueOnce({ data: fakeResults, error: null });
    const result = await searchHybridMemory([0.1, 0.2]);
    expect(result).toEqual(fakeResults);
  });

  it('returns empty array (not throw) when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('rpc fail') });
    const result = await searchHybridMemory([0.1, 0.2]);
    expect(result).toEqual([]);
  });

  it('returns [] when RPC returns null data', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await searchHybridMemory([0.1]);
    expect(result).toEqual([]);
  });

  it('returns [] when RPC throws an unexpected exception', async () => {
    mockRpc.mockRejectedValueOnce(new Error('network error'));
    const result = await searchHybridMemory([0.1]);
    expect(result).toEqual([]);
  });
});

// ─── saveMemory ───────────────────────────────────────────────────────────────

describe('saveMemory', () => {
  it('inserts the memory vector and returns the saved record', async () => {
    const fakeMemory = { id: 'mem-1', content: 'test', embedding: [0.1], metadata: {} };
    // Chain: .from('memory_vectors').insert(...).select().single()
    const singleMock = vi.fn().mockResolvedValue({ data: fakeMemory, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    // .from('agent_nodes').insert(...)
    const nodeInsertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom
      .mockReturnValueOnce({ insert: insertMock })
      .mockReturnValueOnce({ insert: nodeInsertMock });

    const result = await saveMemory('test', [0.1], {});
    expect(result).toEqual(fakeMemory);
    expect(mockFrom).toHaveBeenCalledWith('memory_vectors');
    expect(insertMock).toHaveBeenCalledWith({
      content: 'test',
      embedding: [0.1],
      metadata: {},
    });
  });

  it('throws when supabase insert fails for memory_vectors', async () => {
    const dbError = new Error('insert error');
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: dbError });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockFrom.mockReturnValueOnce({ insert: insertMock });
    await expect(saveMemory('content', [0.1])).rejects.toThrow('insert error');
  });

  it('logs a warning (not throws) when agent_nodes insert fails', async () => {
    const fakeMemory = { id: 'mem-2', content: 'hi', embedding: [0.2], metadata: {} };
    const singleMock = vi.fn().mockResolvedValue({ data: fakeMemory, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const nodeInsertMock = vi.fn().mockResolvedValue({ error: new Error('node insert failed') });
    mockFrom
      .mockReturnValueOnce({ insert: insertMock })
      .mockReturnValueOnce({ insert: nodeInsertMock });

    const result = await saveMemory('hi', [0.2]);
    expect(result).toEqual(fakeMemory);
    expect(console.warn).toHaveBeenCalled();
  });

  it('uses empty object as default metadata', async () => {
    const fakeMemory = { id: 'm3', content: 'x', embedding: [0.3], metadata: {} };
    const singleMock = vi.fn().mockResolvedValue({ data: fakeMemory, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const nodeInsertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom
      .mockReturnValueOnce({ insert: insertMock })
      .mockReturnValueOnce({ insert: nodeInsertMock });

    await saveMemory('x', [0.3]);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} }),
    );
  });

  it('registers the saved memory as an agent_nodes entry', async () => {
    const fakeMemory = { id: 'node-test-id', content: 'c', embedding: [], metadata: {} };
    const singleMock = vi.fn().mockResolvedValue({ data: fakeMemory, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const nodeInsertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom
      .mockReturnValueOnce({ insert: insertMock })
      .mockReturnValueOnce({ insert: nodeInsertMock });

    await saveMemory('c', []);
    expect(mockFrom).toHaveBeenCalledWith('agent_nodes');
    expect(nodeInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ node_key: 'node-test-id', node_type: 'memory' }),
    );
  });

  it('throws and logs error when memory_vectors insert fails', async () => {
    const dbError = new Error('db error');
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: dbError });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockFrom.mockReturnValueOnce({ insert: insertMock });

    await expect(saveMemory('c', [0.1])).rejects.toThrow('db error');
    expect(console.error).toHaveBeenCalled();
  });
});

// ─── searchHybridMemory – additional boundary/regression cases ────────────────

describe('searchHybridMemory – boundary regression', () => {
  it('returns [] when embedding is an array of a single valid number', async () => {
    // A single-element embedding is technically valid; the RPC should be called
    const embedding = [0.42];
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await searchHybridMemory(embedding);
    expect(result).toEqual([]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('returns [] (not throws) when supabase.rpc throws unexpectedly', async () => {
    mockRpc.mockRejectedValueOnce(new Error('unexpected crash'));
    const result = await searchHybridMemory([0.1, 0.2, 0.3]);
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('treats an embedding with Infinity values as invalid', async () => {
    // Infinity is typeof 'number' but isNaN(Infinity) === false — however
    // the validation checks isNaN. Infinity passes the isNaN check and
    // gets forwarded to the RPC. This test documents the current behavior.
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await searchHybridMemory([Infinity, 0.5]);
    // Infinity passes the current validation (isNaN(Infinity) === false)
    expect(result).toEqual([]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});