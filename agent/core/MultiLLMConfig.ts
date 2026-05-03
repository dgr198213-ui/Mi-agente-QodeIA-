/**
 * Configuración Multi-LLM para QodeIA
 * Integra: Groq, DeepSeek, Gemini, OpenRouter, Mistral
 * Todos los modelos son gratuitos o tienen tier gratuito
 */

import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Tipos de LLMs disponibles
 */
export type LLMProvider = 'groq' | 'deepseek' | 'gemini' | 'openrouter' | 'mistral';

/**
 * Configuración de cada proveedor
 */
export const LLM_PROVIDERS = {
  groq: {
    name: 'Groq',
    models: {
      'llama-3.3-70b': {
        name: 'Llama 3.3 70B',
        speed: 'ultra-fast',
        reasoning: 'excellent',
        costTier: 'free',
        useCase: 'CEO Orchestration, General reasoning'
      },
      'llama-3.1-8b': {
        name: 'Llama 3.1 8B',
        speed: 'ultra-fast',
        reasoning: 'good',
        costTier: 'free',
        useCase: 'Fast deployments, simple tasks'
      },
      'mixtral-8x7b': {
        name: 'Mixtral 8x7B',
        speed: 'fast',
        reasoning: 'very-good',
        costTier: 'free',
        useCase: 'General purpose, code'
      }
    }
  },
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
  gemini: {
    name: 'Google Gemini',
    models: {
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
 * Configuración de especialistas
 */
export const SPECIALIST_CONFIGS: Record<string, SpecialistConfig> = {
  ceo: {
    name: 'CEO Orchestrator',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    maxTokens: 2048,
    systemPrompt: `You are QodeIA CEO Agent — the workflow orchestrator for the QodeIA ecosystem.

## Your Role
1. Analyze user requests and decompose into specialized tasks
2. Route tasks to appropriate specialist agents:
   - github_specialist: Repository operations, code, PRs, issues
   - supabase_specialist: Database, auth, vector search, embeddings
   - vercel_specialist: Deployments, environment variables, monitoring
   - mcp_specialist: NotebookLM integration, documentation analysis
3. Coordinate multi-agent workflows when needed
4. Validate outputs before returning to user
5. Maintain context across multiple specialist calls

## Decision Rules
- For code operations → GitHub Specialist
- For data/database → Supabase Specialist
- For deployments → Vercel Specialist
- For documentation/analysis → MCP Specialist

Always start with a clear plan, then delegate. Be concise and strategic.`
  },

  github: {
    name: 'GitHub Specialist',
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 4096,
    systemPrompt: `You are the GitHub Specialist for QodeIA.

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

## Available Tools
- github_create_repo, github_create_issue, github_list_repos
- github_create_pr, github_list_issues, github_get_file_content
- github_create_branch, github_update_file, github_delete_branch`
  },

  supabase: {
    name: 'Supabase Specialist',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    temperature: 0.1,
    maxTokens: 3000,
    systemPrompt: `You are the Supabase Specialist for QodeIA.

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
- supabase_auth_user, supabase_list_tables`
  },

  vercel: {
    name: 'Vercel Specialist',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    temperature: 0.1,
    maxTokens: 2048,
    systemPrompt: `You are the Vercel Specialist for QodeIA.

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
- vercel_set_env_var, vercel_list_deployments, vercel_rollback`
  },

  mcp: {
    name: 'MCP Specialist',
    provider: 'mistral',
    model: 'codestral-latest',
    temperature: 0.0,
    maxTokens: 4096,
    systemPrompt: `You are the MCP (Model Context Protocol) Specialist for QodeIA.

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
- mcp_generate_documentation, mcp_list_tools`
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
 * Obtener URL base para cada proveedor
 */
function getLLMBaseURL(provider: LLMProvider): string {
  const baseURLs: Record<LLMProvider, string> = {
    groq: 'https://api.groq.com/openai/v1',
    deepseek: 'https://api.deepseek.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    openrouter: 'https://openrouter.ai/api/v1',
    mistral: 'https://api.mistral.ai/v1'
  };

  return baseURLs[provider];
}

/**
 * Información de costos
 */
export const COST_SUMMARY = {
  groq: {
    tier: 'FREE',
    rateLimit: '30 requests/minute',
    monthlyFree: 'Unlimited',
    description: 'Groq offers free API access with generous rate limits'
  },
  deepseek: {
    tier: 'FREE-TIER',
    rateLimit: '60 requests/minute',
    monthlyFree: '$5 free credits',
    description: 'DeepSeek offers free tier with monthly credits'
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
 * Obtener resumen de configuración
 */
export function getLLMConfigSummary() {
  console.log('\n📊 QodeIA Multi-LLM Configuration Summary\n');
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

  console.log('\n✅ Total Monthly Cost: $0 (All free tier models)\n');
}
