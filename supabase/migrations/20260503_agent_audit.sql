-- Tabla para auditoría de tareas delegadas por el CEO
CREATE TABLE IF NOT EXISTS public.agent_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    specialist TEXT NOT NULL,
    task_description TEXT NOT NULL,
    result_summary TEXT,
    execution_time INTEGER, -- en ms
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.agent_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios vean sus propios logs (basado en session_id o user_id si se añade)
CREATE POLICY "Usuarios pueden ver sus propios logs de auditoría"
    ON public.agent_audit_logs FOR SELECT
    USING (true); -- Simplificado para MVP, en prod filtrar por user_id

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_audit_session_id ON public.agent_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.agent_audit_logs(created_at DESC);
