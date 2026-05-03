/**
 * QodeIA Enhanced Agent - Workflow Optimized
 * Agente autónomo mejorado con workflow optimizado y CME integrado
 */

import { generateText, streamText, CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getMCPClient } from '@/mcp/client';
import mcpConfig from '@/mcp_config.json';
import {
  queryDocumentation,
  analyzeImpact,
  syncSolutionToKnowledgeBase,
  verifyArchitecturalDecision
} from '@/agent/tools/mcp_notebooklm';
import { supabaseTools } from '@/agent/tools/supabase';
import { githubTools } from '@/agent/tools/github';
import { vercelTools } from '@/agent/tools/vercel';
import { inferContext } from './context';
import { recordTransition, ensureToolNode, getPageRankScores } from './governance';
import { supabase } from '@/lib/supabase';
import { EnhancedContextMemoryEngine, type SearchResult } from './EnhancedContextMemory';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
}

export interface ToolCall {
  toolName: string;
  args: Record<string, any>;
  result?: any;
  duration?: number;
  success: boolean;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  result?: any;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: string;
  args: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  duration?: number;
}

export interface AgentConfig {
  sessionId: string;
  userId?: string;
  organizationId?: string;
  projectId?: string;
  enableMCP?: boolean;
  enableCME?: boolean;
  maxSteps?: number;
  temperature?: number;
  model?: string;
}

export interface AgentResponse {
  message: AgentMessage;
  workflow?: AgentWorkflow;
  contextUsed: SearchResult[];
  tokensUsed: number;
  duration: number;
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `
Eres QodeIA CEO, un agente autónomo de orquestación para el ecosistema QodeIA.

## RESPONSABILIDADES
1. Enrutar tareas a especialistas (GitHub, Supabase, Vercel, MCP)
2. Validar outputs y garantizar coherencia
3. Gestionar memoria contextual (CME)
4. Registrar transiciones para PageRank

## ESPECIALISTAS DISPONIBLES
- GitHubExpert: Operaciones de GitHub (repos, PRs, issues)
- SupabaseExpert: Base de datos, autenticación, storage
- VercelExpert: Despliegues, configuración, logs
- MCPExpert: Documentación técnica, análisis de impacto

## REGLAS DE EJECUCIÓN
- SIEMPRE consulta documentación antes de cambios arquitectónicos
- NUNCA modifiques datos sin validación
- REGISTRA cada transición para gobernanza
- Usa memoria contextual para optimizar decisiones

Mantén razonamiento transparente y cita fuentes.

## CAPACIDADES CORE

### GitHub Integration
- Lectura y escritura de archivos
- Creación de branches y PRs
- Gestión de issues
- Revisión de código

### Supabase Integration
- Operaciones CRUD en base de datos
- Gestión de archivos en storage
- Consulta de datos con filtros avanzados

### Vercel Integration
- Despliegues automáticos
- Monitoreo de proyectos
- Gestión de dominios

### NotebookLM MCP (Knowledge Base)
- Consulta de documentación técnica verificable
- Análisis de impacto cross-repo
- Verificación arquitectónica
- Sincronización de soluciones

## REGLAS DE OPERACIÓN

### 1. Shadow Workspace
NUNCA modifiques archivos directamente. Usa el workspace virtual.

### 2. Memoria Procedural
Si encuentras un error que ya solucionaste antes, aplica la solución automáticamente.

### 3. Análisis de Impacto
Para cambios en múltiples repositorios, usa analyzeImpact ANTES de ejecutar.

### 4. Verificación Arquitectónica
Antes de proponer nuevas integraciones, usa verifyArchitecturalDecision.

### 5. CME Integration
Usa el Context Memory Engine para mantener contexto del proyecto.

### 6. Workflow Execution
Para tareas complejas, genera un plan de workflow con pasos claros.

## ESTILO DE RESPUESTA
- Sé conciso pero completo
- Muestra tu razonamiento paso a paso
- Incluye ejemplos cuando sea útil
- Confirma antes de ejecutar acciones destructivas
`;

const WORKFLOW_GENERATION_PROMPT = `
Eres un planificador de workflows para agentes de IA.

Analiza la solicitud del usuario y genera un plan de workflow estructurado.

## FORMATO DE RESPUESTA

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "workflow": {
    "name": "Nombre del workflow",
    "steps": [
      {
        "id": "step-1",
        "name": "Nombre del paso",
        "description": "Descripción detallada",
        "action": "nombre_de_la_herramienta",
        "args": { "param1": "valor1" }
      }
    ]
  }
}

## REGLAS

- Máximo 10 pasos por workflow
- Cada paso debe ser atómico
- Incluir herramienta correcta para cada acción
- Estimar duración de cada paso
`;

// ============================================================================
// ENHANCED AGENT CLASS
// ============================================================================

export class EnhancedAgent {
  private config: AgentConfig;
  private mcpClient: any = null;
  private cme: EnhancedContextMemoryEngine | null = null;
  private tools: Record<string, any> = {};
  private conversationHistory: AgentMessage[] = [];
  private startTime: number = 0;

