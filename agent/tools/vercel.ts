import { z } from 'zod';
import {
  listProjects,
  getProject,
  listDeployments,
  getDeploymentStatus,
  getProjectStatus,
  getEnvironmentVariables,
  cancelDeployment,
} from '@/lib/vercel';

/**
 * Herramientas de Vercel para el agente
 * Estas herramientas permiten al agente interactuar con la API de Vercel
 */

export const vercelTools = {
  /**
   * Lista todos los proyectos de Vercel
   */
  listProjects: {
    description:
      'Lista todos los proyectos disponibles en la cuenta de Vercel configurada.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const projects = await listProjects();

        return {
          success: true,
          count: projects.length,
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            framework: p.framework,
            createdAt: new Date(p.createdAt).toISOString(),
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
   * Obtiene información de un proyecto específico
   */
  getProject: {
    description:
      'Obtiene información detallada de un proyecto específico de Vercel.',
    parameters: z.object({
      projectId: z
        .string()
        .describe('ID del proyecto (si no se proporciona, usa el configurado)'),
    }),
    execute: async ({ projectId }: { projectId: string }) => {
      try {
        const project = await getProject(projectId);

        return {
          success: true,
          project: {
            id: project.id,
            name: project.name,
            framework: project.framework,
            createdAt: new Date(project.createdAt).toISOString(),
            updatedAt: new Date(project.updatedAt).toISOString(),
          },
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
   * Lista los deployments de un proyecto
   */
  listDeployments: {
    description:
      'Lista todos los deployments de un proyecto de Vercel, ordenados por fecha.',
    parameters: z.object({
      projectId: z
        .string()
        .optional()
        .describe('ID del proyecto (opcional, usa el configurado por defecto)'),
      limit: z
        .number()
        .optional()
        .describe('Número máximo de deployments a retornar'),
    }),
    execute: async ({
      projectId,
      limit,
    }: {
      projectId?: string;
      limit?: number;
    }) => {
      try {
        let deployments = await listDeployments(projectId);

        if (limit) {
          deployments = deployments.slice(0, limit);
        }

        return {
          success: true,
          count: deployments.length,
          deployments: deployments.map((d) => ({
            id: d.uid,
            name: d.name,
            url: d.url,
            state: d.state,
            readyState: d.readyState,
            createdAt: new Date(d.createdAt).toISOString(),
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
   * Obtiene el estado de un deployment específico
   */
  getDeploymentStatus: {
    description:
      'Obtiene el estado actual de un deployment específico de Vercel.',
    parameters: z.object({
      deploymentId: z.string().describe('ID del deployment'),
    }),
    execute: async ({ deploymentId }: { deploymentId: string }) => {
      try {
        const status = await getDeploymentStatus(deploymentId);

        return {
          success: true,
          deployment: {
            id: status.id,
            state: status.state,
            readyState: status.readyState,
            url: `https://${status.url}`,
          },
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
   * Obtiene el estado completo del proyecto
   */
  getProjectStatus: {
    description:
      'Obtiene el estado completo de un proyecto, incluyendo información del proyecto y el último deployment.',
    parameters: z.object({
      projectId: z
        .string()
        .optional()
        .describe('ID del proyecto (opcional, usa el configurado por defecto)'),
    }),
    execute: async ({ projectId }: { projectId?: string }) => {
      try {
        const status = await getProjectStatus(projectId);

        return {
          success: true,
          project: {
            id: status.project.id,
            name: status.project.name,
            framework: status.project.framework,
          },
          latestDeployment: status.latestDeployment
            ? {
                id: status.latestDeployment.uid,
                url: status.latestDeployment.url,
                state: status.latestDeployment.state,
                readyState: status.latestDeployment.readyState,
                createdAt: new Date(
                  status.latestDeployment.createdAt
                ).toISOString(),
              }
            : null,
          deploymentsCount: status.deploymentsCount,
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
   * Obtiene las variables de entorno de un proyecto
   */
  getEnvironmentVariables: {
    description:
      'Obtiene las variables de entorno configuradas en un proyecto de Vercel.',
    parameters: z.object({
      projectId: z
        .string()
        .optional()
        .describe('ID del proyecto (opcional, usa el configurado por defecto)'),
    }),
    execute: async ({ projectId }: { projectId?: string }) => {
      try {
        const envVars = await getEnvironmentVariables(projectId);

        return {
          success: true,
          count: envVars.length,
          variables: envVars.map((env: any) => ({
            key: env.key,
            target: env.target,
            type: env.type,
            // No incluir el valor por seguridad
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
   * Cancela un deployment en progreso
   */
  cancelDeployment: {
    description:
      'Cancela un deployment que está en progreso o en cola en Vercel.',
    parameters: z.object({
      deploymentId: z.string().describe('ID del deployment a cancelar'),
    }),
    execute: async ({ deploymentId }: { deploymentId: string }) => {
      try {
        await cancelDeployment(deploymentId);

        return {
          success: true,
          message: `Deployment ${deploymentId} cancelado exitosamente`,
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
   * Verifica si hay deployments en progreso
   */
  checkActiveDeployments: {
    description:
      'Verifica si hay deployments activos (building, queued) en el proyecto.',
    parameters: z.object({
      projectId: z
        .string()
        .optional()
        .describe('ID del proyecto (opcional, usa el configurado por defecto)'),
    }),
    execute: async ({ projectId }: { projectId?: string }) => {
      try {
        const deployments = await listDeployments(projectId);

        const activeDeployments = deployments.filter(
          (d) =>
            d.state === 'BUILDING' ||
            d.state === 'QUEUED' ||
            d.state === 'INITIALIZING'
        );

        return {
          success: true,
          hasActive: activeDeployments.length > 0,
          count: activeDeployments.length,
          activeDeployments: activeDeployments.map((d) => ({
            id: d.uid,
            state: d.state,
            url: d.url,
            createdAt: new Date(d.createdAt).toISOString(),
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
};

/**
 * Convierte las herramientas al formato esperado por Vercel AI SDK
 */
export function getVercelToolsForAI() {
  return Object.entries(vercelTools).reduce(
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
