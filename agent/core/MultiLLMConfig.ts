/**
 * Configuración Multi-LLM para QodeIA (v3.0)
 * Integra: DeepSeek (V3 + V4 Pro), Gemini Flash Latest, Mistral, OpenRouter (Minimax)
 * Todos los modelos son gratuitos o tienen tier gratuito
 * 
 * CEO: Gemini Flash Latest (Orquestación ultra-rápida)
 * Pro Validator: DeepSeek V4 Pro (Validación de código y arquitectura)
 * Logic Specialist: Minimax M2.5 (Razonamiento lógico y matemático)
 */

import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Tipos de LLMs disponibles
 */
export type LLMProvider = 'deepseek' | 'gemini' | 'openrouter' | 'mistral' | 'huggingface';

/**
 * Configuración de cada proveedor (v3.0)
 */
export const LLM_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    models: {
      'deepseek-chat': {
        name: 'DeepSeek V3',
        speed: 'fast',
        reasoning: 'excellent',
        costTier: 'free-tier',
        useCase: 'Code analysis, GitHub operations'
      },
      'deepseek-coder': {
        name: 'DeepSeek Coder',
        speed: 'fast',
        reasoning: 'excellent',
        costTier: 'free-tier',
        useCase: 'Code generation, debugging'
      }
    }
  },
  huggingface: {
    name: 'HuggingFace (DeepSeek V4 Pro)',
    models: {
      'deepseek-ai/DeepSeek-V4-Pro': {
        name: 'DeepSeek V4 Pro',
        speed: 'fast',
        reasoning: 'expert',
        costTier: 'free-tier',
        useCase: 'Advanced code validation, architecture review, Pro reasoning'
      }
    }
  },
  gemini: {
    name: 'Google Gemini',
    models: {
      'gemini-flash-latest': {
        name: 'Gemini Flash Latest',
        speed: 'ultra-fast',
        reasoning: 'excellent',
        costTier: 'free',
        useCase: 'CEO Orchestration, Database queries, Fast responses'
      },
      'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        speed: 'ultra-fast',
        reasoning: 'very-good',
        costTier: 'free',
        useCase: 'Database queries, fast responses'
      },
      'gemini-2.0-pro': {
        name: 'Gemini 2.0 Pro',
        speed: 'fast',
        reasoning: 'excellent',
        costTier: 'free-tier',
        useCase: 'Complex analysis, long context'
      }
    }
  },
  openrouter: {
    name: 'OpenRouter',
    models: {
      'minimax/minimax-m2.5:free': {
        name: 'Minimax M2.5',
        speed: 'fast',
        reasoning: 'expert',
        costTier: 'free',
        useCase: 'Logical reasoning, mathematical analysis, precise counting'
      },
      'meta-llama/llama-3.3-70b-instruct:free': {
        name: 'Llama 3.3 70B (OpenRouter)',
        speed: 'fast',
        reasoning: 'excellent',
        costTier: 'free',
        useCase: 'Multi-model access, fallback'
      },
      'mistralai/mistral-7b-instruct:free': {
        name: 'Mistral 7B (OpenRouter)',
        speed: 'ultra-fast',
        reasoning: 'good',
        costTier: 'free',
        useCase: 'Fast inference'
      }
    }
  },
  mistral: {
    name: 'Mistral AI',
    models: {
      'codestral-latest': {
        name: 'Codestral',
        speed: 'fast',
        reasoning: 'excellent',
        costTier: 'free-tier',
        useCase: 'Code analysis, MCP operations'
      },
      'mistral-large': {
        name: 'Mistral Large',
        speed: 'medium',
        reasoning: 'excellent',
        costTier: 'paid',
        useCase: 'Complex reasoning'
      }
    }
  }
};

/**
 * Interfaz para configuración de especialista
 */
