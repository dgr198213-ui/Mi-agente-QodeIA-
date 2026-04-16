import { EventEmitter } from 'events';

// --- Mock child_process.spawn ---
let mockSpawnFn: jest.Mock;

jest.mock('child_process', () => {
  mockSpawnFn = jest.fn();
  return { spawn: mockSpawnFn };
});

import { MCPClient, getMCPClient } from '../mcp/client';

// Helper: create a fake ChildProcess
function makeFakeChild(opts: { exitCode?: number | null; autoReady?: boolean } = {}) {
  const { exitCode = null, autoReady = false } = opts;
  const child: any = new EventEmitter();
  child.exitCode = exitCode;
  child.killed = false;
  child.stdin = { write: jest.fn() };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn(() => { child.exitCode = 0; });

  if (autoReady) {
    // Emit 'ready' on stdout after a tick
    setImmediate(() => child.stdout.emit('data', Buffer.from('server is ready')));
  }
  return child;
}

const validServerConfig = {
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
    retries: 3,
    cache: { enabled: true, ttl: 60 },
  },
};

describe('MCPClient - parseConfig / constructor', () => {
  it('uses default config when no config is provided', () => {
    const client = new MCPClient();
    // Access private config via any cast for testing
    const cfg = (client as any).config;
    expect(cfg.mcpServers).toEqual({});
    expect(cfg.defaults.timeout).toBe(30000);
    expect(cfg.defaults.retries).toBe(3);
    expect(cfg.defaults.cache.enabled).toBe(true);
    expect(cfg.defaults.cache.ttl).toBe(3600);
  });

  it('parses and applies valid config', () => {
    const client = new MCPClient(validServerConfig);
    const cfg = (client as any).config;
    expect(cfg.mcpServers['test-server'].command).toBe('node');
    expect(cfg.defaults.timeout).toBe(1000);
  });

  it('falls back to default config when provided config is invalid', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client = new MCPClient({ invalid: 'garbage' });
    const cfg = (client as any).config;
    expect(cfg.mcpServers).toEqual({});
    consoleSpy.mockRestore();
  });

  it('logs error message when config parsing fails', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    new MCPClient({ bad: 'data' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('MCPClient - updateConfig', () => {
  it('updates the internal config with new valid config', () => {
    const client = new MCPClient();
    client.updateConfig(validServerConfig);
    const cfg = (client as any).config;
    expect(cfg.mcpServers['test-server']).toBeDefined();
    expect(cfg.defaults.timeout).toBe(1000);
  });

  it('falls back to defaults when updateConfig receives invalid config', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client = new MCPClient(validServerConfig);
    client.updateConfig({ garbage: true });
    const cfg = (client as any).config;
    expect(cfg.mcpServers).toEqual({});
    consoleSpy.mockRestore();
  });

  it('allows changing timeout via updateConfig', () => {
    const client = new MCPClient(validServerConfig);
    const newConfig = { ...validServerConfig, defaults: { ...validServerConfig.defaults, timeout: 5000 } };
    client.updateConfig(newConfig);
    expect((client as any).config.defaults.timeout).toBe(5000);
  });
});

describe('MCPClient - static fromConfig', () => {
  it('creates a new MCPClient instance with the provided config', () => {
    const client = MCPClient.fromConfig(validServerConfig);
    expect(client).toBeInstanceOf(MCPClient);
    expect((client as any).config.mcpServers['test-server']).toBeDefined();
  });
});

describe('MCPClient - connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when server is not in config', async () => {
    const client = new MCPClient(validServerConfig);
    await expect(client.connect('nonexistent')).rejects.toThrow('no encontrado o deshabilitado');
  });

  it('throws when server is disabled', async () => {
    const config = {
      ...validServerConfig,
      mcpServers: {
        'disabled-server': { command: 'node', args: [], env: {}, enabled: false },
      },
    };
    const client = new MCPClient(config);
    await expect(client.connect('disabled-server')).rejects.toThrow('no encontrado o deshabilitado');
  });

  it('does not spawn a new process if already connected', async () => {
    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(validServerConfig);
    // Manually inject a "live" child to simulate already-connected state
    (client as any).servers.set('test-server', fakeChild);

    await client.connect('test-server');
    expect(mockSpawnFn).not.toHaveBeenCalled();
  });

  it('removes dead process and spawns new one on reconnect', async () => {
    const deadChild = makeFakeChild({ exitCode: 1 });
    const liveChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(liveChild);

    const client = new MCPClient(validServerConfig);
    (client as any).servers.set('test-server', deadChild);

    const connectPromise = client.connect('test-server');
    await connectPromise;

    expect(mockSpawnFn).toHaveBeenCalledTimes(1);
    expect((client as any).servers.get('test-server')).toBe(liveChild);
  });

  it('spawns child process with correct command and args', async () => {
    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(validServerConfig);
    await client.connect('test-server');

    expect(mockSpawnFn).toHaveBeenCalledWith(
      'node',
      ['server.js'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    );
  });

  it('replaces ${VAR} placeholders in env values', async () => {
    const originalEnv = process.env.MY_TEST_VAR;
    process.env.MY_TEST_VAR = 'replaced_value';

    const config = {
      ...validServerConfig,
      mcpServers: {
        'env-server': {
          command: 'node',
          args: [],
          env: { MY_KEY: '${MY_TEST_VAR}' },
          enabled: true,
        },
      },
    };

    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(config);
    await client.connect('env-server');

    const spawnCall = mockSpawnFn.mock.calls[0];
    expect(spawnCall[2].env.MY_KEY).toBe('replaced_value');

    if (originalEnv === undefined) delete process.env.MY_TEST_VAR;
    else process.env.MY_TEST_VAR = originalEnv;
  });

  it('rejects when server times out waiting for ready signal', async () => {
    const fakeChild = makeFakeChild({ autoReady: false }); // never emits 'ready'
    mockSpawnFn.mockReturnValue(fakeChild);

    const config = {
      ...validServerConfig,
      defaults: { ...validServerConfig.defaults, timeout: 50 },
    };
    const client = new MCPClient(config);
    await expect(client.connect('test-server')).rejects.toThrow(/Timeout/);
  }, 2000);

  it('removes server from map when process emits error', async () => {
    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(validServerConfig);
    await client.connect('test-server');
    expect((client as any).servers.has('test-server')).toBe(true);

    fakeChild.emit('error', new Error('process error'));
    expect((client as any).servers.has('test-server')).toBe(false);
  });

  it('removes server from map when process exits with non-zero code', async () => {
    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(validServerConfig);
    await client.connect('test-server');

    fakeChild.emit('exit', 1);
    expect((client as any).servers.has('test-server')).toBe(false);
  });

  it('removes server from map when process exits with code 0', async () => {
    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(validServerConfig);
    await client.connect('test-server');

    fakeChild.emit('exit', 0);
    expect((client as any).servers.has('test-server')).toBe(false);
  });
});

describe('MCPClient - query (cache)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached result on second call for same query', async () => {
    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(validServerConfig);

    // Pre-seed cache
    const cacheKey = 'query:test-server:hello';
    const cachedResult = { answer: 'cached answer', sources: [], confidence: 0.9 };
    (client as any).cache.set(cacheKey, {
      data: cachedResult,
      expires: Date.now() + 60000,
    });

    const result = await client.query({ server: 'test-server', query: 'hello' });
    expect(result.cached).toBe(true);
    expect(result.answer).toBe('cached answer');
    // Should not have spawned a process
    expect(mockSpawnFn).not.toHaveBeenCalled();
  });

  it('does not use expired cache entries', async () => {
    const fakeChild = makeFakeChild({ autoReady: true });
    mockSpawnFn.mockReturnValue(fakeChild);

    const client = new MCPClient(validServerConfig);

    // Pre-seed expired cache
    const cacheKey = 'query:test-server:stale';
    (client as any).cache.set(cacheKey, {
      data: { answer: 'old', sources: [], confidence: 0.5 },
      expires: Date.now() - 1000, // expired
    });

    // connect should be called but will fail with timeout since no ready signal
    await expect(client.query({ server: 'test-server', query: 'stale' })).rejects.toThrow();
    expect(mockSpawnFn).toHaveBeenCalled();
  });
});

