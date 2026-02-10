-- ============================================
-- QODEIA - SUPABASE SCHEMA
-- ============================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- TABLAS PRINCIPALES
-- ============================================

-- Proyectos
CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);

-- Sesiones del agente
CREATE TABLE agent_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    metadata jsonb DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_session CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX idx_sessions_user ON agent_sessions(user_id);
CREATE INDEX idx_sessions_project ON agent_sessions(project_id);
CREATE INDEX idx_sessions_active ON agent_sessions(id) WHERE ended_at IS NULL;

-- Permisos por sesión
CREATE TYPE permission_action AS ENUM (
    'plan:create', 
    'plan:read', 
    'exec:create', 
    'exec:read', 
    'memory:write', 
    'memory:read'
);

CREATE TABLE session_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    action permission_action NOT NULL,
    granted_at timestamptz DEFAULT now(),
    
    UNIQUE(session_id, action)
);

CREATE INDEX idx_session_permissions ON session_permissions(session_id);

-- Planes del agente
CREATE TABLE agent_plans (
    plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    goal text NOT NULL,
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    estimated_risk text CHECK (estimated_risk IN ('low', 'medium', 'high')),
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_plans_session ON agent_plans(session_id);
CREATE INDEX idx_plans_created_at ON agent_plans(created_at DESC);

-- Ejecuciones
CREATE TYPE execution_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE agent_executions (
    execution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES agent_plans(plan_id) ON DELETE CASCADE,
    status execution_status NOT NULL DEFAULT 'pending',
    mode text NOT NULL CHECK (mode IN ('dry-run', 'apply')),
    result jsonb,
    error text,
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    
    CONSTRAINT valid_execution CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_executions_plan ON agent_executions(plan_id);
CREATE INDEX idx_executions_status ON agent_executions(status);
CREATE INDEX idx_executions_started ON agent_executions(started_at DESC);

-- Memoria del agente
CREATE TYPE memory_type AS ENUM ('decision', 'fact', 'rule', 'note', 'error', 'success');

CREATE TABLE agent_memory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type memory_type NOT NULL,
    content text NOT NULL,
    tags text[] DEFAULT '{}',
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id uuid REFERENCES agent_sessions(id) ON DELETE SET NULL,
    embedding_status text DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
    timestamp timestamptz DEFAULT now()
);

CREATE INDEX idx_memory_project ON agent_memory(project_id);
CREATE INDEX idx_memory_type ON agent_memory(type);
CREATE INDEX idx_memory_tags ON agent_memory USING GIN(tags);
CREATE INDEX idx_memory_embedding_status ON agent_memory(embedding_status) WHERE embedding_status = 'pending';

-- Vectores de memoria
CREATE TABLE agent_memory_vectors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id uuid NOT NULL REFERENCES agent_memory(id) ON DELETE CASCADE,
    vector vector(1536) NOT NULL,
    created_at timestamptz DEFAULT now(),
    
    UNIQUE(memory_id)
);

CREATE INDEX idx_memory_vectors_hnsw ON agent_memory_vectors 
    USING hnsw (vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Logs del agente
CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

CREATE TABLE agent_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
    execution_id uuid REFERENCES agent_executions(execution_id) ON DELETE CASCADE,
    level log_level NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    trace_id uuid,
    timestamp timestamptz DEFAULT now()
);

CREATE INDEX idx_logs_session ON agent_logs(session_id);
CREATE INDEX idx_logs_execution ON agent_logs(execution_id);
CREATE INDEX idx_logs_level ON agent_logs(level);
CREATE INDEX idx_logs_timestamp ON agent_logs(timestamp DESC);
CREATE INDEX idx_logs_trace ON agent_logs(trace_id);

-- Rate limiting
CREATE TABLE rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    count int NOT NULL DEFAULT 1,
    window_start timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, action, window_start)
);

CREATE INDEX idx_rate_limits_user_action ON rate_limits(user_id, action);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- ============================================
-- FUNCIONES
-- ============================================

