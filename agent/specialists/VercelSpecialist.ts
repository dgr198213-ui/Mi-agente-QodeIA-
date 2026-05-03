/**
 * Vercel Specialist - Usa Groq Llama-3.1-8B
 * Especializado en deployments, variables de entorno, monitoreo
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';
import { vercelTools } from '../tools/vercel';

export interface VercelSpecialistRequest {
  task: string;
  context?: string;
  project?: string;
  environment?: 'production' | 'preview' | 'development';
}

export interface VercelSpecialistResponse {
  success: boolean;
  result: string;
  deploymentId?: string;
  toolsUsed: string[];
  executionTime: number;
}

export class VercelSpecialist {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    const config = SPECIALIST_CONFIGS.vercel;
    this.llm = await createLLMClient(config);
    console.log(`✅ Vercel Specialist initialized with ${config.provider.toUpperCase()}`);
  }

  /**
   * Procesar una solicitud de Vercel
   */
  async processRequest(request: VercelSpecialistRequest): Promise<VercelSpecialistResponse> {
    const startTime = Date.now();

    try {
      // Construir mensaje del usuario
      const userMessage = this.buildUserMessage(request);

      // Agregar a historial
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Llamar al LLM con herramientas de Vercel
      const result = await generateText({
        model: this.llm,
        system: SPECIALIST_CONFIGS.vercel.systemPrompt,
        messages: this.conversationHistory,
        tools: vercelTools,
        maxSteps: 5,
        temperature: SPECIALIST_CONFIGS.vercel.temperature,
      });

      // Procesar resultado
      const toolsUsed = result.toolCalls?.map(tc => tc.toolName) || [];

      // Agregar respuesta al historial
      this.conversationHistory.push({
        role: 'assistant',
        content: result.text
      });

      return {
        success: true,
        result: result.text,
        toolsUsed,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Vercel Specialist error:', error);
      return {
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsUsed: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Desplegar proyecto
   */
  async deploy(project: string, branch: string = 'main') {
    return this.processRequest({
      task: `Deploy project to Vercel:
        - Project: ${project}
        - Branch: ${branch}
        - Environment: production
        - Wait for deployment to complete
        - Return deployment URL`,
      project,
      environment: 'production'
    });
  }

  /**
   * Desplegar preview
   */
  async deployPreview(project: string, branch: string) {
    return this.processRequest({
      task: `Deploy preview for branch:
        - Project: ${project}
        - Branch: ${branch}
        - Environment: preview
        - Return preview URL`,
      project,
      environment: 'preview'
    });
  }

  /**
   * Obtener estado de deployment
   */
  async getDeploymentStatus(deploymentId: string) {
    return this.processRequest({
      task: `Get deployment status:
        - Deployment ID: ${deploymentId}
        - Return status, URL, and any errors`
    });
  }

  /**
   * Establecer variable de entorno
   */
  async setEnvironmentVariable(
    project: string,
    key: string,
    value: string,
    environment: 'production' | 'preview' | 'development' = 'production'
  ) {
    return this.processRequest({
      task: `Set environment variable:
        - Project: ${project}
        - Key: ${key}
        - Environment: ${environment}
        - Verify variable is set correctly`,
      project,
      environment
    });
  }

  /**
   * Listar deployments
   */
  async listDeployments(project: string, limit: number = 10) {
    return this.processRequest({
      task: `List recent deployments:
        - Project: ${project}
        - Limit: ${limit}
        - Include status, URLs, and timestamps`,
      project
    });
  }

  /**
   * Rollback a deployment anterior
   */
  async rollback(project: string, deploymentId: string) {
    return this.processRequest({
      task: `Rollback to previous deployment:
        - Project: ${project}
        - Deployment ID: ${deploymentId}
        - Confirm rollback success`,
      project
    });
  }

  /**
   * Obtener logs de deployment
   */
  async getDeploymentLogs(deploymentId: string) {
    return this.processRequest({
      task: `Get deployment logs:
        - Deployment ID: ${deploymentId}
        - Include build logs and runtime errors`
    });
  }

  /**
   * Configurar dominio
   */
  async configureDomain(project: string, domain: string) {
    return this.processRequest({
      task: `Configure custom domain:
        - Project: ${project}
        - Domain: ${domain}
        - Set up DNS records
        - Enable SSL certificate`,
      project
    });
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Obtener historial
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Construir mensaje del usuario
   */
  private buildUserMessage(request: VercelSpecialistRequest): string {
    let message = request.task;

    if (request.context) {
      message += `\n\nContext: ${request.context}`;
    }

    if (request.project) {
      message += `\nProject: ${request.project}`;
    }

    if (request.environment) {
      message += `\nEnvironment: ${request.environment}`;
    }

    return message;
  }
}

/**
 * Factory para crear instancia del especialista
 */
export async function createVercelSpecialist(): Promise<VercelSpecialist> {
  const specialist = new VercelSpecialist();
  await specialist.initialize();
  return specialist;
}
