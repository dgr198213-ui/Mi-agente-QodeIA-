/**
 * MCP Client para QodeIA
 * Gestiona la conexión con servidores MCP (NotebookLM)
 *
 * Mejoras aplicadas (Auditoría 2026-04-16):
 * - Reintentos automáticos con backoff exponencial para llamadas a servidores externos
 * - Manejo robusto de errores de red y reconexión automática
 * - Limpieza de procesos huérfanos al desconectar
 * - Gestión de estado de conexión para evitar conexiones duplicadas
 * - Logging estructurado para diagnóstico
 */

import { spawn, ChildProcess } from 'child_process';
import { z } from 'zod';
import { supabase } from '../lib/supabase';

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
 * Implementa backoff exponencial con jitter para reintentos.
 * @param attempt - Número de intento actual (0-indexed)
 * @param baseDelayMs - Delay base en milisegundos (default: 1000ms)
 * @param maxDelayMs - Delay máximo en milisegundos (default: 30000ms)
 */
function exponentialBackoff(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 30000
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  // Añadir jitter aleatorio (±20%) para evitar thundering herd
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Espera un número de milisegundos.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cliente MCP principal
 */
export class MCPClient {
  private config: MCPConfig;
  private servers: Map<string, ChildProcess> = new Map();
  private connectingServers: Set<string> = new Set(); // Previene conexiones duplicadas
  private cache: Map<string, { data: any; expires: number }> = new Map();

  constructor(config?: any) {
    if (config) {
      this.config = MCPConfigSchema.parse(config);
    } else {
      this.config = {
        mcpServers: {},
        defaults: {
          timeout: 30000,
          retries: 3,
          cache: { enabled: true, ttl: 3600 },
        },
      };
    }
  }

  /**
   * Carga la configuración desde un objeto
   */
  static fromConfig(config: any): MCPClient {
    return new MCPClient(config);
  }

  /**
   * Inicializa conexión con un servidor MCP específico.
   * Es idempotente: si ya está conectado, no hace nada.
   */
  async connect(serverName: string): Promise<void> {
    // Si ya está conectado y el proceso está vivo, no reconectar
    const existing = this.servers.get(serverName);
    if (existing && existing.exitCode === null && !existing.killed) {
      return;
    }

    // Evitar conexiones duplicadas concurrentes
    if (this.connectingServers.has(serverName)) {
      // Esperar a que la conexión en curso termine
      await sleep(500);
      if (this.servers.has(serverName)) return;
    }

    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig || !serverConfig.enabled) {
      throw new Error(`Servidor MCP "${serverName}" no encontrado o deshabilitado`);
    }

    this.connectingServers.add(serverName);

    try {
      // Reemplazar variables de entorno
      const env = { ...process.env };
      for (const [key, value] of Object.entries(serverConfig.env)) {
        const envValue = (value as string).replace(/\$\{(\w+)\}/g, (_, varName) => {
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

      // Logging estructurado
      child.stdout?.on('data', (data) => {
        console.log(`[MCP:${serverName}] stdout: ${data.toString().trim()}`);
      });

      child.stderr?.on('data', (data) => {
        console.error(`[MCP:${serverName}] stderr: ${data.toString().trim()}`);
      });

      // Manejar cierre inesperado del proceso
      child.on('exit', (code, signal) => {
        console.warn(`[MCP:${serverName}] Proceso terminado (code=${code}, signal=${signal})`);
        this.servers.delete(serverName);
      });

      child.on('error', (err) => {
        console.error(`[MCP:${serverName}] Error de proceso: ${err.message}`);
        this.servers.delete(serverName);
      });

      // Esperar a que el servidor esté listo
      await this.waitForReady(child, serverName);
      console.log(`[MCP:${serverName}] Conectado exitosamente`);
    } finally {
      this.connectingServers.delete(serverName);
    }
  }

  /**
   * Consulta un cuaderno de NotebookLM con reintentos automáticos.
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

    // Conectar si no está conectado
    if (!this.servers.has(server)) {
      await this.connect(server);
    }

    // Enviar solicitud MCP con reintentos
    const result = await this.sendRequestWithRetry(server, {
      method: 'query_notebook',
      params: { query, include_citations, max_results },
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
   * Lista todos los cuadernos disponibles con reintentos.
   */
  async listNotebooks(server: string): Promise<MCPNotebook[]> {
    if (!this.servers.has(server)) {
      await this.connect(server);
    }

    return await this.sendRequestWithRetry(server, {
      method: 'list_notebooks',
      params: {},
    });
  }

  /**
   * Sincroniza un archivo con NotebookLM con reintentos.
   */
  async syncSource(params: {
    server: string;
    file_path: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<MCPSyncResult> {
    const { server, file_path, content, metadata } = params;

    if (!this.servers.has(server)) {
      await this.connect(server);
    }

    return await this.sendRequestWithRetry(server, {
      method: 'sync_source',
      params: { file_path, content, metadata },
    });
  }

  /**
   * Obtiene contexto específico de un cuaderno con reintentos.
   */
  async getContext(params: {
    server: string;
    source_id?: string;
    query?: string;
  }): Promise<string> {
    const { server, source_id, query } = params;

    if (!this.servers.has(server)) {
      await this.connect(server);
    }

    const result = await this.sendRequestWithRetry(server, {
      method: 'get_context',
      params: { source_id, query },
    });

    return result.context;
  }

  /**
   * Cierra todas las conexiones MCP de forma limpia.
   */
  async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const [name, child] of this.servers.entries()) {
      disconnectPromises.push(
        new Promise<void>((resolve) => {
          if (child.killed || child.exitCode !== null) {
            resolve();
            return;
          }
          child.once('exit', () => resolve());
          child.kill('SIGTERM');
          // Forzar SIGKILL si no termina en 3s
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
            resolve();
          }, 3000);
        })
      );
      console.log(`[MCP:${name}] Desconectando...`);
    }

    await Promise.all(disconnectPromises);
    this.servers.clear();
    this.cache.clear();
    console.log('[MCP] Todas las conexiones cerradas');
  }

  // --- Métodos privados ---

  /**
   * Espera a que el servidor MCP esté listo para recibir solicitudes.
   */
  private async waitForReady(
    child: ChildProcess,
    serverName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout esperando servidor MCP "${serverName}" (${this.config.defaults.timeout}ms)`));
      }, this.config.defaults.timeout);

      const onData = (data: Buffer) => {
        const text = data.toString();
        if (text.includes('ready') || text.includes('listening') || text.includes('started')) {
          clearTimeout(timeout);
          child.stdout?.off('data', onData);
          resolve();
        }
      };

      child.stdout?.on('data', onData);

      child.once('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Error al iniciar servidor MCP "${serverName}": ${err.message}`));
      });

      child.once('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Servidor MCP "${serverName}" terminó prematuramente con código ${code}`));
        }
      });
    });
  }

  /**
   * Envía una solicitud al servidor MCP con reintentos y backoff exponencial.
   */
  private async sendRequestWithRetry(
    server: string,
    request: { method: string; params: any }
  ): Promise<any> {
    const maxRetries = this.config.defaults.retries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // En reintentos, verificar si necesitamos reconectar
        if (attempt > 0) {
          const child = this.servers.get(server);
          if (!child || child.killed || child.exitCode !== null) {
            console.warn(`[MCP:${server}] Reconectando (intento ${attempt}/${maxRetries})...`);
            this.servers.delete(server);
            await this.connect(server);
          }

          const delayMs = exponentialBackoff(attempt - 1);
          console.warn(`[MCP:${server}] Reintentando en ${delayMs}ms (intento ${attempt}/${maxRetries})...`);
          await sleep(delayMs);
        }

        return await this.sendRequest(server, request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[MCP:${server}] Error en intento ${attempt}: ${lastError.message}`);

        // No reintentar en errores de lógica (solo en errores de red/timeout)
        if (
          lastError.message.includes('no conectado') ||
          lastError.message.includes('no encontrado')
        ) {
          break;
        }
      }
    }

    throw new Error(
      `[MCP:${server}] Falló después de ${maxRetries} reintentos. Último error: ${lastError?.message}`
    );
  }

  /**
   * Envía una solicitud al servidor MCP y espera la respuesta.
   */
  private async sendRequest(
    server: string,
    request: { method: string; params: any }
  ): Promise<any> {
    const child = this.servers.get(server);
    if (!child || child.killed || child.exitCode !== null) {
      throw new Error(`Servidor MCP "${server}" no conectado`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.stdout?.off('data', onData);
        reject(new Error(`Timeout en solicitud MCP a "${server}" (${this.config.defaults.timeout}ms)`));
      }, this.config.defaults.timeout);

      // Enviar solicitud
      const payload = JSON.stringify(request) + '\n';
      const written = child.stdin?.write(payload);
      if (!written) {
        clearTimeout(timeout);
        reject(new Error(`No se pudo escribir en stdin del servidor MCP "${server}"`));
        return;
      }

      // Esperar respuesta
      const onData = (data: Buffer) => {
        clearTimeout(timeout);
        child.stdout?.off('data', onData);
        try {
          // Manejar respuestas fragmentadas o múltiples líneas
          const lines = data.toString().trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const response = JSON.parse(line);
              if (response.error) {
                reject(new Error(typeof response.error === 'string' ? response.error : JSON.stringify(response.error)));
              } else {
                resolve(response.result ?? response);
              }
              return;
            } catch {
              // Continuar con la siguiente línea si no es JSON válido
            }
          }
          reject(new Error(`Respuesta MCP no válida de "${server}": ${data.toString().substring(0, 200)}`));
        } catch (error) {
          reject(error);
        }
      };

      child.stdout?.on('data', onData);
    });
  }
}

// Singleton global con soporte para actualización de configuración
let mcpClient: MCPClient | null = null;

export function getMCPClient(config?: any): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient(config);
  } else if (config) {
    // Actualizar configuración del singleton si se proporciona nueva configuración
    mcpClient = new MCPClient(config);
  }
  return mcpClient;
}

/**
 * Resetea el singleton (útil para tests)
 */
export function resetMCPClient(): void {
  if (mcpClient) {
    mcpClient.disconnect().catch(() => {});
    mcpClient = null;
  }
}