-- Búsqueda semántica de memoria
CREATE OR REPLACE FUNCTION search_memory(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_project uuid DEFAULT NULL,
    filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
    memory_id uuid,
    content text,
    type memory_type,
    tags text[],
    similarity float,
    timestamp timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        am.id,
        am.content,
        am.type,
        am.tags,
        1 - (amv.vector <=> query_embedding) as similarity,
        am.timestamp
    FROM agent_memory_vectors amv
    JOIN agent_memory am ON am.id = amv.memory_id
    WHERE 
        (filter_project IS NULL OR am.project_id = filter_project)
        AND (filter_tags IS NULL OR am.tags && filter_tags)
        AND am.embedding_status = 'completed'
        AND 1 - (amv.vector <=> query_embedding) > match_threshold
    ORDER BY amv.vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id uuid,
    p_action text,
    p_max_requests int DEFAULT 10,
    p_window_minutes int DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_count int;
    v_window_start timestamptz;
BEGIN
    v_window_start := date_trunc('minute', now()) - (p_window_minutes || ' minutes')::interval;
    
    DELETE FROM rate_limits WHERE window_start < v_window_start;
    
    SELECT COALESCE(SUM(count), 0) INTO v_count
    FROM rate_limits
    WHERE user_id = p_user_id 
        AND action = p_action
        AND window_start >= v_window_start;
    
    IF v_count < p_max_requests THEN
        INSERT INTO rate_limits (user_id, action, window_start)
        VALUES (p_user_id, p_action, date_trunc('minute', now()))
        ON CONFLICT (user_id, action, window_start) 
        DO UPDATE SET count = rate_limits.count + 1;
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Crear sesión con permisos
CREATE OR REPLACE FUNCTION create_agent_session(
    p_user_id uuid,
    p_project_id uuid,
    p_permissions permission_action[] DEFAULT ARRAY['plan:create', 'plan:read', 'exec:create', 'exec:read', 'memory:read']::permission_action[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id uuid;
    v_permission permission_action;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM projects 
        WHERE id = p_project_id AND owner_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User does not own this project';
    END IF;
    
    INSERT INTO agent_sessions (user_id, project_id)
    VALUES (p_user_id, p_project_id)
    RETURNING id INTO v_session_id;
    
    FOREACH v_permission IN ARRAY p_permissions
    LOOP
        INSERT INTO session_permissions (session_id, action)
        VALUES (v_session_id, v_permission);
    END LOOP;
    
    RETURN v_session_id;
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE POLICY "users_crud_own_projects" ON projects
    FOR ALL USING (auth.uid() = owner_id);

-- Sessions
CREATE POLICY "users_create_sessions" ON agent_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_sessions" ON agent_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_sessions" ON agent_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Permissions
CREATE POLICY "users_read_session_permissions" ON session_permissions
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM agent_sessions WHERE user_id = auth.uid()
        )
    );

-- Plans
CREATE POLICY "service_writes_plans" ON agent_plans
    FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_plans" ON agent_plans
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM agent_sessions WHERE user_id = auth.uid()
        )
    );

-- Executions
CREATE POLICY "service_manages_executions" ON agent_executions
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_executions" ON agent_executions
    FOR SELECT USING (
        plan_id IN (
            SELECT plan_id FROM agent_plans 
            WHERE session_id IN (
                SELECT id FROM agent_sessions WHERE user_id = auth.uid()
            )
        )
    );

-- Memory
CREATE POLICY "service_writes_memory" ON agent_memory
    FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_project_memory" ON agent_memory
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        )
    );

-- Vectors
CREATE POLICY "service_manages_vectors" ON agent_memory_vectors
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_vectors" ON agent_memory_vectors
    FOR SELECT USING (
        memory_id IN (
            SELECT id FROM agent_memory 
            WHERE project_id IN (
                SELECT id FROM projects WHERE owner_id = auth.uid()
            )
        )
    );

-- Logs
CREATE POLICY "service_writes_logs" ON agent_logs
    FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "users_read_session_logs" ON agent_logs
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM agent_sessions WHERE user_id = auth.uid()
        )
    );
