// Cliente para interactuar con la API de Vercel

// Cliente para interactuar con la API de Vercel
// Se usa una validación flexible para permitir la compilación en Vercel sin variables de entorno presentes
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || 'placeholder-token';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

const BASE_URL = 'https://api.vercel.com';

// Tipos para las operaciones de Vercel
export interface VercelProject {
  id: string;
  name: string;
  framework: string;
  createdAt: number;
  updatedAt: number;
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  createdAt: number;
  readyState: 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | 'CANCELED';
}

export interface DeploymentStatus {
  id: string;
  state: string;
  url: string;
  readyState: string;
}

/**
 * Construye los headers para las peticiones a Vercel API
 */
function getHeaders() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Construye la URL con el teamId si está configurado
 */
function buildUrl(path: string): string {
  const url = new URL(path, BASE_URL);
  if (VERCEL_TEAM_ID) {
    url.searchParams.set('teamId', VERCEL_TEAM_ID);
  }
  return url.toString();
}

/**
 * Lista todos los proyectos de Vercel
 */
export async function listProjects(): Promise<VercelProject[]> {
  const response = await fetch(buildUrl('/v9/projects'), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to list projects: ${response.statusText}`);
  }

  const data = await response.json();
  return data.projects || [];
}

/**
 * Obtiene información de un proyecto específico
 */
export async function getProject(projectId: string): Promise<VercelProject> {
  const response = await fetch(buildUrl(`/v9/projects/${projectId}`), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get project: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Lista los deployments de un proyecto
 */
export async function listDeployments(
  projectId?: string
): Promise<VercelDeployment[]> {
  const pid = projectId || VERCEL_PROJECT_ID;
  if (!pid) {
    throw new Error('Project ID not provided and VERCEL_PROJECT_ID not set');
  }

  const url = buildUrl(`/v6/deployments`);
  const urlObj = new URL(url);
  urlObj.searchParams.set('projectId', pid);

  const response = await fetch(urlObj.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to list deployments: ${response.statusText}`);
  }

  const data = await response.json();
  return data.deployments || [];
}

/**
 * Obtiene el estado de un deployment específico
 */
export async function getDeploymentStatus(
  deploymentId: string
): Promise<DeploymentStatus> {
  const response = await fetch(buildUrl(`/v13/deployments/${deploymentId}`), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get deployment status: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.uid,
    state: data.state,
    url: data.url,
    readyState: data.readyState,
  };
}

/**
 * Crea un nuevo deployment
 * Nota: Esta función requiere más configuración dependiendo del tipo de proyecto
 */
export async function createDeployment(
  projectId: string,
  gitSource?: {
    type: 'github';
    repoId: string;
    ref: string;
  }
) {
  const body: any = {
    name: projectId,
    gitSource,
  };

  const response = await fetch(buildUrl('/v13/deployments'), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create deployment: ${error}`);
  }

  return await response.json();
}

/**
 * Obtiene las variables de entorno de un proyecto
 */
export async function getEnvironmentVariables(projectId?: string) {
  const pid = projectId || VERCEL_PROJECT_ID;
  if (!pid) {
    throw new Error('Project ID not provided and VERCEL_PROJECT_ID not set');
  }

  const response = await fetch(buildUrl(`/v9/projects/${pid}/env`), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get environment variables: ${response.statusText}`);
  }

  const data = await response.json();
  return data.envs || [];
}

/**
 * Obtiene el estado del proyecto actual
 */
export async function getProjectStatus(projectId?: string) {
  const pid = projectId || VERCEL_PROJECT_ID;
  if (!pid) {
    throw new Error('Project ID not provided and VERCEL_PROJECT_ID not set');
  }

  const project = await getProject(pid);
  const deployments = await listDeployments(pid);
  const latestDeployment = deployments[0];

  return {
    project,
    latestDeployment,
    deploymentsCount: deployments.length,
  };
}

/**
 * Cancela un deployment en progreso
 */
export async function cancelDeployment(deploymentId: string) {
  const response = await fetch(buildUrl(`/v12/deployments/${deploymentId}/cancel`), {
    method: 'PATCH',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel deployment: ${response.statusText}`);
  }

  return await response.json();
}
