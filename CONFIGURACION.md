# Guía de Configuración - Mi Agente QodeIA

## 🚨 Problema Crítico Identificado

El proyecto tiene un **error de despliegue en Vercel** que debe ser resuelto:

```
Error: No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies".
```

### Causa del Problema

1. ❌ El despliegue está usando una rama incorrecta: `pagerank-governance-287538528935737765`
2. ⚠️ El proyecto usa `pnpm-lock.yaml` pero Vercel puede tener problemas detectando Next.js

### Solución Inmediata

#### Opción 1: Cambiar Configuración de Vercel (RECOMENDADO)

1. Ve a https://vercel.com/dashboard
2. Selecciona el proyecto `mi-agente-qode-ia`
3. Ve a Settings → Git
4. Cambia "Production Branch" a `main`
5. Ve a Settings → General
6. Verifica que "Root Directory" esté vacío o sea `.`
7. Verifica que "Framework Preset" sea `Next.js`
8. Guarda cambios y redespliega

#### Opción 2: Forzar Redespliegue desde main

```bash
cd /home/ubuntu/mi-agente-qodeia
git checkout main
git pull origin main
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

## Variables de Entorno Configuradas

### ✅ Supabase Operativa (Agente QodeIA)
- `NEXT_PUBLIC_SUPABASE_URL`: https://nknevqndawnokiaickkl.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Configurada

### ✅ Supabase Conocimiento (Howard OS)
- `HOWARD_OS_SUPABASE_URL`: https://tztypjxqklxygfzbpkmm.supabase.co
- `HOWARD_OS_SUPABASE_KEY`: Configurada

### ✅ GitHub
- `GITHUB_OWNER`: dgr198213-ui
- `GITHUB_REPO`: Mi-agente-QodeIA-

### ✅ Vercel
- `VERCEL_TEAM_ID`: team_JAdXWfQ7CTEn4X65PX7iNJ5E
- `VERCEL_PROJECT_ID`: prj_He7Xk8zyji0mdREOS2IB20H7uKUH

### ✅ URLs del Ecosistema
- `NEXT_PUBLIC_HOWARD_OS_URL`: https://plataforma-qd.vercel.app
- `NEXT_PUBLIC_WEB_URL`: https://web-qode-ia.vercel.app

### ⚠️ Pendiente de Configuración (Requieren Claves Privadas)

Estas variables **DEBEN** ser configuradas manualmente por seguridad:

1. **SUPABASE_SERVICE_ROLE_KEY**
   - Obtener de: Supabase Dashboard → Settings → API → Project API keys → service_role
   - ⚠️ **NUNCA** commitear esta clave al repositorio

2. **OPENAI_API_KEY**
   - Obtener de: https://platform.openai.com/api-keys
   - Necesaria para el funcionamiento del agente

3. **GITHUB_TOKEN**
   - Obtener de: GitHub → Settings → Developer settings → Personal access tokens
   - Permisos necesarios: `repo`, `workflow`

4. **VERCEL_TOKEN**
   - Obtener de: Vercel → Settings → Tokens
   - Necesario para gestión de despliegues

5. **NotebookLM MCP** (Opcional pero recomendado)
   - `HOWARD_OS_NOTEBOOK_URL`: URL del notebook de Howard OS
   - `SOLUCIONES_NOTEBOOK_URL`: URL del notebook de Soluciones
   - `NOTEBOOKLM_COOKIE`: Cookie de autenticación

## Configuración en Vercel

### Paso 1: Configurar Variables Públicas

```bash
cd /home/ubuntu/mi-agente-qodeia
./configure-vercel-env.sh
```

### Paso 2: Configurar Variables Privadas Manualmente

```bash
# Service Role Key de Supabase
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# OpenAI API Key
vercel env add OPENAI_API_KEY production

# GitHub Token
vercel env add GITHUB_TOKEN production

# Vercel Token
vercel env add VERCEL_TOKEN production
```

### Paso 3: Redesplegar

```bash
vercel --prod
```

## Arquitectura del Agente

### Componentes Principales

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| **Agente Core** | `/agent/core/agent_with_mcp.ts` | Lógica principal del agente con MCP |
| **Herramientas Supabase** | `/agent/tools/supabase.ts` | Operaciones de base de datos |
| **Herramientas MCP** | `/agent/tools/mcp_notebooklm.ts` | Integración con NotebookLM |
| **Cliente MCP** | `/mcp/client.ts` | Cliente del Model Context Protocol |
| **API Agente** | `/app/api/agent/route.ts` | Endpoint principal del agente |
| **API MCP** | `/app/api/mcp/` | Endpoints de gestión MCP |

### Flujo de Ejecución

```
Usuario → Web QodeIA → Mi Agente QodeIA
                           │
                           ├─> Supabase Operativa (Estado, Tareas, Memoria)
                           │
                           ├─> Supabase Howard OS (Contexto, Conocimiento)
                           │
                           ├─> OpenAI API (Razonamiento)
                           │
                           ├─> GitHub API (Gestión de código)
                           │
                           ├─> Vercel API (Gestión de despliegues)
                           │
                           └─> NotebookLM MCP (Base de conocimiento)
