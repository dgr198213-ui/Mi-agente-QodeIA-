-- Persistent error and warning logs from the agent
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  context TEXT,
  metadata JSONB,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries comunes
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_context ON error_logs(context) WHERE context IS NOT NULL;

-- Auto-limpieza de logs antiguos (mantener solo últimos 30 días)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON TABLE error_logs IS 'Persistent error and warning logs from the agent';
COMMENT ON COLUMN error_logs.context IS 'Execution context (e.g., "agent_execution", "mcp_call")';
COMMENT ON COLUMN error_logs.metadata IS 'Additional structured data (project_id, user_id, etc.)';
COMMENT ON COLUMN error_logs.error_details IS 'Error object with message, stack, and name';
