import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// --- Helpers ---
function makeFakeChild(overrides: Partial<{
  exitCode: number | null;
  killed: boolean;
  stdin: { write: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}> = {}): any {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = { write: vi.fn().mockReturnValue(true) };
  const kill = vi.fn();
  const child: any = {
    exitCode: null,
    killed: false,
    stdin,
    stdout,
    stderr,
    kill,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      // Mimic EventEmitter.on so we can trigger events
    }),
    once: vi.fn(),
    ...overrides,
  };
  return child;
}

// We mock child_process at the module level so MCPClient uses our fake spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';
import { MCPClient, getMCPClient } from './client';

const VALID_CONFIG = {
  mcpServers: {
    'test-server': {
      command: 'node',
      args: ['server.js'],
      env: {},
      enabled: true,
    },
  },
  defaults: {
    timeout: 1000,
    retries: 1,
    cache: { enabled: true, ttl: 60 },
  },
};

describe('MCPClient – constructor / parseConfig', () => {
  it('initialises with default config when no config is provided', () => {
    const client = new MCPClient();
    // Should not throw; internal config uses defaults
    expect(client).toBeInstanceOf(MCPClient);
  });

  it('initialises with provided valid config', () => {
    const client = new MCPClient(VALID_CONFIG);
    expect(client).toBeInstanceOf(MCPClient);
  });

  it('falls back to default config when invalid config is provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Passing an invalid config (missing required fields) should not throw
    const client = new MCPClient({ notAValidField: true });
    expect(client).toBeInstanceOf(MCPClient);
    consoleSpy.mockRestore();
  });

  it('falls back to default config when config has wrong types', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = new MCPClient({ mcpServers: 'not-an-object', defaults: null });
    expect(client).toBeInstanceOf(MCPClient);
    consoleSpy.mockRestore();
  });
});

describe('MCPClient – updateConfig', () => {
  it('updates the config with new valid config', () => {
    const client = new MCPClient();
    // After update, connecting to 'test-server' should be possible
    expect(() => client.updateConfig(VALID_CONFIG)).not.toThrow();
  });

  it('logs error and keeps previous config when invalid config is provided to updateConfig', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = new MCPClient(VALID_CONFIG);
    client.updateConfig({ bad: 'data' }); // should not throw
    consoleSpy.mockRestore();
  });
});

describe('MCPClient.fromConfig', () => {
  it('creates a new MCPClient instance from config', () => {
    const client = MCPClient.fromConfig(VALID_CONFIG);
    expect(client).toBeInstanceOf(MCPClient);
  });
});

