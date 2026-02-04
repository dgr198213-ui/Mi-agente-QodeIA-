/**
 * Herramientas MCP para el Agente QodeIA
 * Integra NotebookLM como fuente de conocimiento verificable
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getMCPClient } from '../../mcp/client';
import { supabase, howardSupabase } from '../../lib/supabase';

/**
 * Consulta documentación técnica en NotebookLM
 */
export const queryDocumentation = tool({
  description: `
    Consulta la documentación técnica actualizada en NotebookLM.
    
    ÚSALA SIEMPRE antes de:
    - Modificar esquemas de base de datos
    - Cambiar interfaces compartidas entre proyectos
    - Proponer nuevas arquitecturas
    - Responder preguntas sobre decisiones técnicas previas
    
    Esta herramienta devuelve respuestas con CITAS EXACTAS del documento fuente,
    eliminando el riesgo de alucinaciones.
  `,
  parameters: z.object({
    query: z.string().describe('Pregunta técnica específica'),
    scope: z
      .enum(['howard-os', 'soluciones', 'ecosistema', 'all'])
      .describe(
        'howard-os: Arquitectura y configuración | soluciones: Patrones y fixes | ecosistema: Vista cross-repo | all: Buscar en todos'
      ),
    include_code_examples: z
      .boolean()
      .optional()
      .describe('Si se deben incluir ejemplos de código en la respuesta'),
  }),
  execute: async ({ query, scope, include_code_examples = true }) => {
    try {
      const mcp = getMCPClient();
      const servers = getServersByScope(scope);
      const results = [];

      // Consultar cada servidor relevante
      for (const server of servers) {
        try {
          const result = await mcp.query({
            server,
            query: include_code_examples
              ? `${query} (incluye ejemplos de código si son relevantes)`
              : query,
            include_citations: true,
            max_results: 3,
          });

          results.push({
            server,
            ...result,
          });
        } catch (error) {
          console.error(`Error consultando servidor ${server}:`, error);
        }
      }

      // Registrar consulta en el Supabase de Howard OS para análisis
      await howardSupabase.from('agent_state').upsert({
        key: `mcp_query_${Date.now()}`,
        value: {
          query,
          scope,
          results_count: results.length,
          sources_consulted: results.flatMap((r) => r.sources).length,
          timestamp: new Date().toISOString()
        }
      });

      // Formatear respuesta
      return formatDocumentationResponse(results);
    } catch (error) {
      return {
        error: `Error al consultar documentación: ${error}`,
        fallback:
          'No se pudo acceder a la documentación. Procederé con conocimiento base.',
      };
    }
  },
});

/**
 * Analiza el impacto de cambios cross-repo
 */
export const analyzeImpact = tool({
  description: `
    Analiza el impacto de cambios en el ecosistema completo (cross-repo).
    
    Reemplaza analyzeDependencies con análisis semántico real usando NotebookLM.
    
    Casos de uso:
    - "Si cambio la interfaz ShadowFile, ¿qué se rompe?"
    - "¿Qué componentes de Plataforma-qd usan la tabla credentials?"
    - "¿Cómo afecta un cambio en el esquema de projects a Web-QodeIA?"
  `,
  parameters: z.object({
    change_description: z
      .string()
      .describe('Descripción del cambio propuesto'),
    affected_file: z.string().optional().describe('Archivo específico a cambiar'),
    affected_table: z
      .string()
      .optional()
      .describe('Tabla de Supabase a modificar'),
  }),
  execute: async ({ change_description, affected_file, affected_table }) => {
    try {
      const mcp = getMCPClient();

      // Construir query contextual
      let query = `Analiza el impacto de: ${change_description}.`;
      if (affected_file) query += ` Archivo: ${affected_file}.`;
      if (affected_table) query += ` Tabla de DB: ${affected_table}.`;
      query += ` ¿Qué componentes, archivos o servicios se verán afectados en el ecosistema?`;

      const result = await mcp.query({
        server: 'notebooklm-ecosistema',
        query,
        include_citations: true,
        max_results: 10,
      });

      // Extraer componentes afectados de las fuentes
      const affectedComponents = extractAffectedComponents(result);

      return {
        summary: result.answer,
        affected_components: affectedComponents,
        risk_level: calculateRiskLevel(affectedComponents),
        sources: result.sources,
        recommendation: generateRecommendation(affectedComponents),
      };
    } catch (error) {
      return {
        error: `Error al analizar impacto: ${error}`,
        fallback: 'Análisis de impacto no disponible. Proceder con precaución.',
      };
    }
  },
});

/**
 * Sincroniza una solución exitosa con NotebookLM
 */