```

## Integración MCP (Model Context Protocol)

### ¿Qué es MCP?

El **Model Context Protocol** permite al agente:
- Consultar documentación técnica verificable en NotebookLM
- Analizar impacto de cambios en el ecosistema
- Sincronizar soluciones validadas con la base de conocimiento
- Verificar decisiones técnicas contra la arquitectura Howard OS

### Herramientas MCP Disponibles

1. **queryDocumentation**: Consulta documentación técnica
2. **analyzeImpact**: Analiza impacto de cambios
3. **syncSolutionToKnowledgeBase**: Sincroniza soluciones validadas
4. **verifyArchitecturalDecision**: Verifica decisiones técnicas

### Configurar NotebookLM

1. Crear notebooks en NotebookLM:
   - **Howard OS**: Documentación técnica del sistema
   - **Soluciones**: Base de conocimiento de errores resueltos

2. Obtener URLs de los notebooks

3. Obtener cookie de autenticación:
   ```javascript
   // En la consola del navegador en notebooklm.google.com
   document.cookie
   ```

4. Configurar variables en Vercel:
   ```bash
   vercel env add HOWARD_OS_NOTEBOOK_URL production
   vercel env add SOLUCIONES_NOTEBOOK_URL production
   vercel env add NOTEBOOKLM_COOKIE production
   ```

## Verificación de Configuración

### 1. Verificar Despliegue

```bash
curl https://mi-agente-qode-ia.vercel.app/api/agent
```

Respuesta esperada: `{"error": "Method not allowed"}` (es correcto, solo acepta POST)

### 2. Probar Endpoint del Agente

```bash
curl -X POST https://mi-agente-qode-ia.vercel.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola, ¿estás funcionando?"}'
```

### 3. Verificar Conexión con Supabase

```bash
# Verificar tabla agent_state
curl https://mi-agente-qode-ia.vercel.app/api/mcp/stats
```

### 4. Probar Integración MCP

```bash
curl https://mi-agente-qode-ia.vercel.app/api/mcp/test
```

## Troubleshooting

### Error: "No Next.js version detected"

**Solución:**
1. Verificar configuración de Vercel (Root Directory, Framework Preset)
2. Cambiar rama de producción a `main`
3. Forzar redespliegue

### Error: "Supabase client not configured"

**Solución:**
1. Verificar que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén configuradas
2. Verificar que `SUPABASE_SERVICE_ROLE_KEY` esté configurada
3. Redespliegar el proyecto

### Error: "OpenAI API key not configured"

**Solución:**
1. Obtener API key de OpenAI
2. Configurar `OPENAI_API_KEY` en Vercel
3. Redespliegar el proyecto

### Error: "Cannot connect to Howard OS"

**Solución:**
1. Verificar que Plataforma QD esté desplegada
2. Verificar que `NEXT_PUBLIC_HOWARD_OS_URL` esté configurada correctamente
3. Probar endpoint: `curl https://plataforma-qd.vercel.app`

### MCP no funciona

**Solución:**
1. Verificar que las variables de NotebookLM estén configuradas
2. Verificar que la cookie de NotebookLM sea válida
3. Probar endpoint: `curl https://mi-agente-qode-ia.vercel.app/api/mcp/test`

## Próximos Pasos

1. ✅ Resolver error de despliegue en Vercel
2. ✅ Configurar variables de entorno públicas
3. ⏳ Configurar variables de entorno privadas (API keys)
4. ⏳ Probar endpoint del agente
5. ⏳ Configurar NotebookLM MCP
6. ⏳ Probar integración completa con el ecosistema

## Referencias

- [README Principal](./README.md)
- [Guía de Configuración MCP](./MCP_WEB_CONFIG_GUIDE.md)
- [Esquema de Base de Datos](./supabase_schema.sql)
- [Actualización MCP](./supabase_mcp_update.sql)

---

**Última actualización:** 5 de febrero de 2026
