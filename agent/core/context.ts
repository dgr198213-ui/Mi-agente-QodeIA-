/**
 * Inferencia de Contexto determinista para el Agente QodeIA
 */

export type AgentContext = 'code' | 'debug' | 'deploy' | 'db' | 'docs' | 'planning';

export interface ContextInput {
  toolsUsed?: string[];
  error?: boolean;
  userIntent?: string;
  lastContext?: AgentContext;
}

/**
 * Infiere el contexto operativo actual basándose en señales deterministas.
 */
export function inferContext(input: ContextInput): AgentContext {
  const { toolsUsed = [], error = false, userIntent = '', lastContext } = input;

  // 1. Detección por Error (Debug tiene prioridad alta)
  if (error || userIntent.toLowerCase().includes('error') || userIntent.toLowerCase().includes('fail')) {
    return 'debug';
  }

  // 2. Detección por Herramientas usadas recientemente
  if (toolsUsed.some(t => t.includes('vercel') || t.includes('deploy'))) {
    return 'deploy';
  }

  if (toolsUsed.some(t => t.includes('supabase') || t.includes('queryData') || t.includes('insertData'))) {
    return 'db';
  }

  if (toolsUsed.some(t => t.includes('mcp') || t.includes('queryDocumentation'))) {
    return 'docs';
  }

  if (toolsUsed.some(t => t.includes('github') || t.includes('read_file') || t.includes('write_file'))) {
    return 'code';
  }

  // 3. Detección por Intención del usuario (Keywords)
  const intent = userIntent.toLowerCase();
  if (intent.includes('design') || intent.includes('plan') || intent.includes('architect')) {
    return 'planning';
  }

  if (intent.includes('deploy') || intent.includes('production') || intent.includes('vercel')) {
    return 'deploy';
  }

  if (intent.includes('database') || intent.includes('table') || intent.includes('sql') || intent.includes('supabase')) {
    return 'db';
  }

  if (intent.includes('doc') || intent.includes('read') || intent.includes('learn')) {
    return 'docs';
  }

  if (intent.includes('debug') || intent.includes('fix') || intent.includes('bug') || intent.includes('broken')) {
    return 'debug';
  }

  // 4. Default o Continuidad
  return lastContext || 'code';
}
