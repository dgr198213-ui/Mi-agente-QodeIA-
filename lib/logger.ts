import { createClient } from '@supabase/supabase-js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

class Logger {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    // Inicializar Supabase solo si las credenciales están disponibles
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  private async persistError(entry: LogEntry): Promise<void> {
    if (!this.supabase || process.env.NODE_ENV === 'development') {
      return; // No persistir en desarrollo o si Supabase no está configurado
    }

    try {
      await this.supabase.from('error_logs').insert({
        level: entry.level,
        message: entry.message,
        context: entry.context,
        metadata: entry.metadata,
        error_details: entry.error,
        created_at: entry.timestamp,
      });
    } catch (err) {
      // Fallback silencioso - no queremos que el logger rompa la app
      console.error('Failed to persist log:', err);
    }
  }

  private formatEntry(entry: LogEntry): string {
    if (process.env.NODE_ENV === 'development') {
      return JSON.stringify(entry, null, 2);
    }
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
    };

    console.log(this.formatEntry(entry));

    // Persistir solo errores y warnings
    if (level === 'error' || level === 'warn') {
      this.persistError(entry).catch(() => {
        // Silencioso - ya logueado en consola
      });
    }
  }

  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, context, metadata);
    }
  }

  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }

  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }

  error(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    };

    console.error(this.formatEntry(entry));
    this.persistError(entry).catch(() => {
      // Silencioso
    });
  }
}

export const logger = new Logger();
