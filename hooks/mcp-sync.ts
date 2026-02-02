/**
 * Hooks MCP para Plataforma-qd
 * 
 * Sincroniza automáticamente cambios aprobados con NotebookLM
 */

import { getMCPClient } from '@/mcp/client';

/**
 * Hook: onShadowFileAccepted
 * 
 * Se ejecuta cuando el usuario acepta una propuesta del Shadow Workspace
 */
export async function onShadowFileAccepted(shadowFile: any) {
  try {
    const mcpClient = getMCPClient();
    
    const syncResult = await mcpClient.syncSource({
      server: 'notebooklm-howard-os',
      file_path: shadowFile.file_path,
      content: shadowFile.proposed_content,
      metadata: {
        confidence_score: shadowFile.confidence_score,
        applied_at: new Date().toISOString(),
        diff_summary: shadowFile.diff_summary,
        original_hash: shadowFile.original_hash,
      },
    });

    console.log(`[MCP Sync] Shadow file sincronizado: ${syncResult.source_id}`);

    // Actualizar estado en Supabase (simulado)
    await updateShadowFileStatus(shadowFile.id, {
      synced_to_notebooklm: true,
      notebooklm_source_id: syncResult.source_id,
      synced_at: syncResult.synced_at,
    });

    return {
      success: true,
      message: 'Cambio aplicado y sincronizado con base de conocimiento',
    };
  } catch (error) {
    console.error('[MCP Sync] Error al sincronizar:', error);
    
    return {
      success: true,
      warning: 'Cambio aplicado pero no sincronizado con NotebookLM',
    };
  }
}

/**
 * Hook: onAgentSolutionSuccess
 * 
 * Se ejecuta cuando una solución de agent_solutions supera 3 usos exitosos
 */
export async function onAgentSolutionSuccess(solution: any) {
  if (solution.success_count < 3) {
    return; // Solo sincronizar soluciones validadas
  }

  try {
    const mcpClient = getMCPClient();
    
    await mcpClient.syncSource({
      server: 'notebooklm-soluciones',
      file_path: `soluciones/validated/${sanitizeFilename(solution.error_signature)}.md`,
      content: formatSolutionContent(solution),
      metadata: {
        success_count: solution.success_count,
        last_used: solution.last_used,
        error_signature: solution.error_signature,
      },
    });

    console.log(`[MCP Sync] Solución validada sincronizada: ${solution.error_signature}`);
  } catch (error) {
    console.error('[MCP Sync] Error al sincronizar solución:', error);
  }
}

/**
 * Hook: onProjectStructureChange
 * 
 * Se ejecuta cuando hay cambios significativos en la estructura del proyecto
 */
export async function onProjectStructureChange(project: any) {
  try {
    const mcpClient = getMCPClient();
    
    // Generar snapshot de estructura
    const structure = generateProjectStructure(project);
    
    await mcpClient.syncSource({
      server: 'notebooklm-ecosistema',
      file_path: `proyectos/${project.name}/estructura.md`,
      content: structure,
      metadata: {
        project_id: project.id,
        files_count: project.files?.length || 0,
        updated_at: new Date().toISOString(),
      },
    });

    console.log(`[MCP Sync] Estructura de proyecto sincronizada: ${project.name}`);
  } catch (error) {
    console.error('[MCP Sync] Error al sincronizar estructura:', error);
  }
}

// --- Helpers ---

async function updateShadowFileStatus(shadowFileId: string, updates: any) {
  // Implementación simplificada
  console.log(`[Supabase Update] Shadow file ${shadowFileId} actualizado`, updates);
}

function formatSolutionContent(solution: any) {
  return `
# ${solution.error_signature}
**Tipo**: Error Fix
**Validada**: ${solution.success_count} veces
**Última aplicación**: ${solution.last_used}
**Solución**:
${solution.solution_steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}
  `.trim();
}

function generateProjectStructure(project: any) {
  return `# Estructura de ${project.name}\n\nArchivos: ${project.files?.length || 0}`;
}

function sanitizeFilename(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
