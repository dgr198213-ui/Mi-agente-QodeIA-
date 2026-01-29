# Ejemplos de Uso del Agente Autónomo

Este documento proporciona ejemplos prácticos de cómo interactuar con el agente autónomo y qué tipo de tareas puede realizar.

## Ejemplos de Interacción

### 1. Gestión de Repositorio GitHub

**Listar archivos del repositorio:**
```
Usuario: "Lista los archivos del directorio /app"
Agente: [Ejecuta listDirectory] "Aquí están los archivos en /app: ..."
```

**Leer un archivo:**
```
Usuario: "Muéstrame el contenido del archivo package.json"
Agente: [Ejecuta getFile] "El contenido del archivo es: ..."
```

**Crear una nueva rama:**
```
Usuario: "Crea una nueva rama llamada feature/new-feature"
Agente: [Ejecuta createBranch] "Rama feature/new-feature creada exitosamente"
```

**Modificar código y crear PR:**
```
Usuario: "Agrega un nuevo endpoint en /app/api/health/route.ts y crea un PR"
Agente: 
1. [Ejecuta createBranch] Crea rama feature/health-endpoint
2. [Ejecuta createOrUpdateFile] Crea el archivo con el código
3. [Ejecuta createPullRequest] Abre PR con los cambios
"He creado el endpoint y abierto el PR #123"
```

### 2. Gestión de Base de Datos Supabase

**Consultar tareas pendientes:**
```
Usuario: "¿Cuáles son las tareas pendientes?"
Agente: [Ejecuta listPendingTasks] "Tienes 3 tareas pendientes: ..."
```

**Crear una nueva tarea:**
```
Usuario: "Crea una tarea para revisar el código del módulo de autenticación"
Agente: [Ejecuta createTask] "Tarea creada con prioridad 5"
```

**Consultar datos personalizados:**
```
Usuario: "Muéstrame los últimos 10 mensajes de la sesión actual"
Agente: [Ejecuta queryData en tabla messages] "Aquí están los últimos mensajes: ..."
```

### 3. Gestión de Vercel

**Ver estado del proyecto:**
```
Usuario: "¿Cuál es el estado actual del deployment?"
Agente: [Ejecuta getProjectStatus] "El último deployment está en estado READY en https://..."
```

**Listar proyectos:**
```
Usuario: "Lista todos los proyectos de Vercel"
Agente: [Ejecuta listProjects] "Tienes 5 proyectos: ..."
```

**Ver deployments recientes:**
```
Usuario: "Muéstrame los últimos 5 deployments"
Agente: [Ejecuta listDeployments] "Aquí están los últimos deployments: ..."
```

### 4. Tareas Autónomas Complejas

**Auto-modificación del código:**
```
Usuario: "Agrega una nueva herramienta que pueda enviar emails"
Agente:
1. [Piensa] Necesito crear un nuevo archivo de herramienta
2. [Ejecuta createBranch] Crea rama feature/email-tool
3. [Ejecuta createOrUpdateFile] Crea /agent/tools/email.ts
4. [Ejecuta createOrUpdateFile] Actualiza /agent/core/agent.ts para incluir la herramienta
5. [Ejecuta createPullRequest] Abre PR con los cambios
"He creado la herramienta de email y abierto el PR #124 para revisión"
```

**Análisis y reporte:**
```
Usuario: "Analiza el estado del proyecto y dame un reporte completo"
Agente:
1. [Ejecuta getProjectStatus] Obtiene estado de Vercel
2. [Ejecuta listPendingTasks] Obtiene tareas pendientes
3. [Ejecuta listIssues] Obtiene issues abiertos de GitHub
4. [Genera reporte] "Aquí está el reporte completo del proyecto: ..."
```

## Ejemplos de Código

### Llamar al Agente desde JavaScript

```javascript
// Ejemplo de llamada al endpoint del agente
const response = await fetch('/api/agent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Lista los archivos del repositorio',
    sessionId: 'user-session-123',
    stream: false,
  }),
});

const data = await response.json();
console.log(data.response);
console.log(data.steps); // Ver el razonamiento del agente
```

### Usar el Agente Programáticamente

```typescript
import { createAgent } from '@/agent/core/agent';

async function main() {
  // Crear instancia del agente
  const agent = await createAgent({
    sessionId: 'programmatic-session',
    model: 'gpt-4.1-mini',
    temperature: 0.7,
  });

  // Procesar un mensaje
  const result = await agent.processMessage(
    'Crea una nueva rama llamada feature/test'
  );

  console.log(result.response);
  console.log(`Herramientas ejecutadas: ${result.toolCalls}`);
}

main();
```

## Capacidades del Sistema de Memoria

El agente mantiene tres niveles de memoria:

1. **Memoria Corta (RAM)**: Últimas 20 interacciones en memoria.
2. **Memoria Media (Base de Datos)**: Todas las interacciones persistidas en Supabase.
3. **Memoria Larga (Vectores)**: Embeddings para búsqueda semántica de información relevante.

Cuando haces una pregunta, el agente:
- Busca en la memoria vectorial información relevante.
- Recupera el contexto de la conversación actual.
- Usa toda esta información para generar una respuesta contextualizada.

## Consejos de Uso

1. **Sé específico**: Cuanto más específico seas en tus instrucciones, mejor será el resultado.
2. **Revisa los pasos**: Usa el panel de "Pasos del Agente" para entender qué herramientas está usando.
3. **Memoria persistente**: El agente recuerda conversaciones pasadas, así que puedes hacer referencias a interacciones anteriores.
4. **Tareas complejas**: El agente puede manejar tareas de múltiples pasos de forma autónoma.
5. **Revisión de PRs**: Siempre revisa los Pull Requests creados por el agente antes de fusionarlos.
