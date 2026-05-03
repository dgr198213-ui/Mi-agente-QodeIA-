/**
 * MCP Specialist - Usa DeepSeek V4 Pro con Extended Thinking
 * Especializado en NotebookLM, análisis de código, documentación
 * v4.0: Migrado de Mistral a DeepSeek V4 Pro para mejor razonamiento
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';

export interface MCPSpecialistRequest {
  task: string;
  context?: string;
  documentType?: 'code' | 'documentation' | 'architecture' | 'analysis';
  language?: string;
}

export interface MCPSpecialistResponse {
  success: boolean;
  result: string;
  analysis?: Record<string, any>;
  toolsUsed: string[];
  executionTime: number;
}

export class MCPSpecialist {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    const config = SPECIALIST_CONFIGS.mcp;
    this.llm = await createLLMClient(config);
    console.log(`✅ MCP Specialist initialized with ${config.provider.toUpperCase()} (${config.model})`);
    console.log(`   Thinking: ${config.thinking?.type === 'enabled' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Reasoning Effort: ${config.reasoningEffort || 'standard'}`);
  }

  /**
   * Procesar una solicitud de MCP
   */
  async processRequest(request: MCPSpecialistRequest): Promise<MCPSpecialistResponse> {
    const startTime = Date.now();

    try {
      // Construir mensaje del usuario
      const userMessage = this.buildUserMessage(request);

      // Agregar a historial
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Llamar al LLM (sin herramientas por ahora, enfocado en análisis)
      const result = await generateText({
        model: this.llm,
        system: SPECIALIST_CONFIGS.mcp.systemPrompt,
        messages: this.conversationHistory,
        maxSteps: 3,
        temperature: SPECIALIST_CONFIGS.mcp.temperature,
      });

      // Agregar respuesta al historial
      this.conversationHistory.push({
        role: 'assistant',
        content: result.text
      });

      return {
        success: true,
        result: result.text,
        toolsUsed: [],
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('MCP Specialist error:', error);
      return {
        success: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsUsed: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Analizar código
   */
  async analyzeCode(code: string, language: string = 'typescript') {
    return this.processRequest({
      task: `Analyze the following ${language} code:
        
${code}

Provide:
1. Code quality assessment
2. Potential bugs or issues
3. Performance considerations
4. Security concerns
5. Suggestions for improvement`,
      documentType: 'code',
      language
    });
  }

  /**
   * Generar documentación
   */
  async generateDocumentation(code: string, language: string = 'typescript') {
    return this.processRequest({
      task: `Generate comprehensive documentation for the following ${language} code:

${code}

Include:
1. Function/class descriptions
2. Parameter documentation
3. Return value documentation
4. Usage examples
5. Edge cases and error handling`,
      documentType: 'documentation',
      language
    });
  }

  /**
   * Revisar arquitectura
   */
  async reviewArchitecture(architecture: string, context: string) {
    return this.processRequest({
      task: `Review the following system architecture:

${architecture}

Context: ${context}

Provide:
1. Architecture assessment
2. Scalability concerns
3. Performance implications
4. Security considerations
5. Recommendations for improvement`,
      documentType: 'architecture'
    });
  }

  /**
   * Análisis de impacto
   */
  async analyzeImpact(change: string, affectedSystems: string[]) {
    return this.processRequest({
      task: `Analyze the impact of the following change:

Change: ${change}

Affected systems: ${affectedSystems.join(', ')}

Provide:
1. Direct impacts
2. Indirect impacts
3. Risk assessment
4. Mitigation strategies
5. Testing recommendations`,
      documentType: 'analysis'
    });
  }

  /**
   * Sugerir mejoras
   */
  async suggestImprovements(code: string, context: string, language: string = 'typescript') {
    return this.processRequest({
      task: `Suggest improvements for the following ${language} code:

${code}

Context: ${context}

Provide:
1. Code quality improvements
2. Performance optimizations
3. Maintainability enhancements
4. Best practices to apply
5. Refactoring suggestions with examples`,
      documentType: 'code',
      language
    });
  }

  /**
   * Validar decisión arquitectónica
   */
  async validateArchitecturalDecision(decision: string, constraints: string[]) {
    return this.processRequest({
      task: `Validate the following architectural decision:

Decision: ${decision}

Constraints:
${constraints.map(c => `- ${c}`).join('\n')}

Provide:
1. Decision validity assessment
2. Alignment with constraints
3. Potential issues
4. Alternative approaches
5. Final recommendation`,
      documentType: 'architecture'
    });
  }

  /**
   * Sincronizar solución a base de conocimiento
   */
  async syncSolutionToKnowledgeBase(
    problem: string,
    solution: string,
    tags: string[]
  ) {
    return this.processRequest({
      task: `Prepare solution for knowledge base sync:

Problem: ${problem}

Solution: ${solution}

Tags: ${tags.join(', ')}

Provide:
1. Formatted problem statement
2. Formatted solution
3. Key takeaways
4. Related topics
5. Suggested tags for discovery`,
      documentType: 'documentation'
    });
  }

  /**
   * Consultar documentación técnica
   */
  async queryDocumentation(query: string, domain: string = 'general') {
    return this.processRequest({
      task: `Query technical documentation:

Query: ${query}
Domain: ${domain}

Provide:
1. Relevant documentation excerpts
2. Code examples
3. Best practices
4. Common pitfalls
5. Related resources`,
      documentType: 'documentation'
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
  private buildUserMessage(request: MCPSpecialistRequest): string {
    let message = request.task;

    if (request.context) {
      message += `\n\nContext: ${request.context}`;
    }

    if (request.documentType) {
      message += `\nDocument type: ${request.documentType}`;
    }

    if (request.language) {
      message += `\nLanguage: ${request.language}`;
    }

    return message;
  }
}

/**
 * Factory para crear instancia del especialista
 */
export async function createMCPSpecialist(): Promise<MCPSpecialist> {
  const specialist = new MCPSpecialist();
  await specialist.initialize();
  return specialist;
}
