# Agente Autónomo Full-Stack

Este es un agente autónomo construido con **Next.js**, **Vercel AI SDK**, **Supabase** y la **API de GitHub**. Puede gestionar repositorios, despliegues y operaciones de base de datos de forma autónoma.

## Características

- **Arquitectura Moderna**: Construido sobre Next.js con App Router.
- **Razonamiento y Herramientas**: Utiliza el Vercel AI SDK para el razonamiento paso a paso, la ejecución de herramientas y el streaming de respuestas.
- **Integración con Supabase**:
  - Memoria de conversación persistente en la tabla `messages`.
  - Memoria a largo plazo mediante embeddings vectoriales en la tabla `memory_vectors`.
  - Gestión del estado del agente en la tabla `agent_state`.
  - Sistema de gestión de tareas en la tabla `tasks`.
- **Integración con GitHub**: Gestión de repositorios, incluyendo lectura de archivos, creación de ramas, commits y Pull Requests.
- **Integración con Vercel**: Gestión de despliegues, consulta de estado de proyectos y más.
- **Interfaz de Usuario**: Componente de chat en React para interactuar con el agente.

## Prerrequisitos

- Node.js 20+
- Un proyecto de Supabase con la extensión `pgvector` habilitada.
- Un Token de Acceso Personal de GitHub.
- Un Token de Acceso de Vercel.
- Una clave de API de OpenAI.

## Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con el siguiente contenido:

```env
# Clave de API de OpenAI
OPENAI_API_KEY=your_openai_key

# Configuración de Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Configuración de GitHub
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name

# Configuración de Vercel
VERCEL_TOKEN=your_vercel_token
VERCEL_TEAM_ID=your_team_id_optional
VERCEL_PROJECT_ID=your_project_id
```

## Instalación y Despliegue

1.  **Instalar Dependencias**:

    ```bash
    pnpm install
    ```

2.  **Esquema de la Base de Datos**:
    Ejecuta el contenido del archivo `supabase_schema.sql` en el editor de SQL de tu proyecto de Supabase para crear las tablas y funciones necesarias.

3.  **Ejecutar la Aplicación en Desarrollo**:

    ```bash
    pnpm run dev
    ```

4.  **Desplegar en Vercel**:
    Puedes desplegar la aplicación directamente en Vercel. Asegúrate de configurar todas las variables de entorno en la configuración del proyecto en Vercel.

    ```bash
    vercel
    ```

## Estructura del Proyecto

-   `/app/api/agent/route.ts`: Endpoint principal de la API para el agente.
-   `/agent/core/agent.ts`: Lógica central del ciclo de vida del agente (pensar, decidir, actuar).
-   `/agent/tools/`: Herramientas especializadas para GitHub, Supabase y Vercel.
-   `/agent/memory/`: Sistema de memoria híbrida (corta y larga duración con vectores).
-   `/lib/`: Clientes para los servicios de Supabase, GitHub y Vercel.
-   `/components/Chat.tsx`: Interfaz de usuario para interactuar con el agente.
-   `/supabase_schema.sql`: Esquema SQL para la base de datos.

## Herramientas Incluidas

### GitHub

-   `getFile`: Lee el contenido de un archivo en el repositorio.
-   `createOrUpdateFile`: Crea o actualiza un archivo con un commit.
-   `createBranch`: Crea una nueva rama.
-   `createPullRequest`: Abre un Pull Request.
-   `createIssue`: Crea un nuevo issue.
-   `listIssues`: Lista los issues abiertos.
-   `listDirectory`: Lista el contenido de un directorio.

### Supabase

-   `insertData`: Inserta registros en una tabla.
-   `queryData`: Consulta datos con filtros.
-   `updateData`: Actualiza registros.
-   `deleteData`: Elimina registros.
-   `createTask`: Crea una nueva tarea para el agente.
-   `updateTaskStatus`: Actualiza el estado de una tarea.
-   `listPendingTasks`: Lista las tareas pendientes.

### Vercel

-   `listProjects`: Lista los proyectos de Vercel.
-   `getProjectStatus`: Obtiene el estado de un proyecto y su último despliegue.
-   `listDeployments`: Lista los despliegues de un proyecto.
-   `getDeploymentStatus`: Obtiene el estado de un despliegue específico.
-   `cancelDeployment`: Cancela un despliegue en progreso.
