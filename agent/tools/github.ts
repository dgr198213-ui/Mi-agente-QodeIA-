import { z } from 'zod';
import {
  getFileContent,
  createOrUpdateFile,
  createBranch,
  createPullRequest,
  getBranch,
  createIssue,
  listOpenIssues,
  getDirectoryContents,
  GITHUB_OWNER,
  GITHUB_REPO,
} from '@/lib/github';

/**
 * Herramientas de GitHub para el agente
 * Estas herramientas permiten al agente interactuar con repositorios de GitHub
 */

export const githubTools = {
  /**
   * Lee el contenido de un archivo del repositorio
   */
  getFile: {
    description:
      'Lee el contenido de un archivo del repositorio de GitHub. Útil para revisar código, documentación o cualquier archivo del proyecto.',
    parameters: z.object({
      path: z.string().describe('Ruta del archivo en el repositorio (ej: src/index.ts)'),
      branch: z
        .string()
        .optional()
        .describe('Rama del repositorio (por defecto: main)'),
    }),
    execute: async ({ path, branch }: { path: string; branch?: string }) => {
      try {
        const file = await getFileContent(path, branch);
        if (!file) {
          return {
            success: false,
            error: `Archivo no encontrado: ${path}`,
          };
        }
        return {
          success: true,
          path: file.path,
          content: file.content,
          sha: file.sha,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  /**
   * Crea o actualiza un archivo en el repositorio
   */
  createOrUpdateFile: {
    description:
      'Crea un nuevo archivo o actualiza uno existente en el repositorio de GitHub. Requiere un mensaje de commit descriptivo.',
    parameters: z.object({
      path: z.string().describe('Ruta del archivo en el repositorio'),
      content: z.string().describe('Contenido del archivo'),
      message: z.string().describe('Mensaje del commit'),
      branch: z.string().describe('Rama donde hacer el commit'),
      sha: z
        .string()
        .optional()
        .describe('SHA del archivo existente (requerido para actualizar)'),
    }),
    execute: async ({
      path,
      content,
      message,
      branch,
      sha,
    }: {
      path: string;
      content: string;
      message: string;
      branch: string;
      sha?: string;
    }) => {
      try {
        // Si no se proporciona SHA, intentar obtenerlo
        if (!sha) {
          const existingFile = await getFileContent(path, branch);
          if (existingFile) {
            sha = existingFile.sha;
          }
        }

        const result = await createOrUpdateFile(path, content, message, branch, sha);
        return {
          success: true,
          path,
          commit: result.commit.sha,
          message: 'Archivo creado/actualizado exitosamente',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  /**
   * Crea una nueva rama en el repositorio
   */
  createBranch: {
    description:
      'Crea una nueva rama en el repositorio de GitHub desde una rama base (por defecto main).',
    parameters: z.object({
      branchName: z
        .string()
        .describe('Nombre de la nueva rama (ej: feature/new-feature)'),
      fromBranch: z
        .string()
        .optional()
        .describe('Rama base desde la cual crear (por defecto: main)'),
    }),
    execute: async ({
      branchName,
      fromBranch = 'main',
    }: {
      branchName: string;
      fromBranch?: string;
    }) => {
      try {
        // Verificar si la rama ya existe
        const existingBranch = await getBranch(branchName);
        if (existingBranch) {
          return {
            success: false,
            error: `La rama ${branchName} ya existe`,
          };
        }

        const branch = await createBranch(branchName, fromBranch);
        return {
          success: true,
          branchName: branch.name,
          sha: branch.sha,
          message: `Rama ${branchName} creada exitosamente`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  /**
   * Crea un Pull Request
   */
  createPullRequest: {
    description:
      'Crea un Pull Request en GitHub para fusionar cambios de una rama a otra.',
    parameters: z.object({
      title: z.string().describe('Título del Pull Request'),
      head: z.string().describe('Rama con los cambios (source)'),
      base: z
        .string()
        .optional()
        .describe('Rama destino (por defecto: main)'),
      body: z
        .string()
        .optional()
        .describe('Descripción detallada del Pull Request'),
    }),
    execute: async ({
      title,
      head,
      base = 'main',
      body,
    }: {
      title: string;
      head: string;
      base?: string;
      body?: string;
    }) => {
      try {
        const pr = await createPullRequest(title, head, base, body);
        return {
          success: true,
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          message: `Pull Request #${pr.number} creado exitosamente`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  /**
   * Crea un issue en el repositorio
   */
  createIssue: {
    description:
      'Crea un nuevo issue en el repositorio de GitHub para reportar bugs, solicitar features, etc.',
    parameters: z.object({
      title: z.string().describe('Título del issue'),
      body: z.string().optional().describe('Descripción del issue'),
      labels: z
        .array(z.string())
        .optional()
        .describe('Etiquetas para el issue (ej: ["bug", "enhancement"])'),
    }),
    execute: async ({
      title,
      body,
      labels,
    }: {
      title: string;
      body?: string;
      labels?: string[];
    }) => {
      try {
        const issue = await createIssue(title, body, labels);
        return {
          success: true,
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          message: `Issue #${issue.number} creado exitosamente`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  /**
   * Lista los issues abiertos del repositorio
   */
  listIssues: {
    description: 'Lista todos los issues abiertos en el repositorio de GitHub.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const issues = await listOpenIssues();
        return {
          success: true,
          count: issues.length,
          issues: issues.map((issue) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            url: issue.html_url,
            labels: issue.labels.map((l: any) => l.name),
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  /**
   * Lista los archivos de un directorio
   */
  listDirectory: {
    description:
      'Lista los archivos y subdirectorios de un directorio en el repositorio.',
    parameters: z.object({
      path: z.string().describe('Ruta del directorio (ej: src/components)'),
      branch: z
        .string()
        .optional()
        .describe('Rama del repositorio (por defecto: main)'),
    }),
    execute: async ({ path, branch }: { path: string; branch?: string }) => {
      try {
        const contents = await getDirectoryContents(path, branch);
        return {
          success: true,
          path,
          items: contents.map((item) => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  /**
   * Obtiene información del repositorio actual
   */
  getRepoInfo: {
    description: 'Obtiene información sobre el repositorio configurado.',
    parameters: z.object({}),
    execute: async () => {
      return {
        success: true,
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
      };
    },
  },
};

/**
 * Convierte las herramientas al formato esperado por Vercel AI SDK
 */
export function getGitHubToolsForAI() {
  return Object.entries(githubTools).reduce(
    (acc, [name, tool]) => {
      acc[name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      };
      return acc;
    },
    {} as Record<string, any>
  );
}
