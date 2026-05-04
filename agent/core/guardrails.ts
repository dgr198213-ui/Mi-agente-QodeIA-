/**
 * Guardrails de Seguridad para el Agente QodeIA
 *
 * Este módulo implementa guardrails para prevenir operaciones destructivas
 * o peligrosas sin aprobación humana explícita.
 */

export interface ApprovalRequest {
  id: string;
  operation: string;
  payload: any;
  requestedAt: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
  resolvedBy?: string;
}

// Operaciones consideradas peligrosas
const DANGEROUS_OPERATIONS = [
  'deleteRepository',
  'deleteRepo',
  'forcePush',
  'forcePushToMain',
  'deleteBranch',
  'deleteBranch:main',
  'deleteBranch:master',
  'deleteFile',
  'deleteCriticalFile',
  'dropDatabase',
  'deleteDatabase',
  'deleteAllTables',
  'disableAuth',
  'removeAdminAccess',
  'forceMergePR',
  'closePRWithoutMerge',
  'revokeTokens',
  'deleteSecrets',
] as const;

export type DangerousOperation = typeof DANGEROUS_OPERATIONS[number];

export interface GuardrailConfig {
  enableGuardrails: boolean;
  requireApprovalForDangerousOps: boolean;
  notifyOnDangerousOps: boolean;
  approvalChannel?: 'slack' | 'discord' | 'email' | 'console';
}

const DEFAULT_CONFIG: GuardrailConfig = {
  enableGuardrails: true,
  requireApprovalForDangerousOps: true,
  notifyOnDangerousOps: true,
};

/**
 * Verifica si una operación es peligrosa
 */
export function isDangerousOperation(operation: string): operation is DangerousOperation {
  return DANGEROUS_OPERATIONS.includes(operation as DangerousOperation);
}

/**
 * Verifica si la operación requiere aprobación
 */
export function requiresApproval(
  operation: string,
  config: GuardrailConfig = DEFAULT_CONFIG
): boolean {
  if (!config.enableGuardrails) return false;
  if (!config.requireApprovalForDangerousOps) return false;
  return isDangerousOperation(operation);
}

/**
 * Registra una solicitud de aprobación pendiente
 */
const pendingApprovals: Map<string, ApprovalRequest> = new Map();

export async function createApprovalRequest(
  operation: string,
  payload: any,
  requestedBy: string = 'agent'
): Promise<ApprovalRequest> {
  const request: ApprovalRequest = {
    id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    operation,
    payload,
    requestedAt: new Date().toISOString(),
    requestedBy,
    status: 'pending',
  };

  pendingApprovals.set(request.id, request);

  console.log(JSON.stringify({
    level: 'warning',
    module: 'agent-guardrails',
    message: `Solicitud de aprobación requerida para operación peligrosa: ${operation}`,
    requestId: request.id,
    timestamp: new Date().toISOString()
  }));

  return request;
}

/**
 * Espera aprobación humana (bloqueante)
 * En producción, esto se conectaría a Slack/Discord/Email
 */
export async function waitForHumanApproval(
  requestId: string,
  timeoutMs: number = 600000 // 10 minutos
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const request = pendingApprovals.get(requestId);

    if (!request) {
      throw new Error(`Solicitud ${requestId} no encontrada`);
    }

    if (request.status === 'approved') {
      pendingApprovals.delete(requestId);
      return true;
    }

    if (request.status === 'rejected') {
      pendingApprovals.delete(requestId);
      return false;
    }

    // Esperar 1 segundo antes de volver a verificar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Timeout esperando aprobación para ${requestId}`);
}

/**
 * Aprueba una solicitud
 */
export async function approveRequest(requestId: string, approvedBy: string): Promise<void> {
  const request = pendingApprovals.get(requestId);
  if (!request) {
    throw new Error(`Solicitud ${requestId} no encontrada`);
  }

  request.status = 'approved';
  request.resolvedAt = new Date().toISOString();
  request.resolvedBy = approvedBy;
}

/**
 * Rechaza una solicitud
 */
export async function rejectRequest(requestId: string, rejectedBy: string): Promise<void> {
  const request = pendingApprovals.get(requestId);
  if (!request) {
    throw new Error(`Solicitud ${requestId} no encontrada`);
  }

  request.status = 'rejected';
  request.resolvedAt = new Date().toISOString();
  request.resolvedBy = rejectedBy;
}

/**
 * Función principal para ejecutar con guardrails
 */
export async function withGuardrails<T>(
  operation: string,
  payload: any,
  executeOperation: () => Promise<T>,
  config: GuardrailConfig = DEFAULT_CONFIG
): Promise<T> {
  if (!requiresApproval(operation, config)) {
    return executeOperation();
  }

  const request = await createApprovalRequest(operation, payload);

  if (config.notifyOnDangerousOps) {
    console.log(JSON.stringify({
      level: 'warning',
      module: 'agent-guardrails',
      message: `⚠️ Operación peligrosa detectada: ${operation}`,
      details: {
        operation,
        payload: sanitizePayload(payload),
        approvalId: request.id,
        timeout: config.requireApprovalForDangerousOps ? '10 minutes' : 'none'
      },
      timestamp: new Date().toISOString()
    }));
  }

  if (config.requireApprovalForDangerousOps) {
    const approved = await waitForHumanApproval(request.id);

    if (!approved) {
      throw new Error(`Operación ${operation} rechazada por el usuario`);
    }
  }

  return executeOperation();
}

/**
 * Sanitiza el payload para no exponer información sensible en logs
 */
function sanitizePayload(payload: any): any {
  if (!payload) return payload;

  const sensitiveKeys = ['token', 'secret', 'password', 'key', 'credential', 'auth'];
  const sanitized = Array.isArray(payload) ? [...payload] : { ...payload };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Ejecutable principal - verifica si una operación es segura
 */
export async function executeWithGuardrails(
  operation: string,
  payload: any,
  execute: () => Promise<any>
): Promise<{ allowed: boolean; result?: any; error?: string }> {
  try {
    if (isDangerousOperation(operation)) {
      return {
        allowed: false,
        error: `Operación peligrosa: ${operation}. Requiere aprobación humana.`
      };
    }

    const result = await execute();
    return { allowed: true, result };
  } catch (error) {
    return {
      allowed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}