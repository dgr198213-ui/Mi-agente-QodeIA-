# Resumen del Proyecto: Agente Autónomo Full-Stack

## Descripción General

Se ha construido un **agente autónomo completo** capaz de gestionar repositorios de GitHub, bases de datos de Supabase y despliegues de Vercel de forma autónoma. El agente implementa un sistema de razonamiento paso a paso y puede modificar su propio código mediante Pull Requests.

## Arquitectura del Sistema

### Componentes Principales

El proyecto está organizado en los siguientes módulos principales:

**1. Núcleo del Agente (`/agent/core/agent.ts`)**

El núcleo implementa el ciclo de vida completo del agente siguiendo el patrón **Pensar → Decidir → Actuar → Guardar Memoria**. La clase `AutonomousAgent` gestiona todo el proceso de razonamiento y ejecución de herramientas utilizando el Vercel AI SDK con el modelo GPT-4.1-mini de OpenAI.

**2. Sistema de Memoria (`/agent/memory/`)**

El sistema de memoria implementa una arquitectura híbrida de tres niveles:

- **Memoria Corta**: Mantiene las últimas 20 interacciones en memoria RAM para acceso rápido.
- **Memoria Media**: Persiste todas las conversaciones en la tabla `messages` de Supabase.
- **Memoria Larga**: Utiliza embeddings vectoriales (text-embedding-3-small de OpenAI) almacenados en la tabla `memory_vectors` con búsqueda semántica mediante la extensión `pgvector` de PostgreSQL.

El módulo `vector.ts` implementa la generación de embeddings y búsqueda por similitud. El módulo `store.ts` gestiona la persistencia de mensajes y eventos. El módulo `state.ts` mantiene el estado persistente del agente entre sesiones.

**3. Herramientas del Agente (`/agent/tools/`)**

Se han implementado tres conjuntos de herramientas especializadas:

**GitHub (`github.ts`)**: Permite al agente leer archivos, crear ramas, hacer commits, abrir Pull Requests, gestionar issues y listar directorios del repositorio.

**Supabase (`supabase.ts`)**: Proporciona operaciones CRUD completas sobre la base de datos, gestión de tareas y consultas personalizadas con filtros y ordenamiento.

**Vercel (`vercel.ts`)**: Permite listar proyectos, consultar el estado de deployments, obtener variables de entorno y cancelar despliegues en progreso.

Todas las herramientas están implementadas con validación de parámetros mediante Zod y retornan resultados estructurados que el agente puede interpretar.

**4. Clientes de Integración (`/lib/`)**

Los módulos en `/lib/` proporcionan clientes configurados para cada servicio externo:

- `supabase.ts`: Cliente de Supabase con Service Role Key y funciones auxiliares para operaciones comunes.
- `github.ts`: Cliente de Octokit configurado con el token de GitHub.
- `vercel.ts`: Cliente HTTP para la API REST de Vercel con autenticación mediante Bearer token.

**5. API Endpoint (`/app/api/agent/route.ts`)**

El endpoint principal expone dos métodos:

- **POST**: Procesa mensajes del usuario con soporte para respuestas completas o streaming.
- **GET**: Retorna información sobre el estado del agente y estadísticas de memoria.

**6. Interfaz de Usuario (`/components/Chat.tsx`)**

Componente React que proporciona una interfaz de chat completa con:

- Visualización de mensajes del usuario y del agente.
- Panel lateral para ver los pasos del razonamiento del agente.
- Gestión de sesiones con identificadores únicos.
- Indicadores de carga y manejo de errores.

## Base de Datos

El esquema de Supabase (`supabase_schema.sql`) incluye cuatro tablas principales:

**Tabla `messages`**: Almacena el historial completo de conversaciones con campos para session_id, role, content y timestamp.

**Tabla `agent_state`**: Mantiene el estado persistente del agente con pares clave-valor en formato JSONB, permitiendo almacenar contadores, configuraciones y metadata.

**Tabla `tasks`**: Sistema de gestión de tareas con estados (pending, in_progress, completed, failed), prioridades y metadata adicional.

**Tabla `memory_vectors`**: Almacena embeddings vectoriales de 1536 dimensiones con índice IVFFlat para búsqueda aproximada de vecinos más cercanos. Incluye una función RPC `match_memory_vectors` para búsqueda por similitud.

## Flujo de Ejecución

Cuando un usuario envía un mensaje, el agente ejecuta el siguiente proceso:

1. **Inicialización**: Carga la memoria corta desde la base de datos y recupera el estado del agente.

2. **Análisis**: Genera embeddings del mensaje del usuario y busca información relevante en la memoria vectorial.

3. **Contexto**: Construye un prompt del sistema que incluye el contexto recuperado, el estado actual del agente y las herramientas disponibles.

4. **Razonamiento**: Utiliza el modelo de lenguaje para analizar la solicitud y decidir qué herramientas ejecutar.

5. **Ejecución**: Ejecuta las herramientas necesarias de forma secuencial, registrando cada paso.

6. **Respuesta**: Genera una respuesta final basada en los resultados de las herramientas.

7. **Persistencia**: Guarda la conversación en la base de datos y, si fue una acción importante, crea un embedding para la memoria de largo plazo.

## Capacidades Destacadas

**Auto-modificación**: El agente puede modificar su propio código creando ramas, haciendo commits y abriendo Pull Requests para revisión humana.

**Razonamiento Transparente**: Cada paso del proceso de razonamiento se registra y puede visualizarse en la interfaz de usuario.

**Memoria Contextual**: El agente mantiene contexto entre conversaciones y puede recuperar información relevante de interacciones pasadas.

**Ejecución Autónoma**: Puede ejecutar tareas complejas de múltiples pasos sin intervención humana.

**Gestión de Estado**: Mantiene contadores y estadísticas de uso que persisten entre sesiones.

## Configuración y Despliegue

El proyecto requiere las siguientes variables de entorno:

- `OPENAI_API_KEY`: Para el modelo de lenguaje y generación de embeddings.
- `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: Para la base de datos.
- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`: Para la integración con GitHub.
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`: Para la integración con Vercel.

El despliegue se puede realizar en Vercel con el comando `vercel`, asegurándose de configurar todas las variables de entorno en el panel de control.

## Archivos Generados

El proyecto incluye los siguientes archivos principales:

- **Configuración**: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- **Agente**: `agent/core/agent.ts`, `agent/memory/*.ts`, `agent/tools/*.ts`
- **Integraciones**: `lib/supabase.ts`, `lib/github.ts`, `lib/vercel.ts`
- **API**: `app/api/agent/route.ts`
- **UI**: `app/page.tsx`, `app/layout.tsx`, `components/Chat.tsx`
- **Base de Datos**: `supabase_schema.sql`
- **Documentación**: `README.md`, `USAGE_EXAMPLES.md`

## Próximos Pasos

Para utilizar el agente:

1. Instalar dependencias con `pnpm install`
2. Configurar las variables de entorno en `.env.local`
3. Ejecutar el esquema SQL en Supabase
4. Iniciar el servidor de desarrollo con `pnpm run dev`
5. Acceder a la interfaz en `http://localhost:3000`

El agente está listo para recibir instrucciones y ejecutar tareas de forma autónoma.
