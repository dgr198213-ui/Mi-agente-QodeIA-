/**
 * Pro Validator - Usa DeepSeek V4 Pro (vía HuggingFace)
 * Especializado en validación de código, revisión de arquitectura y análisis experto
 */

import { generateText, CoreMessage } from 'ai';
import { createLLMClient, SPECIALIST_CONFIGS } from '../core/MultiLLMConfig';

export interface ProValidatorRequest {
  task: string;
  code?: string;
  language?: string;
  context?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationIssue {
  severity: string;
  category: string;
  description: string;
  suggestion: string;
  line?: number;
}

export interface ProValidatorResponse {
  success: boolean;
  isValid: boolean;
  result: string;
  issues?: ValidationIssue[];
  recommendations?: string[];
  executionTime: number;
}

export class ProValidator {
  private llm: any;
  private conversationHistory: CoreMessage[] = [];

  async initialize() {
    const config = SPECIALIST_CONFIGS.pro_validator;
    this.llm = await createLLMClient(config);
    console.log(`✅ Pro Validator initialized with ${config.provider.toUpperCase()} (DeepSeek V4 Pro)`);
  }

  /**
   * Procesar una solicitud de validación
   */
  async processRequest(request: ProValidatorRequest): Promise<ProValidatorResponse> {
    const startTime = Date.now();

    try {
      // Construir mensaje del usuario
      const userMessage = this.buildUserMessage(request);

      // Agregar a historial
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Llamar al LLM
      const result = await generateText({
        model: this.llm,
        system: SPECIALIST_CONFIGS.pro_validator.systemPrompt,
        messages: this.conversationHistory,
        maxSteps: 5,
        temperature: SPECIALIST_CONFIGS.pro_validator.temperature,
      });

      // Agregar respuesta al historial
      this.conversationHistory.push({
        role: 'assistant',
        content: result.text
      });

      // Parsear respuesta para extraer issues
      const issues = this.parseIssues(result.text);
      const isValid = issues.length === 0 || issues.every(i => i.severity === 'low');

      return {
        success: true,
        isValid,
        result: result.text,
        issues,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Pro Validator error:', error);
      return {
        success: false,
        isValid: false,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validar código
   */
  async validateCode(code: string, language: string = 'typescript') {
    return this.processRequest({
      task: `Perform expert code validation on the following ${language} code:

${code}

Provide:
1. Code quality assessment
2. Security vulnerabilities (if any)
3. Performance considerations
4. Best practices alignment
5. Architectural consistency
6. Testing coverage recommendations
7. Overall validation result (PASS/FAIL)`,
      code,
      language,
      severity: 'critical'
    });
  }

  /**
   * Revisar arquitectura
   */
  async reviewArchitecture(architecture: string, context: string) {
    return this.processRequest({
      task: `Perform expert architectural review:

Architecture:
${architecture}

Context:
${context}

Provide:
1. Architecture assessment
2. Scalability evaluation
3. Performance implications
4. Security considerations
5. Best practices alignment
6. Potential issues and risks
7. Recommendations for improvement
8. Overall verdict (APPROVED/NEEDS REVISION)`,
      context,
      severity: 'critical'
    });
  }

  /**
   * Validar pull request
   */
  async validatePullRequest(
    title: string,
    description: string,
    changes: string,
    affectedFiles: string[]
  ) {
    return this.processRequest({
      task: `Perform expert PR validation:

Title: ${title}
Description: ${description}

Changes:
${changes}

Affected Files: ${affectedFiles.join(', ')}

Provide:
1. Change impact analysis
2. Code quality review
3. Security implications
4. Backward compatibility check
5. Testing requirements
6. Documentation needs
7. Approval recommendation (APPROVE/REQUEST CHANGES/REJECT)
8. Detailed feedback`,
      severity: 'high'
    });
  }

  /**
   * Análisis de seguridad
   */
  async securityAnalysis(code: string, language: string = 'typescript') {
    return this.processRequest({
      task: `Perform comprehensive security analysis on ${language} code:

${code}

Provide:
1. Vulnerability scan
2. Authentication/Authorization issues
3. Data protection concerns
4. Input validation problems
5. Injection attack vectors
6. Session management issues
7. API security concerns
8. Security score (1-10)
9. Critical issues requiring immediate attention
10. Remediation recommendations`,
      code,
      language,
      severity: 'critical'
    });
  }

  /**
   * Análisis de rendimiento
   */
  async performanceAnalysis(code: string, language: string = 'typescript') {
    return this.processRequest({
      task: `Perform performance analysis on ${language} code:

${code}

Provide:
1. Time complexity analysis
2. Space complexity analysis
3. Bottleneck identification
4. Optimization opportunities
5. Caching opportunities
6. Database query optimization
7. Memory leak risks
8. Scalability concerns
9. Performance score (1-10)
10. Specific optimization recommendations`,
      code,
      language,
      severity: 'high'
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
  private buildUserMessage(request: ProValidatorRequest): string {
    let message = request.task;

    if (request.context) {
      message += `\n\nContext: ${request.context}`;
    }

    if (request.severity === 'critical') {
      message += '\n\nSeverity: CRITICAL - Perform thorough analysis.';
    }

    return message;
  }

  /**
   * Parsear issues de la respuesta
   */
  private parseIssues(response: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Buscar patrones de issues en la respuesta
    const severityPattern = /\b(critical|high|medium|low)\b/gi;
    const categoryPattern = /\b(security|performance|quality|architecture|best-practice)\b/gi;
    
    // Esto es un parseo básico; en producción sería más sofisticado
    if (response.toLowerCase().includes('critical') || response.toLowerCase().includes('error')) {
      issues.push({
        severity: 'critical',
        category: 'validation',
        description: 'Critical issues detected in validation',
        suggestion: 'Review the detailed analysis above'
      });
    }

    return issues;
  }
}

/**
 * Factory para crear instancia del validador
 */
export async function createProValidator(): Promise<ProValidator> {
  const validator = new ProValidator();
  await validator.initialize();
  return validator;
}
