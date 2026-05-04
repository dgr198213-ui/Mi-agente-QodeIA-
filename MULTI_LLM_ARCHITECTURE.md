# 🚀 QodeIA Multi-LLM Architecture (v2.0)

## Overview

QodeIA implementa una arquitectura **CEO + 4 Especialistas** con modelos LLM gratuitos para máxima eficiencia de costos y rendimiento.

**Actualización v2.0**: Groq ha sido eliminado. Gemini Flash Latest ahora actúa como CEO Orchestrator.

```
┌──────────────────────────────────────────────────────────────────┐
│                    QodeIA CEO Agent (Supervisor)                  │
│                  Modelo: Gemini Flash Latest                      │
│   Funciones: Routing, planificación, validación de outputs       │
└──────────────────────────────────────────────────────────────────┘
              │                │              │              │
        ┌─────▼─────┐    ┌─────▼─────┐  ┌────▼─────┐  ┌────▼─────┐
        │ GitHub    │    │ Supabase  │  │ Vercel   │  │ MCP      │
        │ Agent     │    │ Agent     │  │ Agent    │  │ Agent    │
        │           │    │           │  │          │  │          │
        │ DeepSeek  │    │ Gemini    │  │ Gemini   │  │ Mistral  │
        │ V3        │    │ Flash     │  │ Flash    │  │ Codestral│
        └───────────┘    └───────────┘  └──────────┘  └──────────┘
              │                │              │              │
        ┌─────▼─────────────────────────────────────────────────▼─────┐
        │  Shared State (Conversation History + Context Memory)        │
        │  + Persistencia: Supabase PostgreSQL + pgvector              │
        │  + Memory: Context Memory Engine (70% compresión)            │
        └──────────────────────────────────────────────────────────────┘
```

## 🎯 Especialistas

### 1. **CEO Orchestrator** (Gemini Flash Latest)
- **Responsabilidad**: Orquestación de alto nivel, routing de tareas
- **Características**:
  - Análisis de solicitudes del usuario
  - Descomposición de tareas complejas
  - Validación de outputs
  - Coordinación multi-especialista
- **Velocidad**: Ultra-rápido (Gemini Flash Latest)
- **Costo**: Gratuito

**Archivo**: `agent/core/CEOOrchestrator.ts`

### 2. **GitHub Specialist** (DeepSeek V3)
- **Responsabilidad**: Operaciones de repositorios, código, PRs, issues
- **Herramientas**:
  - `github_create_repo`: Crear repositorio
  - `github_create_issue`: Crear issue
  - `github_list_repos`: Listar repositorios
  - `github_create_pr`: Crear pull request
  - `github_list_issues`: Listar issues
  - `github_get_file_content`: Obtener contenido de archivo
  - `github_create_branch`: Crear rama
- **Velocidad**: Rápido
- **Especialización**: Excelente para análisis de código
- **Costo**: Gratuito (free tier)

**Archivo**: `agent/specialists/GitHubSpecialist.ts`

### 3. **Supabase Specialist** (Gemini Flash Latest)
- **Responsabilidad**: Base de datos, autenticación, búsqueda vectorial
- **Herramientas**:
  - `supabase_query`: Consultar tabla
  - `supabase_insert`: Insertar datos
  - `supabase_vector_search`: Búsqueda semántica
  - `supabase_update`: Actualizar registros
  - `supabase_delete`: Eliminar registros
  - `supabase_create_embedding`: Crear embedding
  - `supabase_auth_user`: Obtener info de usuario
- **Velocidad**: Ultra-rápido (Flash)
- **Especialización**: Excelente para consultas rápidas
- **Costo**: Gratuito

**Archivo**: `agent/specialists/SupabaseSpecialist.ts`

### 4. **Vercel Specialist** (Gemini Flash Latest)
- **Responsabilidad**: Deployments, variables de entorno, monitoreo
- **Herramientas**:
  - `vercel_deploy`: Desplegar proyecto
  - `vercel_get_deployment_status`: Obtener estado
  - `vercel_set_env_var`: Establecer variable de entorno
  - `vercel_list_deployments`: Listar deployments
  - `vercel_rollback`: Rollback a versión anterior
- **Velocidad**: Ultra-rápido
- **Especialización**: Deployments rápidos
- **Costo**: Gratuito

**Archivo**: `agent/specialists/VercelSpecialist.ts`

### 5. **MCP Specialist** (Mistral Codestral)
- **Responsabilidad**: NotebookLM, análisis de código, documentación
- **Funciones**:
  - `analyzeCode`: Análisis de código
  - `generateDocumentation`: Generar documentación
  - `reviewArchitecture`: Revisar arquitectura
  - `analyzeImpact`: Análisis de impacto
  - `suggestImprovements`: Sugerencias de mejora
  - `validateArchitecturalDecision`: Validar decisiones
  - `syncSolutionToKnowledgeBase`: Sincronizar soluciones
  - `queryDocumentation`: Consultar documentación
- **Velocidad**: Rápido
- **Especialización**: Análisis técnico y código
- **Costo**: Gratuito (free tier)

**Archivo**: `agent/specialists/MCPSpecialist.ts`

## 📊 Configuración de LLMs

### Archivo de Configuración Centralizada
**`agent/core/MultiLLMConfig.ts`**

