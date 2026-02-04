/**
 * Integración MCP en el Core del Agente QodeIA
 * 
 * Este archivo incorpora las herramientas MCP sin romper la funcionalidad existente.
 */

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getMCPClient } from '../../mcp/client';
import { 
  queryDocumentation, 
  analyzeImpact,
  syncSolutionToKnowledgeBase,
  verifyArchitecturalDecision 
} from '../tools/mcp_notebooklm';

// Importar herramientas existentes (asumiendo que existen en el repo)
// Nota: En un entorno real, verificaríamos las rutas exactas
const githubTools = {}; 
const supabaseTools = {};
const vercelTools = {};

/**
 * Sistema de prompts con reglas MCP integradas
 */
export const SYSTEM_PROMPT = `
Eres QodeIA, un agente autónomo de desarrollo de software con acceso a:
- GitHub (lectura, escritura, PRs)
- Supabase (base de datos, storage)
- Vercel (despliegues)
- **NotebookLM (documentación técnica verificable)**

## NUEVAS CAPACIDADES MCP

### 1. Consulta de Documentación (OBLIGATORIO)
**REGLA DE ORO**: Antes de modificar esquemas de DB, interfaces compartidas o 
proponer arquitecturas, DEBES consultar queryDocumentation.

### 2. Análisis de Impacto (REQUERIDO para cambios cross-repo)
**USO**: Cuando un cambio afecta múltiples repositorios.

### 3. Verificación Arquitectónica (PREVENTIVO)
**USO**: Antes de proponer nuevas integraciones o cambios estructurales.

### 4. Sincronización de Soluciones (AUTOMÁTICO)
**TRIGGER**: Después de resolver errores exitosamente o cuando el usuario acepta 
una propuesta del Shadow Workspace.

## REGLAS EXISTENTES (MANTENER)
- Shadow Workspace: NUNCA modifiques archivos directamente en la tabla files.
- Memoria Procedural: Si encuentras un error que ya solucionaste, aplícalo.
- Conciencia Estructural: Usa analyzeImpact para análisis cross-repo.

Mantén tu razonamiento transparente y siempre cita fuentes cuando uses MCP.
`;

/**
 * Configuración del agente con MCP
 */
export async function createAgent(options: {
  sessionId: string;
  userId?: string;
  enableMCP?: boolean;
}) {
  const { sessionId, userId, enableMCP = true } = options;

  // Inicializar MCP si está habilitado
  let mcpClient = null;
  if (enableMCP) {
    try {
      mcpClient = getMCPClient();
      // Intentar conectar al servidor principal
      await mcpClient.connect('notebooklm-howard-os');
      console.log('[Agent] MCP habilitado y conectado');
    } catch (error) {
      console.error('[Agent] Error al conectar MCP:', error);
    }
  }

  // Consolidar todas las herramientas
  const tools = {
    ...githubTools,
    ...supabaseTools,
    ...vercelTools,
    ...(enableMCP && mcpClient
      ? {
          queryDocumentation,
          analyzeImpact,
          syncSolutionToKnowledgeBase,
          verifyArchitecturalDecision,
        }
      : {}),
  };

  return {
    sessionId,
    userId,
    tools,
    mcpEnabled: enableMCP && mcpClient !== null,

    async processMessage(message: string) {
      return streamText({
        model: openai('gpt-4-turbo'),
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
        tools,
        maxSteps: 10,
      });
    },

    async cleanup() {
      if (mcpClient) {
        await mcpClient.disconnect();
      }
    },
  };
}