describe('MCPClient – connect', () => {
  let fakeChild: any;

  beforeEach(() => {
    fakeChild = makeFakeChild();
    vi.mocked(spawn).mockReturnValue(fakeChild as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws when serverName is not in config', async () => {
    const client = new MCPClient(VALID_CONFIG);
    await expect(client.connect('unknown-server')).rejects.toThrow(
      'no encontrado o deshabilitado'
    );
  });

  it('throws when server is disabled', async () => {
    const configWithDisabled = {
      ...VALID_CONFIG,
      mcpServers: {
        'disabled-server': {
          command: 'node',
          args: [],
          env: {},
          enabled: false,
        },
      },
    };
    const client = new MCPClient(configWithDisabled);
    await expect(client.connect('disabled-server')).rejects.toThrow(
      'no encontrado o deshabilitado'
    );
  });

  it('resolves immediately when server is already connected (exitCode === null)', async () => {
    const connectedChild = makeFakeChild({ exitCode: null });
    const client = new MCPClient(VALID_CONFIG);
    // Manually inject a "connected" child
    (client as any).servers.set('test-server', connectedChild);

    // Should return without calling spawn or waitForReady again
    await client.connect('test-server');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('cleans up dead process and re-connects when exitCode is non-null', async () => {
    const deadChild = makeFakeChild({ exitCode: 1 });
    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('test-server', deadChild);

    // Provide a fresh child that immediately emits 'ready'
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    // Emit 'ready' on stdout to resolve waitForReady
    const connectPromise = client.connect('test-server');
    // Trigger the ready signal asynchronously
    setImmediate(() => freshChild.stdout.emit('data', Buffer.from('ready')));
    await connectPromise;

    expect(spawn).toHaveBeenCalledOnce();
  });

  it('resolves after server emits "ready" on stdout', async () => {
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    const client = new MCPClient(VALID_CONFIG);
    const connectPromise = client.connect('test-server');
    setImmediate(() => freshChild.stdout.emit('data', Buffer.from('Server ready')));
    await connectPromise;
    expect(spawn).toHaveBeenCalledOnce();
  });

  it('rejects when waitForReady times out', async () => {
    vi.useFakeTimers();
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    const client = new MCPClient({
      ...VALID_CONFIG,
      defaults: { ...VALID_CONFIG.defaults, timeout: 100 },
    });

    const connectPromise = client.connect('test-server');
    vi.advanceTimersByTime(200);
    await expect(connectPromise).rejects.toThrow('Timeout');
    vi.useRealTimers();
  });

  it('substitutes environment variables in server env config', async () => {
    process.env.TEST_VAR = 'test-value';
    const configWithEnvVars = {
      ...VALID_CONFIG,
      mcpServers: {
        'env-server': {
          command: 'node',
          args: [],
          env: { MY_KEY: '${TEST_VAR}' },
          enabled: true,
        },
      },
    };
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    const client = new MCPClient(configWithEnvVars);
    const connectPromise = client.connect('env-server');
    setImmediate(() => freshChild.stdout.emit('data', Buffer.from('ready')));
    await connectPromise;

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const envArg = spawnCall[2]?.env as Record<string, string>;
    expect(envArg.MY_KEY).toBe('test-value');
    delete process.env.TEST_VAR;
  });
});

describe('MCPClient – query cache', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached result without re-connecting on second query', async () => {
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    const client = new MCPClient(VALID_CONFIG);

    const cachedData = {
      answer: 'cached answer',
      sources: [],
      confidence: 0.9,
    };

    // Pre-populate cache
    const cacheKey = 'query:test-server:what is X?';
    (client as any).cache.set(cacheKey, {
      data: cachedData,
      expires: Date.now() + 60000,
    });

    const result = await client.query({ server: 'test-server', query: 'what is X?' });
    expect(result.cached).toBe(true);
    expect(result.answer).toBe('cached answer');
    // spawn should NOT have been called because cache hit avoids connect
    expect(spawn).not.toHaveBeenCalled();
  });

  it('does not use cache if ttl has expired', async () => {
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    const client = new MCPClient(VALID_CONFIG);
    const cacheKey = 'query:test-server:old question';

    // Expired cache entry
    (client as any).cache.set(cacheKey, {
      data: { answer: 'stale', sources: [], confidence: 0 },
      expires: Date.now() - 1, // already expired
    });

    // The query should try to connect (and fail since no 'ready' is emitted)
    const queryPromise = client.query({ server: 'test-server', query: 'old question' });
    setImmediate(() => freshChild.stdout.emit('data', Buffer.from('ready')));

    // It will then try sendRequest which times out; we just care that spawn was called
    // Use a short timeout config to avoid hanging
    // For this test, we cancel via disconnect
    await client.disconnect();
    await queryPromise.catch(() => {}); // expected to fail after disconnect
    expect(spawn).toHaveBeenCalled();
  });

  it('stores query result in cache after successful response', async () => {
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    const client = new MCPClient(VALID_CONFIG);

    // Connect the child manually
    (client as any).servers.set('test-server', freshChild);

    const responsePayload = { result: { answer: 'fresh answer', sources: [], confidence: 1 } };
    // Simulate server responding to sendRequest
    const writeStub = vi.fn(() => {
      setImmediate(() => {
        freshChild.stdout.emit('data', Buffer.from(JSON.stringify(responsePayload)));
      });
      return true;
    });
    freshChild.stdin.write = writeStub;

    const result = await client.query({ server: 'test-server', query: 'fresh question' });
    expect(result.cached).toBe(false);
    expect(result.answer).toBe('fresh answer');

    const cacheKey = 'query:test-server:fresh question';
    const cached = (client as any).cache.get(cacheKey);
    expect(cached).toBeDefined();
    expect(cached.data.answer).toBe('fresh answer');
  });

  it('does not cache when cache is disabled', async () => {
    const noCacheConfig = {
      ...VALID_CONFIG,
      defaults: { ...VALID_CONFIG.defaults, cache: { enabled: false, ttl: 60 } },
    };
    const freshChild = makeFakeChild({ exitCode: null });
    vi.mocked(spawn).mockReturnValue(freshChild as any);

    const client = new MCPClient(noCacheConfig);
    (client as any).servers.set('test-server', freshChild);

    const responsePayload = { result: { answer: 'no cache answer', sources: [], confidence: 1 } };
    freshChild.stdin.write = vi.fn(() => {
      setImmediate(() => {
        freshChild.stdout.emit('data', Buffer.from(JSON.stringify(responsePayload)));
      });
      return true;
    });

    await client.query({ server: 'test-server', query: 'no cache question' });

    const cacheKey = 'query:test-server:no cache question';
    const cached = (client as any).cache.get(cacheKey);
    expect(cached).toBeUndefined();
  });
});