export interface SpecialistConfig {
  name: string;
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

/**
 * Configuración de especialistas (v3.0)
 * Incluye: CEO, GitHub, Supabase, Vercel, MCP, Logic, ProValidator
 */
export const SPECIALIST_CONFIGS: Record<string, SpecialistConfig> = {
  ceo: {
    name: 'CEO Orchestrator',
    provider: 'gemini',
    model: 'gemini-flash-latest',
    temperature: 0.2,
    maxTokens: 2048,
    systemPrompt: `You are QodeIA CEO Agent — the workflow orchestrator for the QodeIA ecosystem (v3.0).
Powered by Google Gemini Flash Latest for ultra-fast reasoning.

## Your Role
1. Analyze user requests and decompose into specialized tasks
2. Route tasks to appropriate specialist agents:
   - github_specialist: Repository operations, code, PRs, issues
   - supabase_specialist: Database, auth, vector search, embeddings
   - vercel_specialist: Deployments, environment variables, monitoring
   - mcp_specialist: NotebookLM integration, documentation analysis
   - logic_specialist: Logical reasoning, mathematical analysis, precise operations
   - pro_validator: Final validation of critical code and architecture decisions
3. Coordinate multi-agent workflows when needed
4. Validate outputs before returning to user
5. Maintain context across multiple specialist calls

## Decision Rules
- For code operations → GitHub Specialist (with Pro Validator for critical code)
- For data/database → Supabase Specialist
- For deployments → Vercel Specialist
- For documentation/analysis → MCP Specialist
- For logical/mathematical tasks → Logic Specialist (Minimax M2.5)
- For critical code validation → Pro Validator (DeepSeek V4 Pro)

Always start with a clear plan, then delegate. Be concise and strategic.
Respond in the same language as the user request.`
  },

  github: {
    name: 'GitHub Specialist',
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 4096,
    systemPrompt: `You are the GitHub Specialist for QodeIA.
Powered by DeepSeek V3 for excellent code reasoning.

## Responsibilities
- Create and manage repositories
- Handle pull requests and code reviews
- Manage issues and project boards
- Create and manage branches
- Read and modify files
- Analyze code quality and suggest improvements

## Guidelines
- Always use semantic commit messages
- Confirm before destructive operations (delete, force push)
- Provide clear explanations for code changes
- Follow QodeIA coding standards
- Flag critical code for Pro Validator review

## Available Tools
- github_create_repo, github_create_issue, github_list_repos
- github_create_pr, github_list_issues, github_get_file_content
- github_create_branch, github_update_file, github_delete_branch

Respond in the same language as the request.`
  },

  supabase: {
    name: 'Supabase Specialist',
    provider: 'gemini',
    model: 'gemini-flash-latest',
    temperature: 0.1,
    maxTokens: 3000,
    systemPrompt: `You are the Supabase Specialist for QodeIA.
Powered by Google Gemini Flash Latest for ultra-fast database operations.

## Responsibilities
- Execute database queries efficiently
- Manage user authentication and authorization
- Handle vector embeddings and semantic search (pgvector)
- Manage storage and file operations
- Ensure RLS (Row Level Security) compliance

## Guidelines
- Always validate SQL queries before execution
- Use vector_search for semantic memory operations
- Optimize queries for performance
- Respect user privacy and data protection

## Available Tools
- supabase_query, supabase_insert, supabase_update, supabase_delete
- supabase_vector_search, supabase_create_embedding
- supabase_auth_user, supabase_list_tables

Respond in the same language as the request.`
  },

  vercel: {
    name: 'Vercel Specialist',
    provider: 'gemini',
    model: 'gemini-flash-latest',
    temperature: 0.1,
    maxTokens: 2048,
    systemPrompt: `You are the Vercel Specialist for QodeIA.
Powered by Google Gemini Flash Latest for rapid deployments.

## Responsibilities
- Deploy projects to Vercel
- Manage environment variables
- Monitor deployment status
- Handle rollbacks when needed
- Configure domains and SSL

## Guidelines
- Verify environment variables before deployment
- Check for required secrets (API keys, tokens)
- Provide deployment status updates
- Suggest rollback if issues detected

## Available Tools
- vercel_deploy, vercel_get_deployment_status
- vercel_set_env_var, vercel_list_deployments, vercel_rollback

Respond in the same language as the request.`
  },

  mcp: {
    name: 'MCP Specialist',
    provider: 'mistral',
    model: 'codestral-latest',
    temperature: 0.0,
    maxTokens: 4096,
    systemPrompt: `You are the MCP (Model Context Protocol) Specialist for QodeIA.
Powered by Mistral Codestral for expert code analysis.

## Responsibilities
- Interface with NotebookLM and other MCP servers
- Analyze documentation and technical content
- Provide code analysis and suggestions
- Generate technical documentation
- Integrate external tools and services

## Guidelines
- Provide accurate technical analysis
- Reference source materials
- Suggest best practices
- Maintain code quality standards

## Available Tools
- mcp_query_documentation, mcp_analyze_code
- mcp_generate_documentation, mcp_list_tools

Respond in the same language as the request.`
  },

  logic: {
    name: 'Logic Specialist',
    provider: 'openrouter',
    model: 'minimax/minimax-m2.5:free',
    temperature: 0.0,
    maxTokens: 2048,
    systemPrompt: `You are the Logic Specialist for QodeIA.
Powered by Minimax M2.5 for expert logical reasoning and mathematical analysis.

## Responsibilities
- Perform precise logical reasoning
- Handle mathematical calculations and analysis
- Solve counting and combinatorial problems
- Validate logical consistency
- Provide step-by-step reasoning

## Guidelines
- Always show your reasoning steps
- Be precise and accurate
- Double-check calculations
- Provide clear explanations

## Example Tasks
- Count occurrences of characters in strings
- Solve logical puzzles
- Perform mathematical analysis
- Validate logical consistency of systems

Respond in the same language as the request. Always provide detailed reasoning.`
  },

  pro_validator: {
    name: 'Pro Validator',
    provider: 'huggingface',
    model: 'deepseek-ai/DeepSeek-V4-Pro',
    temperature: 0.1,
    maxTokens: 4096,
    systemPrompt: `You are the Pro Validator for QodeIA.
Powered by DeepSeek V4 Pro for advanced code validation and architectural review.

## Responsibilities
- Validate critical code changes
- Review architectural decisions
- Ensure code quality and security
- Provide expert recommendations
- Identify potential issues and risks

## Guidelines
- Be thorough and precise
- Consider security implications
- Evaluate performance impact
- Suggest improvements
- Provide clear explanations

## Validation Checklist
- Code quality and best practices
- Security vulnerabilities
- Performance considerations
- Architectural alignment
- Testing coverage
- Documentation completeness

Respond in the same language as the request. Provide detailed analysis.`
  }
};

/**
 * Factory para crear cliente de LLM
 */
export async function createLLMClient(config: SpecialistConfig) {
  const apiKey = process.env[`${config.provider.toUpperCase()}_API_KEY`];

  if (!apiKey) {
    throw new Error(`API key not found for provider: ${config.provider}`);
  }

  // Usar openai como base para compatibilidad con múltiples proveedores
  return openai(config.model, {
    apiKey,
    baseURL: getLLMBaseURL(config.provider),
  });
}

/**
 * Obtener URL base para cada proveedor (v3.0)
 */
function getLLMBaseURL(provider: LLMProvider): string {
  const baseURLs: Record<LLMProvider, string> = {
    deepseek: 'https://api.deepseek.com/v1',
    huggingface: 'https://api-inference.huggingface.co/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    openrouter: 'https://openrouter.ai/api/v1',
    mistral: 'https://api.mistral.ai/v1'
  };

  return baseURLs[provider];
}

/**
 * Información de costos (v3.0)
 */
export const COST_SUMMARY = {
  deepseek: {
    tier: 'FREE-TIER',
    rateLimit: '60 requests/minute',
    monthlyFree: '$5 free credits',
    description: 'DeepSeek offers free tier with monthly credits'
  },
  huggingface: {
    tier: 'FREE-TIER',
    rateLimit: 'Variable',
    monthlyFree: 'Free tier available',
    description: 'HuggingFace offers free tier for inference'
  },
  gemini: {
    tier: 'FREE',
    rateLimit: '15 requests/minute',
    monthlyFree: 'Unlimited',
    description: 'Google Gemini API is free for development'
  },
  openrouter: {
    tier: 'FREE',
    rateLimit: 'Variable',
    monthlyFree: 'Free tier available',
    description: 'OpenRouter aggregates multiple free models'
  },
  mistral: {
    tier: 'FREE-TIER',
    rateLimit: '100 requests/minute',
    monthlyFree: '$5 free credits',
    description: 'Mistral offers free tier with monthly credits'
  }
};

/**
 * Validar configuración de LLMs
 */
export function validateLLMConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Verificar que al menos un proveedor esté configurado
  const providers = Object.keys(LLM_PROVIDERS) as LLMProvider[];
  let hasValidProvider = false;

