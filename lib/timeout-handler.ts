import { logger } from './logger';

export class TimeoutError extends Error {
  constructor(message: string, public readonly duration: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface TimeoutOptions {
  maxDuration: number; // Milisegundos
  context?: string;
  onTimeout?: () => Promise<void> | void;
}

/**
 * Ejecuta una promesa con timeout automático
 * @example
 * const result = await withTimeout(
 *   fetchData(),
 *   { maxDuration: 5000, context: 'fetch_user_data' }
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { maxDuration, context = 'unknown', onTimeout } = options;

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(async () => {
      logger.warn(
        `Operation timed out after ${maxDuration}ms`,
        context,
        { maxDuration }
      );

      if (onTimeout) {
        try {
          await onTimeout();
        } catch (err) {
          logger.error(
            'Timeout handler failed',
            err as Error,
            context
          );
        }
      }

      reject(new TimeoutError(
        `Operation timed out after ${maxDuration}ms`,
        maxDuration
      ));
    }, maxDuration);

    // Cleanup
    promise.finally(() => clearTimeout(timer));
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Guarda el estado parcial de la ejecución antes del timeout
 */
export async function savePartialState(
  supabase: any,
  projectId: string,
  state: Record<string, any>
): Promise<void> {
  try {
    await supabase
      .from('agent_state')
      .upsert({
        project_id: projectId,
        state: 'partial',
        partial_result: state,
        updated_at: new Date().toISOString(),
      });

    logger.info(
      'Partial state saved successfully',
      'timeout_recovery',
      { projectId }
    );
  } catch (err) {
    logger.error(
      'Failed to save partial state',
      err as Error,
      'timeout_recovery',
      { projectId }
    );
  }
}
