import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to declare mocks before vi.mock hoisting
const { mockFrom, mockInsertFn, mockSelectFn, mockEqFn, mockOrderFn, mockLimitFn } = vi.hoisted(() => {
  const mockLimitFn = vi.fn();
  const mockOrderFn = vi.fn().mockReturnValue({ limit: mockLimitFn });
  const mockEqFn = vi.fn().mockReturnValue({ order: mockOrderFn });
  const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
  const mockInsertFn = vi.fn();
  const mockFrom = vi.fn();
  return { mockFrom, mockInsertFn, mockSelectFn, mockEqFn, mockOrderFn, mockLimitFn };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { memoryStore } from './store';

// Build a fluent chain for the select query
function buildSelectChain(response: { data: any; error: any }) {
  const limit = vi.fn().mockResolvedValue(response);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order, limit };
}

// Build a simple insert chain
function buildInsertChain(response: { data: any; error: any }) {
  const insert = vi.fn().mockResolvedValue(response);
  return { insert };
}

describe('memoryStore.addMessage – PR changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a message without throwing when there is no error', async () => {
    const chain = buildInsertChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await expect(memoryStore.addMessage('session-1', 'user', 'Hello')).resolves.toBeUndefined();
    expect(chain.insert).toHaveBeenCalledWith({
      session_id: 'session-1',
      role: 'user',
      content: 'Hello',
    });
  });

  it('throws when supabase returns an error (PR change: was silent before)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbError = { message: 'network error', code: '500' };
    const chain = buildInsertChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    await expect(memoryStore.addMessage('session-1', 'user', 'Hello'))
      .rejects.toMatchObject({ message: 'network error' });
    consoleSpy.mockRestore();
  });

  it('logs a structured error message before throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chain = buildInsertChain({ data: null, error: { message: 'db down' } });
    mockFrom.mockReturnValue(chain);

    await memoryStore.addMessage('sess-xyz', 'assistant', 'hi').catch(() => {});

    expect(consoleSpy).toHaveBeenCalledOnce();
    const loggedArg = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(loggedArg);
    expect(parsed.level).toBe('error');
    expect(parsed.module).toBe('memory-store');
    expect(parsed.message).toContain('sess-xyz');
    consoleSpy.mockRestore();
  });

  it('inserts with correct role values: user, assistant, system', async () => {
    for (const role of ['user', 'assistant', 'system']) {
      const chain = buildInsertChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);
      await memoryStore.addMessage('s', role, 'content');
      expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ role }));
    }
  });
});

describe('memoryStore.getHistory – PR changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns reversed messages on success', async () => {
    // Messages returned in descending order (newest first); getHistory reverses them
    const messages = [
      { id: '3', content: 'third', created_at: '2024-01-03' },
      { id: '2', content: 'second', created_at: '2024-01-02' },
      { id: '1', content: 'first', created_at: '2024-01-01' },
    ];
    const chain = buildSelectChain({ data: messages, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memoryStore.getHistory('sess-abc');
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('1'); // reversed: oldest first
    expect(result[2].id).toBe('3');
  });

  it('throws when supabase returns an error (PR change: was returning [] silently)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbError = { message: 'connection refused', code: '503' };
    const chain = buildSelectChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    await expect(memoryStore.getHistory('sess-fail'))
      .rejects.toMatchObject({ message: 'connection refused' });
    consoleSpy.mockRestore();
  });

  it('logs a structured error before throwing on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chain = buildSelectChain({ data: null, error: { message: 'timeout' } });
    mockFrom.mockReturnValue(chain);

    await memoryStore.getHistory('sess-err').catch(() => {});

    expect(consoleSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('error');
    expect(parsed.module).toBe('memory-store');
    expect(parsed.message).toContain('sess-err');
    consoleSpy.mockRestore();
  });

  it('uses default limit of 20 when not specified', async () => {
    const chain = buildSelectChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await memoryStore.getHistory('sess-default');
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it('respects custom limit parameter', async () => {
    const chain = buildSelectChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await memoryStore.getHistory('sess-custom', 5);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('queries with correct session_id filter', async () => {
    const chain = buildSelectChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await memoryStore.getHistory('my-session-id');
    expect(chain.eq).toHaveBeenCalledWith('session_id', 'my-session-id');
  });

  it('orders by created_at descending', async () => {
    const chain = buildSelectChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await memoryStore.getHistory('sess-order');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns empty array (after reverse) when DB has no messages for session', async () => {
    const chain = buildSelectChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memoryStore.getHistory('empty-session');
    expect(result).toEqual([]);
  });

  // Regression: previously getHistory swallowed errors by returning [];
  // now callers must handle the thrown error
  it('does not silently return [] on DB error (regression)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chain = buildSelectChain({ data: null, error: { message: 'query failed' } });
    mockFrom.mockReturnValue(chain);

    let thrown = false;
    try {
      await memoryStore.getHistory('sess');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    consoleSpy.mockRestore();
  });
});