Define:
- Configuración de cada proveedor
- Modelos disponibles
- Prompts del sistema para cada especialista
- URLs base de APIs
- Información de costos

### Proveedores Soportados

| Proveedor | Modelos | Tier | Rate Limit | Costo |
|-----------|---------|------|-----------|-------|
| **Gemini** | Gemini Flash Latest, Gemini 2.5 Flash, Gemini 2.0 Pro | FREE | 15 req/min | $0 |
| **DeepSeek** | DeepSeek V3, DeepSeek Coder | FREE-TIER | 60 req/min | $0 (con créditos) |
| **OpenRouter** | Llama-3.3-70B, Mistral-7B | FREE | Variable | $0 |
| **Mistral** | Codestral, Mistral Large | FREE-TIER | 100 req/min | $0 (con créditos) |

## 🔧 Instalación y Configuración

### 1. Instalar Dependencias

```bash
npm install ai langchain
```

### 2. Configurar Variables de Entorno

```bash
# .env.local
GEMINI_API_KEY=AIzaSyCR53aZtrLVQSRfuOT2h6sRbWJxSmg0Gsc
DEEPSEEK_API_KEY=your_deepseek_api_key
MISTRAL_API_KEY=your_mistral_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# GitHub
GITHUB_TOKEN=your_github_token

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Vercel
VERCEL_TOKEN=your_vercel_token
```

### 3. Validar Configuración

```typescript
import { validateLLMConfig, getLLMConfigSummary } from '@/agent/core/MultiLLMConfig';

const { valid, errors } = validateLLMConfig();
if (valid) {
  getLLMConfigSummary();
} else {
  console.error('Configuration errors:', errors);
}
```

## 💻 Uso

### Ejemplo 1: Usar CEO Orchestrator

```typescript
import { createCEOOrchestrator } from '@/agent/core/CEOOrchestrator';

const ceo = await createCEOOrchestrator();

const response = await ceo.processRequest({
  userMessage: 'Create a new GitHub repo and set up Supabase auth',
  sessionId: 'user_123'
});

console.log(response.response);
console.log('Delegated tasks:', response.delegatedTasks);
```

### Ejemplo 2: Usar Especialista Individual

```typescript
import { createGitHubSpecialist } from '@/agent/specialists/GitHubSpecialist';

const github = await createGitHubSpecialist();

const result = await github.createRepository(
  'my-app',
  'My awesome application',
  true
);

console.log(result.result);
```

### Ejemplo 3: API Route en Next.js

```typescript
// app/api/agent/route.ts
import { createCEOOrchestrator } from '@/agent/core/CEOOrchestrator';

export async function POST(request: Request) {
  const { message, sessionId } = await request.json();

  const ceo = await createCEOOrchestrator();
  const response = await ceo.processRequest({
    userMessage: message,
    sessionId
  });

  await ceo.cleanup();

  return Response.json(response);
}
```

## 📈 Rendimiento

### Benchmarks (Aproximados)

| Operación | Tiempo Promedio | Especialista |
|-----------|-----------------|--------------|
| Crear repositorio | 2-3s | GitHub (DeepSeek) |
| Consulta DB simple | 1-2s | Supabase (Gemini Flash) |
| Desplegar a Vercel | 30-60s | Vercel (Gemini Flash) |
| Análisis de código | 3-5s | MCP (Mistral) |
| Orquestación CEO | 1-2s | CEO (Gemini Flash) |

### Compresión de Contexto

- **CME (Context Memory Engine)**: 70% compresión
- **Historial de conversación**: Persistente en Supabase
- **Embeddings**: pgvector para búsqueda semántica

## 💰 Análisis de Costos

### Costo Mensual: **$0**

Todos los modelos utilizados están en tier gratuito o tienen créditos mensuales gratuitos:

- **Gemini Flash Latest**: Gratuito (15 req/min) - CEO + Supabase + Vercel
- **DeepSeek**: $5 créditos mensuales gratis - GitHub Specialist
- **Mistral**: $5 créditos mensuales gratis - MCP Specialist

**Total**: $0/mes para MVP + Producción

## 🔐 Seguridad

### Mejores Prácticas

1. **Nunca commitear API keys**
   - Usar `.env.local` (git-ignored)
   - Usar Vercel Environment Variables en producción

2. **RLS en Supabase**
   - Todas las operaciones respetan Row Level Security
   - Validación de permisos en cada consulta

3. **Validación de Entrada**
   - Sanitizar inputs de usuario
   - Validar parámetros antes de ejecutar herramientas

4. **Logging y Auditoría**
   - Registrar todas las operaciones delegadas
   - Mantener historial en Supabase

## 🚀 Próximos Pasos

1. **Implementar persistencia**: Guardar estado en Supabase
2. **Agregar streaming**: Respuestas en tiempo real
3. **Implementar caché**: Reducir latencia
4. **Agregar más especialistas**: Análisis, testing, etc.
5. **Crear dashboard**: Visualizar ejecución de agentes

## 📚 Referencias

- [LangChain Documentation](https://python.langchain.com/)
- [Google Gemini API](https://ai.google.dev/)
- [DeepSeek API](https://api.deepseek.com/)
- [Mistral API](https://console.mistral.ai/)
- [OpenRouter](https://openrouter.ai/)

## 📝 Licencia

MIT - QodeIA Ecosystem