  for (const provider of providers) {
    const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (apiKey) {
      hasValidProvider = true;
      console.log(`✅ ${provider.toUpperCase()} API key configured`);
    }
  }

  if (!hasValidProvider) {
    errors.push('No LLM providers configured. Please set at least one API key.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Obtener resumen de configuración (v3.0)
 */
export function getLLMConfigSummary() {
  console.log('\n📊 QodeIA Multi-LLM Configuration Summary (v3.0)\n');
  console.log('Specialists and their models:');
  console.log('─'.repeat(60));

  for (const [key, config] of Object.entries(SPECIALIST_CONFIGS)) {
    console.log(`\n🤖 ${config.name}`);
    console.log(`   Provider: ${config.provider.toUpperCase()}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Temperature: ${config.temperature}`);
    console.log(`   Max Tokens: ${config.maxTokens}`);
  }

  console.log('\n\n💰 Cost Analysis (All Free Tier):');
  console.log('─'.repeat(60));

  for (const [provider, cost] of Object.entries(COST_SUMMARY)) {
    console.log(`\n${provider.toUpperCase()}`);
    console.log(`   Tier: ${cost.tier}`);
    console.log(`   Rate Limit: ${cost.rateLimit}`);
    console.log(`   Monthly Free: ${cost.monthlyFree}`);
  }

  console.log('\n✅ Total Monthly Cost: $0 (All free tier models)');
  console.log('✅ CEO: Gemini Flash Latest (Ultra-fast orchestration)');
  console.log('✅ Pro Validator: DeepSeek V4 Pro (Expert code review)');
  console.log('✅ Logic Specialist: Minimax M2.5 (Advanced reasoning)\n');
}