  constructor(config: AgentConfig) {
    this.config = {
      enableMCP: true,
      enableCME: true,
      maxSteps: 10,
      temperature: 0.7,
      model: 'gpt-4-turbo',
      ...config,
    };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    this.startTime = Date.now();

    // Initialize MCP if enabled
    if (this.config.enableMCP) {
      await this.initializeMCP();
    }

    // Initialize CME if enabled
    if (this.config.enableCME && this.config.organizationId) {
      await this.initializeCME();
    }

    // Load tools
    await this.loadTools();

    // Record initialization
    console.log(`[EnhancedAgent] Initialized for session: ${this.config.sessionId}`);
  }

  private async initializeMCP(): Promise<void> {
    try {
      this.mcpClient = getMCPClient(mcpConfig);
      await this.mcpClient.connect('notebooklm-howard-os');
      console.log('[EnhancedAgent] MCP connected');
    } catch (error) {
      console.warn('[EnhancedAgent] MCP connection failed, continuing without it:', error);
    }
  }

  private async initializeCME(): Promise<void> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      this.cme = new EnhancedContextMemoryEngine(supabaseUrl, supabaseKey);
      await this.cme.initializeProject(this.config.projectId || this.config.sessionId);
      console.log('[EnhancedAgent] CME initialized');
    } catch (error) {
      console.warn('[EnhancedAgent] CME initialization failed:', error);
    }
  }

  private async loadTools(): Promise<void> {
    // Load base tools
    this.tools = {
      ...githubTools,
      ...supabaseTools,
      ...vercelTools,
    };

    // Add MCP tools if available
    if (this.config.enableMCP && this.mcpClient) {
      this.tools = {
        ...this.tools,
        queryDocumentation,
        analyzeImpact,
        syncSolutionToKnowledgeBase,
        verifyArchitecturalDecision,
      };
    }

    // Add workflow generation tool
    this.tools.generateWorkflow = {
      description: 'Genera un plan de workflow estructurado para tareas complejas',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Descripción de la tarea a planificar'
          }
        },
        required: ['task']
      }
    };

    // Register tools in PageRank
    for (const toolKey of Object.keys(this.tools)) {
      await ensureToolNode(toolKey);
    }
    await ensureToolNode('user_input');
  }

  // ============================================================================
  // MESSAGE PROCESSING
  // ============================================================================

  async processMessage(message: string): Promise<AgentResponse> {
    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    this.conversationHistory.push(userMessage);

    // Get relevant context from CME
    const relevantContext = this.config.enableCME && this.cme
      ? await this.cme.search(this.config.projectId || this.config.sessionId, message, 5)
      : [];

    // Infer context type
    const contextType = inferContext({ userIntent: message });

    // Get ranked tools based on PageRank
    const rankedTools = await this.getRankedTools(contextType);

    // Build system prompt with context
    const systemWithContext = `${SYSTEM_PROMPT}

## CONTEXTO OPERATIVO: ${contextType.toUpperCase()}

${relevantContext.length > 0 ? `## CONTEXTO RELEVANTE DEL PROYECTO
${relevantContext.map(r => `- [${r.entry.type}]: ${r.entry.content.substring(0, 200)}... (relevancia: ${(r.relevance * 100).toFixed(0)}%)`).join('\n')}` : ''}`;

    // Generate response
    const result = await generateText({
      model: openai(this.config.model!),
      system: systemWithContext,
      messages: this.conversationHistory as CoreMessage[],
      tools: rankedTools,
      maxSteps: this.config.maxSteps,
      temperature: this.config.temperature,
      onStepFinish: async (step) => {
        // Record tool transitions
        if (step.toolCalls) {
          for (const call of step.toolCalls) {
            await recordTransition('user_input', call.toolName, contextType);

            // Add to CME if enabled
            if (this.config.enableCME && this.cme) {
              await this.cme.addEntry(this.config.projectId || this.config.sessionId, {
                type: 'tool',
                content: `${call.toolName}: ${JSON.stringify(call.args)}`,
                importance: 0.8,
                metadata: { result: call.result },
              });
            }
          }
        }
      },
    });

    // Build assistant message
    const assistantMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: result.text,
      timestamp: new Date().toISOString(),
      toolCalls: result.toolCalls?.map(tc => ({
        toolName: tc.toolName,
        args: tc.args,
        result: tc.result,
        success: true,
      })),
    };

    this.conversationHistory.push(assistantMessage);

    // Calculate stats
    const tokensUsed = result.usage?.totalTokens || 0;
    const duration = Date.now() - this.startTime;

    return {
      message: assistantMessage,
      contextUsed: relevantContext,
      tokensUsed,
      duration,
    };
  }

  // ============================================================================
  // WORKFLOW PROCESSING
  // ============================================================================

  async generateWorkflow(task: string): Promise<AgentWorkflow> {
    const result = await generateText({
      model: openai('gpt-4-turbo'),
      system: WORKFLOW_GENERATION_PROMPT,
      messages: [{ role: 'user', content: task }],
      maxSteps: 1,
    });

    try {
      const workflowData = JSON.parse(result.text);
      return {
        id: `workflow-${Date.now()}`,
        name: workflowData.workflow.name,
        steps: workflowData.workflow.steps.map((step: any, index: number) => ({
          id: `step-${index + 1}`,
          name: step.name,
          description: step.description,
          action: step.action,
          args: step.args || {},
          status: 'pending',
        })),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[EnhancedAgent] Failed to parse workflow:', error);
      return {
        id: `workflow-${Date.now()}`,
        name: 'Workflow',
        steps: [],
        status: 'failed',
        createdAt: new Date().toISOString(),
        result: { error: 'Failed to generate workflow' },
      };
    }
  }

  async executeWorkflow(workflow: AgentWorkflow): Promise<AgentWorkflow> {
    workflow.status = 'running';

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepStart = Date.now();

      try {
        step.status = 'running';

        // Check if step has required action
        if (this.tools[step.action]) {
          const result = await this.tools[step.action](step.args);
          step.result = result;
          step.status = 'completed';
        } else {
          step.status = 'skipped';
          step.error = `Tool ${step.action} not found`;
        }

        step.duration = Date.now() - stepStart;
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : 'Unknown error';
        step.duration = Date.now() - stepStart;
      }
    }

    workflow.status = workflow.steps.every(s => s.status === 'completed') ? 'completed' : 'failed';
    workflow.completedAt = new Date().toISOString();

    return workflow;
  }

  // ============================================================================
  // STREAMING
  // ============================================================================

  async *processMessageStream(message: string): AsyncGenerator<string> {
    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    this.conversationHistory.push(userMessage);

    const contextType = inferContext({ userIntent: message });
    const rankedTools = await this.getRankedTools(contextType);

    const systemWithContext = `${SYSTEM_PROMPT}\n\n## CONTEXTO OPERATIVO: ${contextType.toUpperCase()}`;

    const result = await streamText({
      model: openai(this.config.model!),
      system: systemWithContext,
      messages: this.conversationHistory as CoreMessage[],
      tools: rankedTools,
      maxSteps: this.config.maxSteps,
    });

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        yield chunk.textDelta;
      }
    }
  }

  // ============================================================================
  // TOOL RANKING
  // ============================================================================

  private async getRankedTools(context: string): Promise<Record<string, any>> {
    try {
      const ranks = await getPageRankScores(context);

      const prioritizedTools: Record<string, any> = {};
      const sortedTools = Object.entries(this.tools)
        .map(([key, tool]) => ({
          key,
          tool,
          rank: ranks[key] || 0,
        }))
        .sort((a, b) => b.rank - a.rank);

      for (const { key, tool } of sortedTools) {
        prioritizedTools[key] = {
          ...tool,
          description: `[Rank: ${(ranks[key] || 0).toFixed(2)}] ${tool.description}`,
        };
      }

      return prioritizedTools;
    } catch (error) {
      console.error('[EnhancedAgent] Error ranking tools:', error);
      return this.tools;
    }
  }

  // ============================================================================
  // CME INTEGRATION
  // ============================================================================

  async addContextToProject(entry: {
    type: 'file' | 'import' | 'function' | 'component';
    content: string;
    path?: string;
    importance?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.cme || !this.config.projectId) return;

    await this.cme.addEntry(this.config.projectId, {
      ...entry,
      importance: entry.importance || 0.5,
    });
  }

  async getProjectContext(query: string, limit?: number): Promise<SearchResult[]> {
    if (!this.cme || !this.config.projectId) return [];

    return this.cme.search(this.config.projectId, query, limit || 10);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanup(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
    }

    if (this.cme && this.config.projectId) {
      this.cme.destroyProject(this.config.projectId);
    }

    this.conversationHistory = [];
  }

  // ============================================================================
  // STATS
  // ============================================================================

  getStats(): {
    conversationLength: number;
    toolsLoaded: number;
    mcpEnabled: boolean;
    cmeEnabled: boolean;
    uptime: number;
  } {
    return {
      conversationLength: this.conversationHistory.length,
      toolsLoaded: Object.keys(this.tools).length,
      mcpEnabled: this.mcpClient !== null,
      cmeEnabled: this.cme !== null,
      uptime: Date.now() - this.startTime,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export async function createEnhancedAgent(config: AgentConfig): Promise<EnhancedAgent> {
  const agent = new EnhancedAgent(config);
  await agent.initialize();
  return agent;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default EnhancedAgent;
