jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { memoryStore } from '../agent/memory/store';
import { supabase } from '../lib/supabase';

const mockFrom = supabase.from as jest.Mock;

describe('memoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addMessage', () => {
    function makeInsertChain(result: { error: any }) {
      const insert = jest.fn().mockResolvedValue(result);
      mockFrom.mockReturnValue({ insert });
      return { insert };
    }

    it('calls supabase.from("messages").insert with correct data', async () => {
      const { insert } = makeInsertChain({ error: null });
      await memoryStore.addMessage('session-1', 'user', 'hello');
      expect(mockFrom).toHaveBeenCalledWith('messages');
      expect(insert).toHaveBeenCalledWith({ session_id: 'session-1', role: 'user', content: 'hello' });
    });

    it('does not throw when insert succeeds', async () => {
      makeInsertChain({ error: null });
      await expect(memoryStore.addMessage('session-1', 'assistant', 'hi')).resolves.toBeUndefined();
    });

    it('throws when supabase returns an error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const dbError = { message: 'insert failed', code: '42P01' };
      makeInsertChain({ error: dbError });

      await expect(memoryStore.addMessage('session-1', 'user', 'hello')).rejects.toEqual(dbError);
      consoleSpy.mockRestore();
    });

    it('logs a structured error when insert fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      makeInsertChain({ error: { message: 'db error' } });

      try { await memoryStore.addMessage('session-1', 'user', 'hello'); } catch {}

      expect(consoleSpy).toHaveBeenCalled();
      const logArg = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logArg);
      expect(parsed.level).toBe('error');
      expect(parsed.module).toBe('memory-store');
      expect(parsed.message).toContain('session-1');
      consoleSpy.mockRestore();
    });

    it('includes session ID in error log message', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      makeInsertChain({ error: { message: 'oops' } });

      try { await memoryStore.addMessage('my-session-xyz', 'user', 'text'); } catch {}

      const logArg = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logArg);
      expect(parsed.message).toContain('my-session-xyz');
      consoleSpy.mockRestore();
    });
  });

  describe('getHistory', () => {
    function makeQueryChain(result: { data: any; error: any }) {
      const limit = jest.fn().mockResolvedValue(result);
      const order = jest.fn().mockReturnValue({ limit });
      const eq = jest.fn().mockReturnValue({ order });
      const select = jest.fn().mockReturnValue({ eq });
      mockFrom.mockReturnValue({ select });
      return { select, eq, order, limit };
    }

    it('queries the messages table with the correct session ID and limit', async () => {
      const rows = [
        { id: '1', session_id: 'sess', role: 'user', content: 'hi', created_at: '2024-01-01T00:00:01Z' },
        { id: '2', session_id: 'sess', role: 'assistant', content: 'hello', created_at: '2024-01-01T00:00:02Z' },
      ];
      const { eq, order, limit } = makeQueryChain({ data: rows, error: null });

      await memoryStore.getHistory('sess', 10);
      expect(mockFrom).toHaveBeenCalledWith('messages');
      expect(eq).toHaveBeenCalledWith('session_id', 'sess');
      expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(limit).toHaveBeenCalledWith(10);
    });

    it('uses default limit of 20 when none is provided', async () => {
      const { limit } = makeQueryChain({ data: [], error: null });
      await memoryStore.getHistory('sess');
      expect(limit).toHaveBeenCalledWith(20);
    });

    it('returns messages in reverse chronological order (oldest first)', async () => {
      const rows = [
        { id: '2', created_at: '2024-01-02', role: 'assistant', content: 'b' },
        { id: '1', created_at: '2024-01-01', role: 'user', content: 'a' },
      ];
      makeQueryChain({ data: rows, error: null });

      const result = await memoryStore.getHistory('sess');
      // .reverse() is called, so order should flip
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('throws when supabase returns an error (NOT returns empty array)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const dbError = { message: 'query failed', code: '42P01' };
      makeQueryChain({ data: null, error: dbError });

      await expect(memoryStore.getHistory('sess')).rejects.toEqual(dbError);
      consoleSpy.mockRestore();
    });

    it('logs a structured error when query fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      makeQueryChain({ data: null, error: { message: 'db error' } });

      try { await memoryStore.getHistory('my-session'); } catch {}

      expect(consoleSpy).toHaveBeenCalled();
      const logArg = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logArg);
      expect(parsed.level).toBe('error');
      expect(parsed.module).toBe('memory-store');
      expect(parsed.message).toContain('my-session');
      consoleSpy.mockRestore();
    });

    it('does NOT silently return empty array on error (regression test for behavior change)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      makeQueryChain({ data: null, error: { message: 'fail' } });

      let caught: any = null;
      try {
        await memoryStore.getHistory('sess');
      } catch (e) {
        caught = e;
      }

      // The new behavior is to throw, not return []
      expect(caught).not.toBeNull();
      consoleSpy.mockRestore();
    });
  });
});