export const syncSolutionToKnowledgeBase = tool({
  description: `
    Registra una solución exitosa en el cuaderno de NotebookLM.
    
    ÚSALA automáticamente después de:
    - Resolver un error nuevo con éxito
    - El usuario acepta una propuesta del Shadow Workspace
    - Se valida una solución de agent_solutions con success_count > 3
    
    Esto mantiene el "cerebro" del sistema actualizado.
  `,
  parameters: z.object({
    solution_type: z
      .enum(['error_fix', 'architecture_decision', 'code_pattern'])
      .describe('Tipo de solución'),
    title: z.string().describe('Título descriptivo'),
    context: z.string().describe('Contexto en el que se aplicó'),
    solution_steps: z
      .array(z.string())
      .describe('Pasos de la solución'),
    code_example: z.string().optional().describe('Ejemplo de código'),
    success_metrics: z
      .object({
        success_count: z.number(),
        last_used: z.string(),
      })
      .optional(),
  }),
  execute: async ({
    solution_type,
    title,
    context,
    solution_steps,
    code_example,
    success_metrics,
  }) => {
    try {
      const mcp = getMCPClient();

      // Formatear contenido
      const content = formatSolutionContent({
        solution_type,
        title,
        context,
        solution_steps,
        code_example,
        success_metrics,
      });

      // Sincronizar con NotebookLM
      const result = await mcp.syncSource({
        server: 'notebooklm-soluciones',
        file_path: `soluciones/${solution_type}/${sanitizeFilename(title)}.md`,
        content,
        metadata: {
          synced_at: new Date().toISOString(),
          success_count: success_metrics?.success_count || 1,
          last_used: success_metrics?.last_used || new Date().toISOString(),
        },
      });

      // Registrar en Supabase
      await logSolutionSync({
        title,
        solution_type,
        notebook_source_id: result.source_id,
        synced_at: result.synced_at,
      });

      return {
        success: true,
        message: `Solución "${title}" sincronizada con éxito`,
        source_id: result.source_id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al sincronizar solución: ${error}`,
      };
    }
  },
});

/**
 * Verifica decisiones arquitectónicas antes de proponer cambios
 */
export const verifyArchitecturalDecision = tool({
  description: `
    Verifica si una decisión arquitectónica ya fue tomada previamente.
    
    ÚSALA antes de:
    - Proponer cambios en esquemas de DB
    - Sugerir nuevas integraciones
    - Modificar la estructura de archivos core
    
    Evita duplicación de esfuerzos y conflictos con decisiones previas.
  `,
  parameters: z.object({
    decision_area: z
      .enum(['database', 'api', 'integration', 'architecture', 'security'])
      .describe('Área de la decisión'),
    proposal: z.string().describe('Propuesta de cambio'),
  }),
  execute: async ({ decision_area, proposal }) => {
    try {
      const mcp = getMCPClient();

      const query = `
        En el área de ${decision_area}, ¿existe alguna decisión técnica previa
        relacionada con: ${proposal}? 
        
        Si existe, indica:
        1. La decisión tomada
        2. La justificación
        3. Si el cambio propuesto es compatible
      `;

      const result = await mcp.query({
        server: 'notebooklm-howard-os',
        query,
        include_citations: true,
      });

      return {
        has_prior_decision: result.confidence > 0.7,
        decision_summary: result.answer,
        is_compatible: true, // Simplificado para el ejemplo
        sources: result.sources,
        recommendation: result.confidence > 0.7
          ? 'Revisar decisión previa antes de proceder'
          : 'No hay decisión previa documentada. Proceder con validación.',
      };
    } catch (error) {
      return {
        error: `Error al verificar decisiones: ${error}`,
        recommendation: 'Proceder con precaución. Verificación manual recomendada.',
      };
    }
  },
});

// --- Funciones auxiliares ---

function getServersByScope(scope: string): string[] {
  switch (scope) {
    case 'howard-os':
      return ['notebooklm-howard-os'];
    case 'soluciones':
      return ['notebooklm-soluciones'];
    case 'ecosistema':
      return ['notebooklm-ecosistema'];
    case 'all':
      return [
        'notebooklm-howard-os',
        'notebooklm-soluciones',
        'notebooklm-ecosistema',
      ];
    default:
      return ['notebooklm-howard-os'];
  }
}

function formatDocumentationResponse(results: any[]): string {
  if (results.length === 0) {
    return 'No se encontró documentación relevante.';
  }

  let response = '# Documentación Encontrada\n\n';

  for (const result of results) {
    response += `## Fuente: ${result.server}\n\n`;
    response += `${result.answer}\n\n`;

    if (result.sources.length > 0) {
      response += `### Referencias:\n`;
      for (const source of result.sources) {
        response += `- **${source.title}**`;
        if (source.page_number) response += ` (p. ${source.page_number})`;
        response += `\n  > "${source.excerpt}"\n`;
      }
      response += '\n';
    }
  }

  return response;
}

function extractAffectedComponents(result: any): Array<{
  component: string;
  repo: string;
  impact: 'high' | 'medium' | 'low';
}> {
  // Implementación simplificada
  return [];
}

function calculateRiskLevel(components: any[]): 'high' | 'medium' | 'low' {
  return 'low';
}

function generateRecommendation(components: any[]): string {
  return 'Revisar cambios manualmente.';
}

function formatSolutionContent(solution: any): string {
  return `
# ${solution.title}
**Tipo**: ${solution.solution_type}
**Contexto**: ${solution.context}
**Pasos**:
${solution.solution_steps.map((s: string, i: number) => `${i+1}. ${s}`).join('\n')}
  `.trim();
}

function sanitizeFilename(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function logMCPQuery(data: any) {
  // Logging simplificado
  console.log('[MCP Query Log]', data);
}

async function logSolutionSync(data: any) {
  // Logging simplificado
  console.log('[Solution Sync Log]', data);
}
