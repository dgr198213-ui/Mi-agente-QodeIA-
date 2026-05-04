/**
 * GitHub Specialist - Usa DeepSeek V4 Flash con Extended Thinking
 * Especializado en operaciones de código, repositorios, PRs e issues
 * v4.0: Integración con modo Thinking para mejor razonamiento de código
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';
import { githubTools } from '../tools/github';

export interface GitHubSpecialistRequest {
  task: string;
  context?: string;
  repo?: string;
  branch?: string;
}

export interface GitHubSpecialistResponse {
  success: boolean;
  result: string;
  toolsUsed: string[];
  executionTime: number;
}

export class GitHubSpecialist {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    const config = SPECIALIST_CONFIGS.github;
    this.llm = await createLLMClient(config);
    console.log(`✅ GitHub Specialist initialized with ${config.provider.toUpperCase()} (${config.model})`);
    console.log(`   Thinking: ${config.thinking?.type === 'enabled' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Reasoning Effort: ${config.reasoningEffort || 'standard'}`);
  }

  /**
   * Procesar una solicitud de GitHub
   */
  async processRequest(request: GitHubSpecialistRequest): Promise<GitHubSpecialistResponse> {
    const startTime = Date.now();

    try {
      // Construir mensaje del usuario
      const userMessage = this.buildUserMessage(request);

      // Agregar a historial
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Llamar al LLM con herramientas de GitHub
      const result = await generateText({
        model: this.llm,
        system: SPECIALIST_CONFIGS.github.systemPrompt,
        messages: this.conversationHistory,
        tools: githubTools,
        maxSteps: 5,
        temperature: SPECIALIST_CONFIGS.github.temperature,
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
      console.error('GitHub Specialist error:', error);
      return {
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsUsed: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Crear un repositorio
   */
  async createRepository(name: string, description: string, isPrivate: boolean = true) {
    return this.processRequest({
      task: `Create a new GitHub repository with the following details:
        - Name: ${name}
        - Description: ${description}
        - Private: ${isPrivate}
        - Initialize with README
        - Add .gitignore for Node.js`
    });
  }

  /**
   * Crear un pull request
   */
  async createPullRequest(
    repo: string,
    title: string,
    description: string,
    head: string,
    base: string = 'main'
  ) {
    return this.processRequest({
      task: `Create a pull request with these details:
        - Repository: ${repo}
        - Title: ${title}
        - Description: ${description}
        - Head branch: ${head}
        - Base branch: ${base}`,
      repo
    });
  }

  /**
   * Crear un issue
   */
  async createIssue(repo: string, title: string, body: string, labels: string[] = []) {
    return this.processRequest({
      task: `Create a GitHub issue:
        - Repository: ${repo}
        - Title: ${title}
        - Body: ${body}
        - Labels: ${labels.join(', ')}`,
      repo
    });
  }

  /**
   * Crear una rama
   */
  async createBranch(repo: string, branchName: string, fromBranch: string = 'main') {
    return this.processRequest({
      task: `Create a new branch in repository ${repo}:
        - Branch name: ${branchName}
        - Based on: ${fromBranch}`,
      repo,
      branch: branchName
    });
  }

  /**
   * Listar repositorios
   */
  async listRepositories(owner: string) {
    return this.processRequest({
      task: `List all repositories for owner/organization: ${owner}`
    });
  }

  /**
   * Obtener contenido de archivo
   */
  async getFileContent(repo: string, filePath: string, branch: string = 'main') {
    return this.processRequest({
      task: `Get the content of file ${filePath} from repository ${repo} on branch ${branch}`,
      repo,
      branch
    });
  }

  /**
   * Actualizar archivo
   */
  async updateFile(
    repo: string,
    filePath: string,
    newContent: string,
    commitMessage: string,
    branch: string = 'main'
  ) {
    return this.processRequest({
      task: `Update file in repository:
        - Repository: ${repo}
        - File path: ${filePath}
        - Branch: ${branch}
        - Commit message: ${commitMessage}
        - New content: ${newContent.substring(0, 500)}...`,
      repo,
      branch
    });
  }

  /**
   * Limpiar historial de conversación
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
  private buildUserMessage(request: GitHubSpecialistRequest): string {
    let message = request.task;

    if (request.context) {
      message += `\n\nAdditional context: ${request.context}`;
    }

    if (request.repo) {
      message += `\nRepository: ${request.repo}`;
    }

    if (request.branch) {
      message += `\nBranch: ${request.branch}`;
    }

    return message;
  }
}

/**
 * Factory para crear instancia del especialista
 */
export async function createGitHubSpecialist(): Promise<GitHubSpecialist> {
  const specialist = new GitHubSpecialist();
  await specialist.initialize();
  return specialist;
}
