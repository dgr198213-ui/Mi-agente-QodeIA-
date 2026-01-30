import { Octokit } from '@octokit/rest';

// Cliente de GitHub API
// Se usa una validación flexible para permitir la compilación en Vercel sin variables de entorno presentes
const githubToken = process.env.GITHUB_TOKEN || 'placeholder-token';

export const octokit = new Octokit({
  auth: githubToken,
});

// Variables de configuración del repositorio
export const GITHUB_OWNER = process.env.GITHUB_OWNER || '';
export const GITHUB_REPO = process.env.GITHUB_REPO || '';

if (!GITHUB_OWNER || !GITHUB_REPO) {
  console.warn('Warning: GITHUB_OWNER or GITHUB_REPO not configured');
}

// Tipos para las operaciones de GitHub
export interface FileContent {
  path: string;
  content: string;
  sha?: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  html_url: string;
}

/**
 * Obtiene el contenido de un archivo del repositorio
 */
export async function getFileContent(
  path: string,
  ref?: string
): Promise<FileContent | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      ref,
    });

    if ('content' in data && data.type === 'file') {
      return {
        path: data.path,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        sha: data.sha,
      };
    }

    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Crea o actualiza un archivo en el repositorio
 */
export async function createOrUpdateFile(
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string
) {
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path,
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    sha,
  });

  return data;
}

/**
 * Obtiene información de una rama
 */
export async function getBranch(branch: string): Promise<BranchInfo | null> {
  try {
    const { data } = await octokit.repos.getBranch({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch,
    });

    return {
      name: data.name,
      sha: data.commit.sha,
    };
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Crea una nueva rama desde otra rama base
 */
export async function createBranch(
  newBranch: string,
  fromBranch: string = 'main'
): Promise<BranchInfo> {
  // Obtener el SHA de la rama base
  const baseBranch = await getBranch(fromBranch);
  if (!baseBranch) {
    throw new Error(`Base branch ${fromBranch} not found`);
  }

  // Crear la nueva rama
  const { data } = await octokit.git.createRef({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: `refs/heads/${newBranch}`,
    sha: baseBranch.sha,
  });

  return {
    name: newBranch,
    sha: data.object.sha,
  };
}

/**
 * Crea un Pull Request
 */
export async function createPullRequest(
  title: string,
  head: string,
  base: string = 'main',
  body?: string
): Promise<PullRequestInfo> {
  const { data } = await octokit.pulls.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title,
    head,
    base,
    body,
  });

  return {
    number: data.number,
    title: data.title,
    html_url: data.html_url,
  };
}

/**
 * Lista los archivos modificados en una rama comparada con otra
 */
export async function compareCommits(base: string, head: string) {
  const { data } = await octokit.repos.compareCommits({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    base,
    head,
  });

  return data.files || [];
}

/**
 * Crea un issue en el repositorio
 */
export async function createIssue(title: string, body?: string, labels?: string[]) {
  const { data } = await octokit.issues.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title,
    body,
    labels,
  });

  return data;
}

/**
 * Lista los issues abiertos del repositorio
 */
export async function listOpenIssues() {
  const { data } = await octokit.issues.listForRepo({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    state: 'open',
  });

  return data;
}

/**
 * Obtiene el contenido de múltiples archivos de un directorio
 */
export async function getDirectoryContents(path: string, ref?: string) {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path,
    ref,
  });

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}
