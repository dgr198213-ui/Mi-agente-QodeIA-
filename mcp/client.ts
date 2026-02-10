/**
 * MCP Client para QodeIA
 * Gestiona la conexión con servidores MCP (NotebookLM)
 */

import { spawn, ChildProcess } from 'child_process';
import { z } from 'zod';

// Schemas de validación
const MCPServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()),
  enabled: z.boolean().default(true),
});

const MCPConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema),
  defaults: z.object({
    timeout: z.number().default(30000),
    retries: z.number().default(3),
    cache: z.object({
      enabled: z.boolean().default(true),
      ttl: z.number().default(3600),
    }),
  }),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type MCPConfig = z.infer<typeof MCPConfigSchema>;

// Tipos de respuesta MCP
export interface MCPQueryResult {
  answer: string;
  sources: Array<{
    title: string;
    page_number?: number;
    excerpt: string;
    url?: string;
  }>;
  confidence: number;
  cached: boolean;
}

export interface MCPNotebook {
  id: string;
  title: string;
  url: string;
  sources_count: number;
}

export interface MCPSyncResult {
  success: boolean;
  notebook_id: string;
  source_id: string;
  synced_at: string;
}

/**
 * Cliente MCP principal
 */
export class MCPClient {
  private config: MCPConfig;
  private servers: Map<string, ChildProcess> = new Map();
  private cache: Map<string, { data: any; expires: number }> = new Map();

  constructor(config?: any) {
    this.config = this.parseConfig(config);
  }

  private parseConfig(config?: any): MCPConfig {
    if (config) {
      try {
        return MCPConfigSchema.parse(config);
      } catch (e) {
        console.error('[MCP] Configuración inválida, usando valores por defecto', e);
      }
    }
    return {
      mcpServers: {},
      defaults: {
        timeout: 30000,
        retries: 3,
        cache: { enabled: true, ttl: 3600 }
      }
    };
  }

  /**
   * Actualiza la configuración del cliente
   */
  updateConfig(config: any) {
    this.config = this.parseConfig(config);
  }

  /**
   * Carga la configuración desde un objeto
   */
  static fromConfig(config: any): MCPClient {
    return new MCPClient(config);
  }

  /**
   * Inicializa conexión con un servidor MCP específico
   */
  async connect(serverName: string): Promise<void> {
    // 1. Verificar si ya está conectado y el proceso sigue vivo
    const existingChild = this.servers.get(serverName);
    if (existingChild && existingChild.exitCode === null) {
      return; // Ya conectado
    }

    // 2. Limpiar proceso muerto si existe
    if (existingChild) {
      this.servers.delete(serverName);
    }

    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig || !serverConfig.enabled) {
      throw new Error(`Servidor MCP "${serverName}" no encontrado o deshabilitado`);
    }

    // Reemplazar variables de entorno
    const env = { ...process.env };
    for (const [key, value] of Object.entries(serverConfig.env)) {
      const envValue = value.replace(/\$\{(\w+)\}/g, (_, varName) => {
        return process.env[varName] || '';
      });
      env[key] = envValue;
    }

    // Spawn del proceso MCP
    const child = spawn(serverConfig.command, serverConfig.args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.servers.set(serverName, child);

    // Manejo de errores del proceso
    child.on('error', (err) => {
      console.error(`[MCP:${serverName}] Proceso falló:`, err);
      this.servers.delete(serverName);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[MCP:${serverName}] Proceso terminó con código ${code}`);
      }
      this.servers.delete(serverName);
    });

    // Logging
    child.stdout?.on('data', (data) => {
      // console.log(`[MCP:${serverName}] ${data}`);
    });

    child.stderr?.on('data', (data) => {
      console.error(`[MCP:${serverName}] STDERR: ${data}`);
    });

    // Esperar a que el servidor esté listo
    await this.waitForReady(child, serverName);
  }

  /**
   * Consulta un cuaderno de NotebookLM
   */
  async query(params: {
    server: string;
    query: string;
    include_citations?: boolean;
    max_results?: number;
  }): Promise<MCPQueryResult> {
    const {
      server,
      query,
      include_citations = true,
      max_results = 5,
    } = params;

    // Verificar cache
    const cacheKey = `query:${server}:${query}`;
    if (this.config.defaults.cache.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return { ...cached.data, cached: true };
      }
    }

    // Conectar si no está conectado (Lazy)
    await this.connect(server);

    // Enviar solicitud MCP
    const result = await this.sendRequest(server, {
      method: 'query_notebook',
      params: {
        query,
        include_citations,
        max_results,
      },
    });

    // Cachear resultado
    if (this.config.defaults.cache.enabled) {
      this.cache.set(cacheKey, {
        data: result,
        expires: Date.now() + this.config.defaults.cache.ttl * 1000,
      });
    }

    return { ...result, cached: false };
  }

  /**
   * Sincroniza un archivo con NotebookLM
   */
  async syncSource(params: {
    server: string;
    file_path: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<MCPSyncResult> {
    const { server, file_path, content, metadata } = params;

    await this.connect(server);

    return await this.sendRequest(server, {
      method: 'sync_source',
      params: {
        file_path,
        content,
        metadata,
      },
    });
  }

  /**
   * Cierra todas las conexiones MCP
   */
  async disconnect(): Promise<void> {
    for (const [name, child] of this.servers.entries()) {
      child.kill();
      console.log(`[MCP:${name}] Desconectado`);
    }
    this.servers.clear();
    this.cache.clear();
  }

  // --- Métodos privados ---

  private async waitForReady(
    child: ChildProcess,
    serverName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout esperando servidor MCP "${serverName}"`));
      }, this.config.defaults.timeout);

      const onData = (data: Buffer) => {
        if (data.toString().includes('ready')) {
          clearTimeout(timeout);
          child.stdout?.off('data', onData);
          resolve();
        }
      };

      child.stdout?.on('data', onData);
    });
  }

  private async sendRequest(
    server: string,
    request: { method: string; params: any }
  ): Promise<any> {
    const child = this.servers.get(server);
    if (!child || child.exitCode !== null) {
      throw new Error(`Servidor MCP "${server}" no está conectado o ha terminado`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout en solicitud MCP a "${server}"`));
      }, this.config.defaults.timeout);

      // Enviar solicitud
      child.stdin?.write(JSON.stringify(request) + '\n');

      // Esperar respuesta
      const onData = (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.result);
          }
        } catch (error) {
          reject(error);
        } finally {
          child.stdout?.off('data', onData);
        }
      };

      child.stdout?.on('data', onData);
    });
  }
}

// Singleton global
let mcpClient: MCPClient | null = null;

export function getMCPClient(config?: any): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient(config);
  } else if (config && Object.keys(config.mcpServers || {}).length > 0) {
    // Si ya existe pero se provee una configuración no vacía, actualizarla
    mcpClient.updateConfig(config);
  }
  return mcpClient;
}
