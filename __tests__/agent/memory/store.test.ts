import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────────
// vi.mock() is hoisted, so variables used inside the factory must also be hoisted.

const { mockFrom, mockInsert, mockSelect, mockEq, mockOrder, mockLimit } = vi.hoisted(() => {
  return {
    mockFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockOrder: vi.fn(),
    mockLimit: vi.fn(),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { memoryStore } from '@/agent/memory/store';

// ─── Test setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default chain: select → eq → order → limit
  mockInsert.mockResolvedValue({ data: null, error: null });
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ order: mockOrder });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
  });
});

// ─── addMessage ──────────────────────────────────────────────────────────────

describe('memoryStore.addMessage', () => {
  it('calls supabase.from("messages").insert with correct payload', async () => {
    await memoryStore.addMessage('session-1', 'user', 'Hello world');
    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(mockInsert).toHaveBeenCalledWith({
      session_id: 'session-1',
      role: 'user',
      content: 'Hello world',
    });
  });

  it('resolves without error when supabase succeeds', async () => {
    mockInsert.mockResolvedValueOnce({ data: null, error: null });
    await expect(memoryStore.addMessage('s', 'assistant', 'ok')).resolves.toBeUndefined();
  });

  it('throws the supabase error when insert fails', async () => {
    const dbError = new Error('insert failed');
    mockInsert.mockResolvedValueOnce({ data: null, error: dbError });
    await expect(memoryStore.addMessage('s', 'user', 'msg')).rejects.toThrow('insert failed');
  });

  it('logs an error to console.error before throwing', async () => {
    const dbError = { message: 'db down' };
    mockInsert.mockResolvedValueOnce({ data: null, error: dbError });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(memoryStore.addMessage('sess', 'user', 'hi')).rejects.toBeDefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── getHistory ──────────────────────────────────────────────────────────────

describe('memoryStore.getHistory', () => {
  it('returns messages in chronological order (reversed from DB order)', async () => {
    const dbRows = [
      { id: '3', content: 'c', created_at: '2024-01-03' },
      { id: '2', content: 'b', created_at: '2024-01-02' },
      { id: '1', content: 'a', created_at: '2024-01-01' },
    ];
    mockLimit.mockResolvedValueOnce({ data: dbRows, error: null });
    const result = await memoryStore.getHistory('session-1');
    expect(result).toEqual([
      { id: '1', content: 'a', created_at: '2024-01-01' },
      { id: '2', content: 'b', created_at: '2024-01-02' },
      { id: '3', content: 'c', created_at: '2024-01-03' },
    ]);
  });

  it('uses the default limit of 20', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    await memoryStore.getHistory('session-1');
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it('respects a custom limit argument', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    await memoryStore.getHistory('session-1', 5);
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('queries the correct session_id', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    await memoryStore.getHistory('my-session');
    expect(mockEq).toHaveBeenCalledWith('session_id', 'my-session');
  });

  it('throws when supabase returns an error (changed behaviour in this PR)', async () => {
    const dbError = new Error('select failed');
    mockLimit.mockResolvedValueOnce({ data: null, error: dbError });
    await expect(memoryStore.getHistory('session-x')).rejects.toThrow('select failed');
  });

  it('logs error to console.error before throwing', async () => {
    const dbError = { message: 'timeout' };
    mockLimit.mockResolvedValueOnce({ data: null, error: dbError });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(memoryStore.getHistory('s')).rejects.toBeDefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns an empty array when there are no messages', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    const result = await memoryStore.getHistory('empty-session');
    expect(result).toEqual([]);
  });
});