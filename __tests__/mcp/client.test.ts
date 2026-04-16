import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// ─── Import AFTER mocking ────────────────────────────────────────────────────

import { MCPClient, getMCPClient } from '@/mcp/client';

// ─── Helper: fake ChildProcess ───────────────────────────────────────────────

function makeFakeChild(opts: { exitCode?: number | null } = {}) {
  const stdout = new EventEmitter() as any;
  const stderr = new EventEmitter() as any;
  const stdin = { write: vi.fn().mockReturnValue(true) };

  const child: any = new EventEmitter();
  child.stdout = stdout;
  child.stderr = stderr;
  child.stdin = stdin;
  child.exitCode = opts.exitCode ?? null; // null = still alive
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
  });
  return child;
}

// ─── Minimal valid config ────────────────────────────────────────────────────

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
    timeout: 500, // short for tests
    retries: 1,
    cache: { enabled: true, ttl: 10 },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolves the waitForReady promise by emitting 'ready' on stdout */
function resolveReady(child: ReturnType<typeof makeFakeChild>) {
  setImmediate(() => {
    child.stdout.emit('data', Buffer.from('server ready'));
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── parseConfig / constructor ─────────────────────────────────────────────────

describe('MCPClient constructor & parseConfig', () => {
  it('uses default config when no config is provided', () => {
    const client = new MCPClient();
    const cfg = (client as any).config;
    expect(cfg.mcpServers).toEqual({});
    expect(cfg.defaults.timeout).toBe(30000);
    expect(cfg.defaults.retries).toBe(3);
    expect(cfg.defaults.cache.enabled).toBe(true);
    expect(cfg.defaults.cache.ttl).toBe(3600);
  });

  it('parses a valid config object', () => {
    const client = new MCPClient(VALID_CONFIG);
    const cfg = (client as any).config;
    expect(cfg.mcpServers['test-server'].command).toBe('node');
    expect(cfg.defaults.timeout).toBe(500);
  });

  it('falls back to defaults on invalid (non-parseable) config', () => {
    const client = new MCPClient({ invalid: 'garbage' });
    const cfg = (client as any).config;
    expect(cfg.mcpServers).toEqual({});
    expect(cfg.defaults.timeout).toBe(30000);
  });

  it('falls back gracefully when config has wrong types', () => {
    const client = new MCPClient({ mcpServers: 'not-an-object', defaults: null });
    const cfg = (client as any).config;
    expect(cfg.defaults.timeout).toBe(30000);
  });
});

// ── updateConfig ──────────────────────────────────────────────────────────────

describe('MCPClient.updateConfig', () => {
  it('replaces the current config with a new valid config', () => {
    const client = new MCPClient();
    client.updateConfig(VALID_CONFIG);
    const cfg = (client as any).config;
    expect(cfg.mcpServers['test-server']).toBeDefined();
    expect(cfg.defaults.timeout).toBe(500);
  });

  it('falls back to defaults if invalid config is passed to updateConfig', () => {
    const client = new MCPClient(VALID_CONFIG);
    client.updateConfig({ bad: true });
    const cfg = (client as any).config;
    expect(cfg.defaults.timeout).toBe(30000);
  });
});

// ── MCPClient.fromConfig ──────────────────────────────────────────────────────

describe('MCPClient.fromConfig', () => {
  it('creates a new instance with the given config', () => {
    const client = MCPClient.fromConfig(VALID_CONFIG);
    expect(client).toBeInstanceOf(MCPClient);
    const cfg = (client as any).config;
    expect(cfg.defaults.timeout).toBe(500);
  });
});

// ── connect ───────────────────────────────────────────────────────────────────

describe('MCPClient.connect', () => {
  it('throws when the server name is not in config', async () => {
    const client = new MCPClient(VALID_CONFIG);
    await expect(client.connect('no-such-server')).rejects.toThrow(
      'no encontrado o deshabilitado',
    );
  });

  it('throws when the server is disabled', async () => {
    const client = new MCPClient({
      ...VALID_CONFIG,
      mcpServers: {
        disabled: { command: 'node', args: [], env: {}, enabled: false },
      },
    });
    await expect(client.connect('disabled')).rejects.toThrow('no encontrado o deshabilitado');
  });

  it('skips re-connection when process is already alive (exitCode === null)', async () => {
    const child = makeFakeChild({ exitCode: null });
    mockSpawn.mockReturnValue(child);
    resolveReady(child);

    const client = new MCPClient(VALID_CONFIG);
    await client.connect('test-server');

    const spawnCallsBefore = mockSpawn.mock.calls.length;
    // Second connect: should be a no-op
    await client.connect('test-server');
    expect(mockSpawn.mock.calls.length).toBe(spawnCallsBefore);
  });

  it('cleans up a dead process and reconnects', async () => {
    const deadChild = makeFakeChild({ exitCode: 1 }); // dead
    const aliveChild = makeFakeChild({ exitCode: null });
    mockSpawn.mockReturnValueOnce(aliveChild);
    resolveReady(aliveChild);

    const client = new MCPClient(VALID_CONFIG);
    // Manually plant the dead child (simulates a previously-spawned dead process)
    (client as any).servers.set('test-server', deadChild);

    await client.connect('test-server');
    // aliveChild was spawned for the reconnect
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect((client as any).servers.get('test-server')).toBe(aliveChild);
  });

  it('resolves environment variable placeholders in server env', async () => {
    const child = makeFakeChild();
    mockSpawn.mockReturnValue(child);
    resolveReady(child);

    process.env.TEST_VAR = 'hello';
    const cfg = {
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
    const client = new MCPClient(cfg);
    await client.connect('env-server');
    const spawnCall = mockSpawn.mock.calls[0];
    expect(spawnCall[2].env.MY_KEY).toBe('hello');
    delete process.env.TEST_VAR;
  });

  it('rejects when server emits no "ready" signal before timeout', async () => {
    const child = makeFakeChild();
    // Never emit 'ready'
    mockSpawn.mockReturnValue(child);

    const client = new MCPClient({
      ...VALID_CONFIG,
      defaults: { ...VALID_CONFIG.defaults, timeout: 50 },
    });
    await expect(client.connect('test-server')).rejects.toThrow('Timeout');
  });
});

// ── disconnect ────────────────────────────────────────────────────────────────

describe('MCPClient.disconnect', () => {
  it('kills all active processes and clears the servers map', async () => {
    const child1 = makeFakeChild();
    const child2 = makeFakeChild();
    const client = new MCPClient(VALID_CONFIG);
    (client as any).servers.set('s1', child1);
    (client as any).servers.set('s2', child2);

    await client.disconnect();

    expect(child1.kill).toHaveBeenCalledTimes(1);
    expect(child2.kill).toHaveBeenCalledTimes(1);
    expect((client as any).servers.size).toBe(0);
  });

  it('clears the cache on disconnect', async () => {
    const client = new MCPClient(VALID_CONFIG);
    (client as any).cache.set('key', { data: {}, expires: Date.now() + 10000 });
    await client.disconnect();
    expect((client as any).cache.size).toBe(0);
  });

  it('is a no-op when there are no active connections', async () => {
    const client = new MCPClient(VALID_CONFIG);
    await expect(client.disconnect()).resolves.toBeUndefined();
  });
});

// ── getMCPClient (singleton) ──────────────────────────────────────────────────

describe('getMCPClient', () => {
  it('creates a new MCPClient instance on first call', () => {
    const client = getMCPClient();
    expect(client).toBeInstanceOf(MCPClient);
  });

  it('returns the same instance on subsequent calls without config', () => {
    const c1 = getMCPClient();
    const c2 = getMCPClient();
    expect(c1).toBe(c2);
  });

  it('calls updateConfig when a non-empty servers config is provided to existing singleton', () => {
    const first = getMCPClient();
    const spy = vi.spyOn(first, 'updateConfig');
    getMCPClient(VALID_CONFIG);
    expect(spy).toHaveBeenCalledWith(VALID_CONFIG);
  });

  it('does NOT call updateConfig when config.mcpServers is empty', () => {
    const first = getMCPClient();
    const spy = vi.spyOn(first, 'updateConfig');
    getMCPClient({ mcpServers: {}, defaults: VALID_CONFIG.defaults });
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── query cache logic ─────────────────────────────────────────────────────────

describe('MCPClient query cache', () => {
  it('returns a cached result without re-connecting when cache is valid', async () => {
    const client = new MCPClient(VALID_CONFIG);
    const cacheKey = 'query:test-server:what is life?';
    const cachedData = {
      answer: 'cached',
      sources: [],
      confidence: 0.9,
      cached: false,
    };
    (client as any).cache.set(cacheKey, {
      data: cachedData,
      expires: Date.now() + 60000,
    });

    const result = await client.query({ server: 'test-server', query: 'what is life?' });
    expect(result.cached).toBe(true);
    expect(result.answer).toBe('cached');
    // spawn should NOT have been called
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('bypasses cache when it has expired', async () => {
    const child = makeFakeChild();
    mockSpawn.mockReturnValue(child);
    resolveReady(child);

    const client = new MCPClient(VALID_CONFIG);
    const cacheKey = 'query:test-server:stale?';
    (client as any).cache.set(cacheKey, {
      data: { answer: 'old', sources: [], confidence: 0 },
      expires: Date.now() - 1000, // expired
    });

    // stub sendRequest
    const sendSpy = vi.spyOn(client as any, 'sendRequest').mockResolvedValueOnce({
      answer: 'fresh',
      sources: [],
      confidence: 1,
    });

    const result = await client.query({ server: 'test-server', query: 'stale?' });
    expect(result.answer).toBe('fresh');
    expect(sendSpy).toHaveBeenCalled();
  });

  it('stores result in cache after a successful query', async () => {
    const child = makeFakeChild();
    mockSpawn.mockReturnValue(child);
    resolveReady(child);

    const client = new MCPClient(VALID_CONFIG);
    const freshData = { answer: 'new', sources: [], confidence: 1 };

    vi.spyOn(client as any, 'sendRequest').mockResolvedValueOnce(freshData);

    await client.query({ server: 'test-server', query: 'store me' });

    const cacheKey = 'query:test-server:store me';
    const cached = (client as any).cache.get(cacheKey);
    expect(cached).toBeDefined();
    expect(cached.data).toEqual(freshData);
    expect(cached.expires).toBeGreaterThan(Date.now());
  });
});