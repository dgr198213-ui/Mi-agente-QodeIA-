// Mock the supabase module before importing anything that uses it
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

import { searchHybridMemory, saveMemory } from '../agent/memory/vector';
import { supabase } from '../lib/supabase';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('searchHybridMemory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('input validation', () => {
    it('returns empty array and logs error when embedding is not an array', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await searchHybridMemory(null as any);
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns empty array when embedding is an empty array', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await searchHybridMemory([]);
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns empty array when embedding contains NaN values', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await searchHybridMemory([0.1, NaN, 0.3]);
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns empty array when embedding contains string values', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await searchHybridMemory([0.1, 'bad' as any, 0.3]);
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('does not call supabase.rpc when embedding is invalid', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      await searchHybridMemory([]);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  describe('successful search', () => {
    const validEmbedding = Array.from({ length: 10 }, (_, i) => i * 0.1);

    it('calls supabase.rpc with correct parameters', async () => {
      const mockData = [{ id: '1', content: 'test', similarity: 0.9 }];
      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: mockData, error: null });

      await searchHybridMemory(validEmbedding, { match_threshold: 0.7, match_count: 3, context: 'myCtx' });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('match_memory_vectors_ranked', {
        query_embedding: validEmbedding,
        match_threshold: 0.7,
        match_count: 3,
        target_context_name: 'myCtx',
      });
    });

    it('uses default options when none are provided', async () => {
      const mockData: any[] = [];
      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: mockData, error: null });

      await searchHybridMemory(validEmbedding);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('match_memory_vectors_ranked', {
        query_embedding: validEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        target_context_name: null,
      });
    });

    it('returns data returned by supabase.rpc', async () => {
      const mockData = [
        { id: '1', content: 'hello', similarity: 0.95, rank_score: 0.8, combined_score: 0.9, metadata: {}, created_at: '2024-01-01' },
      ];
      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: mockData, error: null });

      const result = await searchHybridMemory(validEmbedding);
      expect(result).toEqual(mockData);
    });

    it('returns empty array when supabase.rpc returns null data', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
      const result = await searchHybridMemory(validEmbedding);
      expect(result).toEqual([]);
    });

    it('passes null as context when context option is not provided', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });
      await searchHybridMemory(validEmbedding, { context: undefined });
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'match_memory_vectors_ranked',
        expect.objectContaining({ target_context_name: null })
      );
    });
  });

  describe('error handling', () => {
    const validEmbedding = Array.from({ length: 10 }, (_, i) => i * 0.1);

    it('returns empty array when supabase.rpc returns an error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await searchHybridMemory(validEmbedding);
      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('returns empty array when supabase.rpc throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (mockSupabase.rpc as jest.Mock).mockRejectedValueOnce(new Error('network failure'));

      const result = await searchHybridMemory(validEmbedding);
      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('logs structured error when rpc returns error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      await searchHybridMemory(validEmbedding);

      const errorCall = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(errorCall);
      expect(parsed.level).toBe('error');
      expect(parsed.module).toBe('memory-vector');
      consoleSpy.mockRestore();
    });
  });
});

describe('saveMemory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validEmbedding = [0.1, 0.2, 0.3];
  const content = 'test memory content';
  const metadata = { source: 'test' };

  function makeChain(overrides: {
    insertResult?: any;
    insertNodeResult?: any;
  } = {}) {
    const selectSingle = jest.fn().mockResolvedValue(
      overrides.insertResult ?? { data: { id: 'mem-uuid', content, embedding: validEmbedding, metadata }, error: null }
    );
    const selectFn = jest.fn().mockReturnValue({ single: selectSingle });
    const insertMemory = jest.fn().mockReturnValue({ select: selectFn });

    const insertNode = jest.fn().mockResolvedValue(
      overrides.insertNodeResult ?? { error: null }
    );

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'memory_vectors') return { insert: insertMemory };
      if (table === 'agent_nodes') return { insert: insertNode };
      return {};
    });

    return { insertMemory, insertNode, selectSingle };
  }

  it('inserts the memory vector into memory_vectors table', async () => {
    const { insertMemory } = makeChain();
    await saveMemory(content, validEmbedding, metadata);
    expect(mockSupabase.from).toHaveBeenCalledWith('memory_vectors');
    expect(insertMemory).toHaveBeenCalledWith({ content, embedding: validEmbedding, metadata });
  });

  it('registers the memory as a node in agent_nodes', async () => {
    const { insertNode } = makeChain();
    await saveMemory(content, validEmbedding, metadata);
    expect(mockSupabase.from).toHaveBeenCalledWith('agent_nodes');
    expect(insertNode).toHaveBeenCalledWith(
      expect.objectContaining({ node_type: 'memory', rank_score: 0.1 })
    );
  });

  it('returns the saved memory object', async () => {
    makeChain();
    const result = await saveMemory(content, validEmbedding, metadata);
    expect(result).toMatchObject({ id: 'mem-uuid', content });
  });

  it('uses empty object as default metadata', async () => {
    const { insertMemory } = makeChain();
    await saveMemory(content, validEmbedding);
    expect(insertMemory).toHaveBeenCalledWith({ content, embedding: validEmbedding, metadata: {} });
  });

  it('throws when memory_vectors insert fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dbError = { message: 'insert failed', code: '23505' };

    const selectSingle = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const selectFn = jest.fn().mockReturnValue({ single: selectSingle });
    const insertMemory = jest.fn().mockReturnValue({ select: selectFn });

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'memory_vectors') return { insert: insertMemory };
      return {};
    });

    await expect(saveMemory(content, validEmbedding)).rejects.toEqual(dbError);
    consoleSpy.mockRestore();
  });

  it('continues and warns (not throws) when agent_nodes insert fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const nodeError = { message: 'node insert failed' };

    makeChain({ insertNodeResult: { error: nodeError } });

    // Should not throw
    await expect(saveMemory(content, validEmbedding)).resolves.toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs structured warning when node registration fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    makeChain({ insertNodeResult: { error: { message: 'conflict' } } });

    await saveMemory(content, validEmbedding);

    const warnCall = warnSpy.mock.calls[0][0];
    const parsed = JSON.parse(warnCall);
    expect(parsed.level).toBe('warn');
    expect(parsed.module).toBe('memory-vector');
    warnSpy.mockRestore();
  });
});