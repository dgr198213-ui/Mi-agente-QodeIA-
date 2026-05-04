/**
 * Configuración Multi-LLM para QodeIA (v4.0)
 * Integra: DeepSeek V4 (Flash + Pro con Thinking), Gemini Flash Latest, Minimax, OpenRouter
 * Todos los modelos son gratuitos o tienen tier gratuito
 * 
 * CEO: Gemini Flash Latest (Orquestación ultra-rápida)
 * GitHub/MCP/Pro: DeepSeek V4 (Flash y Pro con Thinking activado)
 * Logic: Minimax M2.5 (Razonamiento lógico)
 * 
 * ELIMINADO: Mistral (reemplazado por DeepSeek V4 Pro)
 */

import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Tipos de LLMs disponibles (v4.0)
 */
export type LLMProvider = 'deepseek' | 'gemini' | 'openrouter' | 'huggingface';

/**
 * Configuración de cada proveedor (v4.0)
 */
export const LLM_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    models: {
      'deepseek-v4-flash': {
        name: 'DeepSeek V4 Flash',
        speed: 'ultra-fast',
        reasoning: 'excellent',
        costTier: 'free-tier',
        useCase: 'Code generation, GitHub operations, fast reasoning'
      },
      'deepseek-v4-pro': {
        name: 'DeepSeek V4 Pro',
        speed: 'fast',
        reasoning: 'expert',
        costTier: 'free-tier',
        useCase: 'Advanced code validation, architecture review, deep thinking'
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
      }
    }
  },
  huggingface: {
    name: 'HuggingFace',
    models: {
      'deepseek-ai/DeepSeek-V4-Pro': {
        name: 'DeepSeek V4 Pro (HuggingFace)',
        speed: 'fast',
        reasoning: 'expert',
        costTier: 'free-tier',
        useCase: 'Alternative access to DeepSeek V4 Pro'
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
  thinking?: {
    type: 'enabled' | 'disabled';
    budgetTokens?: number;
  };
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * Configuración de especialistas (v4.0)
 * CEO (Gemini) + GitHub/MCP/ProValidator (DeepSeek V4) + Logic (Minimax)
 */
export const SPECIALIST_CONFIGS: Record<string, SpecialistConfig> = {
  ceo: {
    name: 'CEO Orchestrator',
    provider: 'gemini',
    model: 'gemini-flash-latest',
    temperature: 0.2,
    maxTokens: 2048,
    systemPrompt: `You are QodeIA CEO Agent — the workflow orchestrator for the QodeIA ecosystem (v4.0).
Powered by Google Gemini Flash Latest for ultra-fast reasoning.

## Your Role
1. Analyze user requests and decompose into specialized tasks
2. Route tasks to appropriate specialist agents:
   - github_specialist: Repository operations, code, PRs, issues (DeepSeek V4 Flash)
   - supabase_specialist: Database, auth, vector search, embeddings (Gemini Flash)
   - vercel_specialist: Deployments, environment variables, monitoring (Gemini Flash)
   - mcp_specialist: NotebookLM integration, documentation analysis (DeepSeek V4 Pro)
   - logic_specialist: Logical reasoning, mathematical analysis (Minimax M2.5)
   - pro_validator: Final validation of critical code and architecture (DeepSeek V4 Pro)
   - molbot_specialist: Automation workflows, integrations, and scripting (DeepSeek V4 Flash)
   - nocode_specialist: UI generation, React/Tailwind components, and design (Gemini Flash)
3. Coordinate multi-agent workflows when needed
4. Validate outputs before returning to user
5. Maintain context across multiple specialist calls

## Decision Rules
- For code operations → GitHub Specialist (DeepSeek V4 Flash with Thinking)
- For data/database → Supabase Specialist (Gemini Flash)
- For deployments → Vercel Specialist (Gemini Flash)
- For documentation/analysis → MCP Specialist (DeepSeek V4 Pro with Thinking)
- For logical/mathematical tasks → Logic Specialist (Minimax M2.5)
- For critical code validation → Pro Validator (DeepSeek V4 Pro with Deep Thinking)
- For automation/integrations → Molbot Specialist (DeepSeek V4 Flash)
- For UI/No-Code design → No-Code Specialist (Gemini Flash)

Always start with a clear plan, then delegate. Be concise and strategic.
Respond in the same language as the user request.`
  },

  github: {
    name: 'GitHub Specialist',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    temperature: 0.1,
    maxTokens: 4096,
    thinking: {
      type: 'enabled',
      budgetTokens: 8000
    },
    reasoningEffort: 'high',
    systemPrompt: `You are the GitHub Specialist for QodeIA.
Powered by DeepSeek V4 Flash with Extended Thinking for excellent code reasoning.

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
- Use extended thinking for complex code analysis

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
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    temperature: 0.0,
    maxTokens: 4096,
    thinking: {
      type: 'enabled',
      budgetTokens: 16000
    },
    reasoningEffort: 'high',
    systemPrompt: `You are the MCP (Model Context Protocol) Specialist for QodeIA.
Powered by DeepSeek V4 Pro with Extended Deep Thinking for expert code analysis.

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
- Use deep thinking for complex architectural decisions

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
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    temperature: 0.1,
    maxTokens: 4096,
    thinking: {
      type: 'enabled',
      budgetTokens: 20000
    },
    reasoningEffort: 'high',
    systemPrompt: `You are the Pro Validator for QodeIA.
Powered by DeepSeek V4 Pro with Extended Deep Thinking for advanced code validation and architectural review.

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
- Use deep thinking for complex validations

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
 * Obtener URL base para cada proveedor (v4.0)
 */
function getLLMBaseURL(provider: LLMProvider): string {
  const baseURLs: Record<LLMProvider, string> = {
    deepseek: 'https://api.deepseek.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    openrouter: 'https://openrouter.ai/api/v1',
    huggingface: 'https://api-inference.huggingface.co/v1'
  };

  return baseURLs[provider];
}

/**
 * Información de costos (v4.0 - Mistral eliminado)
 */
export const COST_SUMMARY = {
  deepseek: {
    tier: 'FREE-TIER',
    rateLimit: '60 requests/minute',
    monthlyFree: '$5 free credits',
    description: 'DeepSeek offers free tier with monthly credits for V4 Flash and Pro'
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
    description: 'OpenRouter aggregates multiple free models including Minimax'
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
 * Obtener resumen de configuración (v4.0)
 */
export function getLLMConfigSummary() {
  console.log('\n📊 QodeIA Multi-LLM Configuration Summary (v4.0)\n');
  console.log('Specialists and their models:');
  console.log('─'.repeat(60));

  for (const [key, config] of Object.entries(SPECIALIST_CONFIGS)) {
    console.log(`\n🤖 ${config.name}`);
    console.log(`   Provider: ${config.provider.toUpperCase()}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Temperature: ${config.temperature}`);
    console.log(`   Max Tokens: ${config.maxTokens}`);
    if (config.thinking?.type === 'enabled') {
      console.log(`   Thinking: ENABLED (${config.thinking.budgetTokens} tokens)`);
      console.log(`   Reasoning Effort: ${config.reasoningEffort}`);
    }
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
  console.log('✅ Code Intelligence: DeepSeek V4 (Flash + Pro with Extended Thinking)');
  console.log('✅ Logic Specialist: Minimax M2.5 (Advanced reasoning)');
  console.log('✅ Mistral: ELIMINADO (reemplazado por DeepSeek V4 Pro)\n');
}
