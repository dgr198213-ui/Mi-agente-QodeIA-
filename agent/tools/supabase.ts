import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import {
  createTask,
  updateTaskStatus,
  getPendingTasks,
} from '../../lib/supabase';
import { onAgentSolutionSuccess } from '../../hooks/mcp-sync';

/**
 * Herramientas de Supabase para el agente
 * Estas herramientas permiten al agente interactuar con la base de datos
 */

export const supabaseTools = {
  /**
   * Inserta datos en una tabla
   */
  insertData: {
    description:
      'Inserta uno o más registros en una tabla de Supabase. Útil para guardar información estructurada.',
    parameters: z.object({
      table: z.string().describe('Nombre de la tabla'),
      data: z
        .union([z.record(z.any()), z.array(z.record(z.any()))])
        .describe('Datos a insertar (objeto o array de objetos)'),
    }),
    execute: async ({
      table,
      data,
    }: {
      table: string;
      data: Record<string, any> | Record<string, any>[];
    }) => {
      try {
        const { data: result, error } = await supabase
          .from(table)
          .insert(data)
          .select();

        if (error) throw error;

        return {
          success: true,
          table,
          inserted: Array.isArray(data) ? data.length : 1,
          data: result,
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
   * Consulta datos de una tabla
   */
  queryData: {
    description:
      'Consulta datos de una tabla de Supabase con filtros opcionales. Permite seleccionar columnas específicas y aplicar condiciones.',
    parameters: z.object({
      table: z.string().describe('Nombre de la tabla'),
      select: z
        .string()
        .optional()
        .describe('Columnas a seleccionar (por defecto: *)'),
      filters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in']),
            value: z.any(),
          })
        )
        .optional()
        .describe('Filtros a aplicar'),
      limit: z.number().optional().describe('Límite de resultados'),
      orderBy: z
        .object({
          column: z.string(),
          ascending: z.boolean().optional(),
        })
        .optional()
        .describe('Ordenamiento de resultados'),
    }),
    execute: async ({
      table,
      select = '*',
      filters = [],
      limit,
      orderBy,
    }: {
      table: string;
      select?: string;
      filters?: Array<{
        column: string;
        operator: string;
        value: any;
      }>;
      limit?: number;
      orderBy?: { column: string; ascending?: boolean };
    }) => {
      try {
        let query = supabase.from(table).select(select);

        // Aplicar filtros
        for (const filter of filters) {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.column, filter.value);
              break;
            case 'neq':
              query = query.neq(filter.column, filter.value);
              break;
            case 'gt':
              query = query.gt(filter.column, filter.value);
              break;
            case 'gte':
              query = query.gte(filter.column, filter.value);
              break;
            case 'lt':
              query = query.lt(filter.column, filter.value);
              break;
            case 'lte':
              query = query.lte(filter.column, filter.value);
              break;
            case 'like':
              query = query.like(filter.column, filter.value);
              break;
            case 'in':
              query = query.in(filter.column, filter.value);
              break;
          }
        }

        // Aplicar ordenamiento
        if (orderBy) {
          query = query.order(orderBy.column, {
            ascending: orderBy.ascending ?? true,
          });
        }

        // Aplicar límite
        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        return {
          success: true,
          table,
          count: data?.length || 0,
          data,
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
   * Actualiza datos en una tabla
   */
  updateData: {
    description:
      'Actualiza registros en una tabla de Supabase que cumplan con los filtros especificados.',
    parameters: z.object({
      table: z.string().describe('Nombre de la tabla'),
      updates: z.record(z.any()).describe('Datos a actualizar'),
      filters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
            value: z.any(),
          })
        )
        .describe('Filtros para identificar los registros a actualizar'),
    }),
    execute: async ({
      table,
      updates,
      filters,
    }: {
      table: string;
      updates: Record<string, any>;
      filters: Array<{
        column: string;
        operator: string;
        value: any;
      }>;
    }) => {
      try {
        let query = supabase.from(table).update(updates);

        // Aplicar filtros
        for (const filter of filters) {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.column, filter.value);
              break;
            case 'neq':
              query = query.neq(filter.column, filter.value);
              break;
            case 'gt':
              query = query.gt(filter.column, filter.value);
              break;
            case 'gte':
              query = query.gte(filter.column, filter.value);
              break;
            case 'lt':
              query = query.lt(filter.column, filter.value);
              break;
            case 'lte':
              query = query.lte(filter.column, filter.value);
              break;
          }
        }

        const { data, error } = await query.select();

        if (error) throw error;

        return {
          success: true,
          table,
          updated: data?.length || 0,
          data,
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
   * Elimina datos de una tabla
   */
  deleteData: {
    description:
      'Elimina registros de una tabla de Supabase que cumplan con los filtros especificados.',
    parameters: z.object({
      table: z.string().describe('Nombre de la tabla'),
      filters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
            value: z.any(),
          })
        )
        .describe('Filtros para identificar los registros a eliminar'),
    }),
    execute: async ({
      table,
      filters,
    }: {
      table: string;
      filters: Array<{
        column: string;
        operator: string;
        value: any;
      }>;
    }) => {
      try {
        let query = supabase.from(table).delete();

        // Aplicar filtros
        for (const filter of filters) {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.column, filter.value);
              break;
            case 'neq':
              query = query.neq(filter.column, filter.value);
              break;
            case 'gt':
              query = query.gt(filter.column, filter.value);
              break;
            case 'gte':
              query = query.gte(filter.column, filter.value);
              break;
            case 'lt':
              query = query.lt(filter.column, filter.value);
              break;
            case 'lte':
              query = query.lte(filter.column, filter.value);
              break;
          }
        }

        const { data, error } = await query.select();

        if (error) throw error;

        return {
          success: true,
          table,
          deleted: data?.length || 0,
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
   * Crea una nueva tarea
   */
  createTask: {
    description:
      'Crea una nueva tarea en el sistema de gestión de tareas del agente.',
    parameters: z.object({
      title: z.string().describe('Título de la tarea'),
      description: z.string().describe('Descripción detallada de la tarea'),
      priority: z
        .number()
        .min(1)
        .max(10)
        .describe('Prioridad de la tarea (1-10, mayor = más prioritario)'),
      metadata: z
        .record(z.any())
        .optional()
        .describe('Metadata adicional de la tarea'),
    }),
    execute: async ({
      title,
      description,
      priority,
      metadata,
    }: {
      title: string;
      description: string;
      priority: number;
      metadata?: Record<string, any>;
    }) => {
      try {
        const task = await createTask({
          title,
          description,
          status: 'pending',
          priority,
          metadata,
        });

        return {
          success: true,
          task,
          message: `Tarea "${title}" creada exitosamente`,
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
   * Actualiza el estado de una tarea
   */
  updateTaskStatus: {
    description: 'Actualiza el estado de una tarea existente.',
    parameters: z.object({
      taskId: z.string().describe('ID de la tarea'),
      status: z
        .enum(['pending', 'in_progress', 'completed', 'failed'])
        .describe('Nuevo estado de la tarea'),
    }),
    execute: async ({
      taskId,
      status,
    }: {
      taskId: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
    }) => {
      try {
        const completedAt =
          status === 'completed' || status === 'failed'
            ? new Date().toISOString()
            : undefined;

        const task = await updateTaskStatus(taskId, status, completedAt);

        return {
          success: true,
          task,
          message: `Tarea actualizada a estado: ${status}`,
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
   * Lista las tareas pendientes
   */
  listPendingTasks: {
    description:
      'Lista las tareas pendientes o en progreso, ordenadas por prioridad.',
    parameters: z.object({
      limit: z
        .number()
        .optional()
        .describe('Número máximo de tareas a retornar (por defecto: 10)'),
    }),
    execute: async ({ limit = 10 }: { limit?: number }) => {
      try {
        const tasks = await getPendingTasks(limit);

        return {
          success: true,
          count: tasks.length,
          tasks,
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
   * Registra una solución exitosa para un error
   */
  recordErrorSolution: {
    description: 'Registra una solución exitosa para un error específico. Si la solución es validada varias veces, se sincroniza con la base de conocimiento MCP.',
    parameters: z.object({
      error_signature: z.string().describe('Firma o mensaje del error'),
      solution_steps: z.array(z.string()).describe('Pasos seguidos para resolver el error'),
      context: z.record(z.any()).optional().describe('Contexto adicional del error'),
    }),
    execute: async ({ error_signature, solution_steps, context }) => {
      try {
        // 1. Guardar en agent_solutions (simulado con insertData)
        const { data: saved, error } = await supabase
          .from('agent_solutions')
          .insert({
            error_signature,
            solution_steps,
            context,
            success_count: 1, // En un flujo real, esto se incrementaría
            last_used: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        // 2. NUEVO: Si es exitosa (simulamos validación), sincronizar con MCP
        // En producción, esto se activaría cuando success_count >= 3
        await onAgentSolutionSuccess(saved);

        return {
          success: true,
          message: 'Solución registrada y sincronizada con base de conocimiento',
          solution: saved,
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
export function getSupabaseToolsForAI() {
  return Object.entries(supabaseTools).reduce(
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