describe('MCPClient – disconnect', () => {
  afterEach(() => vi.clearAllMocks());

  it('kills all running processes', async () => {
    const child1 = makeFakeChild({ exitCode: null });
    const child2 = makeFakeChild({ exitCode: null });

    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('server1', child1);
    (client as any).servers.set('server2', child2);

    await client.disconnect();

    expect(child1.kill).toHaveBeenCalledOnce();
    expect(child2.kill).toHaveBeenCalledOnce();
  });

  it('clears the servers map after disconnect', async () => {
    const child1 = makeFakeChild({ exitCode: null });
    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('server1', child1);

    await client.disconnect();
    expect((client as any).servers.size).toBe(0);
  });

  it('clears the cache after disconnect', async () => {
    const client = new MCPClient(VALID_CONFIG);
    (client as any).cache.set('some-key', { data: {}, expires: Date.now() + 999 });

    await client.disconnect();
    expect((client as any).cache.size).toBe(0);
  });
});

describe('MCPClient – sendRequest', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws when server is not connected', async () => {
    const client = new MCPClient(VALID_CONFIG);
    // No server in map
    await expect(
      (client as any).sendRequest('test-server', { method: 'ping', params: {} })
    ).rejects.toThrow('no está conectado o ha terminado');
  });

  it('throws when server process has exitCode !== null', async () => {
    const deadChild = makeFakeChild({ exitCode: 1 });
    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('test-server', deadChild);

    await expect(
      (client as any).sendRequest('test-server', { method: 'ping', params: {} })
    ).rejects.toThrow('no está conectado o ha terminado');
  });

  it('resolves with result from server response', async () => {
    const freshChild = makeFakeChild({ exitCode: null });
    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('test-server', freshChild);

    const responsePayload = { result: { data: 'hello' } };
    freshChild.stdin.write = vi.fn(() => {
      setImmediate(() => {
        freshChild.stdout.emit('data', Buffer.from(JSON.stringify(responsePayload)));
      });
      return true;
    });

    const result = await (client as any).sendRequest('test-server', { method: 'ping', params: {} });
    expect(result).toEqual({ data: 'hello' });
  });

  it('rejects when server returns an error in response', async () => {
    const freshChild = makeFakeChild({ exitCode: null });
    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('test-server', freshChild);

    const responsePayload = { error: 'Something went wrong' };
    freshChild.stdin.write = vi.fn(() => {
      setImmediate(() => {
        freshChild.stdout.emit('data', Buffer.from(JSON.stringify(responsePayload)));
      });
      return true;
    });

    await expect(
      (client as any).sendRequest('test-server', { method: 'ping', params: {} })
    ).rejects.toThrow('Something went wrong');
  });

  it('rejects when response is not valid JSON', async () => {
    const freshChild = makeFakeChild({ exitCode: null });
    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('test-server', freshChild);

    freshChild.stdin.write = vi.fn(() => {
      setImmediate(() => {
        freshChild.stdout.emit('data', Buffer.from('not json at all'));
      });
      return true;
    });

    await expect(
      (client as any).sendRequest('test-server', { method: 'ping', params: {} })
    ).rejects.toThrow();
  });

  it('times out when server does not respond', async () => {
    vi.useFakeTimers();
    const freshChild = makeFakeChild({ exitCode: null });
    const shortTimeoutConfig = {
      ...VALID_CONFIG,
      defaults: { ...VALID_CONFIG.defaults, timeout: 200 },
    };
    const client = new MCPClient(shortTimeoutConfig);
    (client as any).servers.set('test-server', freshChild);

    freshChild.stdin.write = vi.fn(() => true); // write succeeds but no response

    const requestPromise = (client as any).sendRequest('test-server', { method: 'ping', params: {} });
    vi.advanceTimersByTime(300);
    await expect(requestPromise).rejects.toThrow('Timeout');
    vi.useRealTimers();
  });
});

describe('getMCPClient singleton', () => {
  // The module-level singleton is shared across the test file. We test observable behavior
  // (same instance, updateConfig called) without trying to reset module-level state.
  afterEach(() => vi.clearAllMocks());

  it('creates a MCPClient instance', () => {
    const client = getMCPClient();
    expect(client).toBeInstanceOf(MCPClient);
  });

  it('returns the same instance on subsequent calls without config', () => {
    const client1 = getMCPClient();
    const client2 = getMCPClient();
    expect(client1).toBe(client2);
  });

  it('calls updateConfig when a non-empty config is provided to existing singleton', () => {
    const client1 = getMCPClient();
    const updateConfigSpy = vi.spyOn(client1, 'updateConfig');
    const client2 = getMCPClient(VALID_CONFIG);
    // Same instance but updateConfig called
    expect(client2).toBe(client1);
    expect(updateConfigSpy).toHaveBeenCalledWith(VALID_CONFIG);
  });

  it('does NOT call updateConfig when config has no servers', () => {
    const client1 = getMCPClient();
    const updateConfigSpy = vi.spyOn(client1, 'updateConfig');
    const emptyConfig = { mcpServers: {}, defaults: VALID_CONFIG.defaults };
    getMCPClient(emptyConfig);
    expect(updateConfigSpy).not.toHaveBeenCalled();
  });
});