describe('MCPClient - disconnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('kills all connected processes', async () => {
    const child1 = makeFakeChild();
    const child2 = makeFakeChild();

    const client = new MCPClient(validServerConfig);
    (client as any).servers.set('server1', child1);
    (client as any).servers.set('server2', child2);
    (client as any).cache.set('key', { data: {}, expires: Date.now() + 1000 });

    await client.disconnect();

    expect(child1.kill).toHaveBeenCalled();
    expect(child2.kill).toHaveBeenCalled();
  });

  it('clears the servers map after disconnect', async () => {
    const child = makeFakeChild();
    const client = new MCPClient(validServerConfig);
    (client as any).servers.set('test-server', child);

    await client.disconnect();
    expect((client as any).servers.size).toBe(0);
  });

  it('clears the cache after disconnect', async () => {
    const client = new MCPClient(validServerConfig);
    (client as any).cache.set('some-key', { data: {}, expires: Date.now() + 1000 });

    await client.disconnect();
    expect((client as any).cache.size).toBe(0);
  });

  it('does nothing when no servers are connected', async () => {
    const client = new MCPClient(validServerConfig);
    await expect(client.disconnect()).resolves.toBeUndefined();
  });
});

describe('getMCPClient', () => {
  // Reset singleton between tests
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton by accessing module internals
    const mod = require('../mcp/client');
    // Set mcpClient to null via module-level variable
    // We'll test observable behavior instead
  });

  it('returns an MCPClient instance', () => {
    const client = getMCPClient();
    expect(client).toBeInstanceOf(MCPClient);
  });

  it('returns the same instance on subsequent calls without config', () => {
    const client1 = getMCPClient();
    const client2 = getMCPClient();
    expect(client1).toBe(client2);
  });

  it('calls updateConfig when existing client gets non-empty config', () => {
    const client = getMCPClient(); // ensure it exists
    const updateSpy = jest.spyOn(client, 'updateConfig');

    // Provide a config with servers
    getMCPClient(validServerConfig);
    expect(updateSpy).toHaveBeenCalledWith(validServerConfig);
  });

  it('does NOT call updateConfig when provided config has empty mcpServers', () => {
    const client = getMCPClient();
    const updateSpy = jest.spyOn(client, 'updateConfig');

    getMCPClient({ mcpServers: {}, defaults: { timeout: 100, retries: 1, cache: { enabled: false, ttl: 0 } } });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe('MCPClient - sendRequest (private, tested via query with mocked connect)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when server is not connected', async () => {
    const client = new MCPClient(validServerConfig);
    // Try sendRequest directly via casting
    await expect(
      (client as any).sendRequest('test-server', { method: 'query_notebook', params: {} })
    ).rejects.toThrow('no está conectado');
  });

  it('rejects when server responds with error field', async () => {
    const child = makeFakeChild();
    const client = new MCPClient(validServerConfig);
    (client as any).servers.set('test-server', child);

    const requestPromise = (client as any).sendRequest('test-server', { method: 'test', params: {} });

    // Emit response with error
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ error: 'bad request' })));
    });

    await expect(requestPromise).rejects.toThrow('bad request');
  });

  it('resolves with result field from response', async () => {
    const child = makeFakeChild();
    const client = new MCPClient(validServerConfig);
    (client as any).servers.set('test-server', child);

    const requestPromise = (client as any).sendRequest('test-server', { method: 'test', params: {} });

    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ result: { answer: 'ok' } })));
    });

    const result = await requestPromise;
    expect(result).toEqual({ answer: 'ok' });
  });

  it('rejects when response is not valid JSON', async () => {
    const child = makeFakeChild();
    const client = new MCPClient(validServerConfig);
    (client as any).servers.set('test-server', child);

    const requestPromise = (client as any).sendRequest('test-server', { method: 'test', params: {} });

    setImmediate(() => {
      child.stdout.emit('data', Buffer.from('not-json-at-all'));
    });

    await expect(requestPromise).rejects.toThrow();
  });

  it('rejects on timeout when no response comes', async () => {
    const child = makeFakeChild();
    const config = { ...validServerConfig, defaults: { ...validServerConfig.defaults, timeout: 50 } };
    const client = new MCPClient(config);
    (client as any).servers.set('test-server', child);

    await expect(
      (client as any).sendRequest('test-server', { method: 'test', params: {} })
    ).rejects.toThrow(/Timeout/);
  }, 2000);

  it('sends the request payload to stdin', async () => {
    const child = makeFakeChild();
    const client = new MCPClient(validServerConfig);
    (client as any).servers.set('test-server', child);

    const requestPromise = (client as any).sendRequest('test-server', { method: 'ping', params: { x: 1 } });

    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ result: 'pong' })));
    });

    await requestPromise;
    expect(child.stdin.write).toHaveBeenCalledWith(
      JSON.stringify({ method: 'ping', params: { x: 1 } }) + '\n'
    );
  });
});