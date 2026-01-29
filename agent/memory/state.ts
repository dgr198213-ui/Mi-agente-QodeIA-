import { saveAgentState, getAgentState } from '@/lib/supabase';

/**
 * Clase para gestionar el estado persistente del agente
 * Permite guardar y recuperar información de estado entre sesiones
 */
export class AgentStateManager {
  private cache: Map<string, any> = new Map();

  /**
   * Guarda un valor en el estado del agente
   */
  async set(key: string, value: any): Promise<void> {
    try {
      await saveAgentState(key, value);
      this.cache.set(key, value);
    } catch (error) {
      console.error(`Error setting agent state for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene un valor del estado del agente
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    // Verificar cache primero
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    try {
      const state = await getAgentState(key);
      if (state) {
        this.cache.set(key, state.value);
        return state.value;
      }
      return defaultValue;
    } catch (error) {
      console.error(`Error getting agent state for key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Verifica si existe una clave en el estado
   */
  async has(key: string): Promise<boolean> {
    if (this.cache.has(key)) {
      return true;
    }

    try {
      const state = await getAgentState(key);
      return state !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Incrementa un contador en el estado
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) || 0;
    const newValue = current + amount;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Agrega un elemento a un array en el estado
   */
  async pushToArray(key: string, item: any): Promise<any[]> {
    const current = (await this.get<any[]>(key)) || [];
    const newArray = [...current, item];
    await this.set(key, newArray);
    return newArray;
  }

  /**
   * Actualiza un objeto en el estado (merge)
   */
  async updateObject(key: string, updates: Record<string, any>): Promise<any> {
    const current = (await this.get<Record<string, any>>(key)) || {};
    const newObject = { ...current, ...updates };
    await this.set(key, newObject);
    return newObject;
  }

  /**
   * Limpia el cache local
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Obtiene todas las claves del cache
   */
  getCachedKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Instancia singleton del gestor de estado
let stateManagerInstance: AgentStateManager | null = null;

/**
 * Obtiene la instancia singleton del gestor de estado
 */
export function getStateManager(): AgentStateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new AgentStateManager();
  }
  return stateManagerInstance;
}

/**
 * Claves predefinidas para el estado del agente
 */
export const StateKeys = {
  // Contadores
  TOTAL_TASKS_COMPLETED: 'total_tasks_completed',
  TOTAL_MESSAGES_PROCESSED: 'total_messages_processed',
  TOTAL_ERRORS: 'total_errors',
  TOTAL_GITHUB_OPERATIONS: 'total_github_operations',
  TOTAL_VERCEL_DEPLOYMENTS: 'total_vercel_deployments',

  // Configuración
  CURRENT_MODE: 'current_mode',
  LAST_ACTIVE_SESSION: 'last_active_session',
  AGENT_PERSONALITY: 'agent_personality',

  // Estado de tareas
  ACTIVE_TASKS: 'active_tasks',
  PENDING_TASKS_QUEUE: 'pending_tasks_queue',
  COMPLETED_TASKS_HISTORY: 'completed_tasks_history',

  // Aprendizaje
  LEARNED_PATTERNS: 'learned_patterns',
  USER_PREFERENCES: 'user_preferences',
  COMMON_ERRORS: 'common_errors',

  // GitHub
  LAST_BRANCH_CREATED: 'last_branch_created',
  LAST_PR_NUMBER: 'last_pr_number',
  GITHUB_OPERATIONS_LOG: 'github_operations_log',

  // Vercel
  LAST_DEPLOYMENT_ID: 'last_deployment_id',
  DEPLOYMENT_HISTORY: 'deployment_history',

  // Metadata
  AGENT_VERSION: 'agent_version',
  LAST_UPDATED: 'last_updated',
  INITIALIZATION_DATE: 'initialization_date',
};

/**
 * Inicializa el estado del agente con valores por defecto
 */
export async function initializeAgentState(): Promise<void> {
  const stateManager = getStateManager();

  // Verificar si ya está inicializado
  const isInitialized = await stateManager.has(StateKeys.INITIALIZATION_DATE);

  if (!isInitialized) {
    // Inicializar contadores
    await stateManager.set(StateKeys.TOTAL_TASKS_COMPLETED, 0);
    await stateManager.set(StateKeys.TOTAL_MESSAGES_PROCESSED, 0);
    await stateManager.set(StateKeys.TOTAL_ERRORS, 0);
    await stateManager.set(StateKeys.TOTAL_GITHUB_OPERATIONS, 0);
    await stateManager.set(StateKeys.TOTAL_VERCEL_DEPLOYMENTS, 0);

    // Inicializar arrays
    await stateManager.set(StateKeys.ACTIVE_TASKS, []);
    await stateManager.set(StateKeys.PENDING_TASKS_QUEUE, []);
    await stateManager.set(StateKeys.COMPLETED_TASKS_HISTORY, []);
    await stateManager.set(StateKeys.GITHUB_OPERATIONS_LOG, []);
    await stateManager.set(StateKeys.DEPLOYMENT_HISTORY, []);

    // Inicializar objetos
    await stateManager.set(StateKeys.LEARNED_PATTERNS, {});
    await stateManager.set(StateKeys.USER_PREFERENCES, {});
    await stateManager.set(StateKeys.COMMON_ERRORS, {});

    // Metadata
    await stateManager.set(StateKeys.AGENT_VERSION, '1.0.0');
    await stateManager.set(StateKeys.INITIALIZATION_DATE, new Date().toISOString());
    await stateManager.set(StateKeys.LAST_UPDATED, new Date().toISOString());

    console.log('Agent state initialized successfully');
  }
}

/**
 * Obtiene un resumen del estado actual del agente
 */
export async function getAgentStateSummary(): Promise<string> {
  const stateManager = getStateManager();

  const tasksCompleted = await stateManager.get(StateKeys.TOTAL_TASKS_COMPLETED, 0);
  const messagesProcessed = await stateManager.get(StateKeys.TOTAL_MESSAGES_PROCESSED, 0);
  const githubOps = await stateManager.get(StateKeys.TOTAL_GITHUB_OPERATIONS, 0);
  const vercelDeploys = await stateManager.get(StateKeys.TOTAL_VERCEL_DEPLOYMENTS, 0);
  const errors = await stateManager.get(StateKeys.TOTAL_ERRORS, 0);
  const version = await stateManager.get(StateKeys.AGENT_VERSION, 'unknown');

  return `
Estado del Agente (v${version}):
- Tareas completadas: ${tasksCompleted}
- Mensajes procesados: ${messagesProcessed}
- Operaciones GitHub: ${githubOps}
- Deployments Vercel: ${vercelDeploys}
- Errores registrados: ${errors}
  `.trim();
}
