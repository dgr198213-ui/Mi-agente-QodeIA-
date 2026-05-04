-- =============================================================================
-- MASTER SCHEMA - Ecosistema QodeIA
-- Fuente única de verdad para el modelo de datos completo.
-- Consolida: supabase_schema.sql, SUPABASE_MIGRATION.sql, supabase_mcp_update.sql
--            y supabase/schema.sql (Plataforma-qd)
--
-- Instrucciones de uso:
--   supabase db push  (desde el directorio raíz del proyecto)
--   o ejecutar manualmente en el SQL Editor del dashboard de Supabase.
--
-- Este script es IDEMPOTENTE: se puede ejecutar múltiples veces sin errores.
-- =============================================================================

-- Habilitar la extensión pgvector para búsqueda semántica
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- SECCIÓN 1: TABLAS DE PLATAFORMA (Howard OS / Plataforma-qd)
-- Origen: Plataforma-qd/supabase/schema.sql
-- =============================================================================

-- 1.1 Tabla de Credenciales del Usuario
CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL,
    name TEXT NOT NULL,
    username TEXT,
    encrypted_value TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    notes TEXT,
    icon TEXT DEFAULT 'Key',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para credentials
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias credenciales" ON public.credentials;
DROP POLICY IF EXISTS "Usuarios pueden insertar sus propias credenciales" ON public.credentials;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propias credenciales" ON public.credentials;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propias credenciales" ON public.credentials;

CREATE POLICY "Usuarios pueden ver sus propias credenciales"
    ON public.credentials FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar sus propias credenciales"
    ON public.credentials FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus propias credenciales"
    ON public.credentials FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar sus propias credenciales"
    ON public.credentials FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 1.2 Tabla de Proyectos
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios proyectos" ON public.projects;
DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios proyectos" ON public.projects;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propios proyectos" ON public.projects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios proyectos" ON public.projects;

CREATE POLICY "Usuarios pueden ver sus propios proyectos"
    ON public.projects FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar sus propios proyectos"
    ON public.projects FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus propios proyectos"
    ON public.projects FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar sus propios proyectos"
    ON public.projects FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- =============================================================================
-- SECCIÓN 2: TABLAS DEL AGENTE (Mi-agente-QodeIA)
-- Origen: supabase_schema.sql
-- =============================================================================

-- 2.1 Tabla de Memoria Vectorial
CREATE TABLE IF NOT EXISTS public.memory_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.memory_vectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Servicio puede gestionar memoria vectorial" ON public.memory_vectors;
CREATE POLICY "Servicio puede gestionar memoria vectorial"
    ON public.memory_vectors FOR ALL
    USING (current_setting('request.role', true) = 'service_role');

-- Índice ivfflat para búsqueda de similitud vectorial
-- Ajustar 'lists' según el volumen de datos: sqrt(num_rows) es una buena heurística
CREATE INDEX IF NOT EXISTS idx_memory_vectors_embedding
    ON public.memory_vectors USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_memory_vectors_project_id ON public.memory_vectors(project_id);

-- 2.2 Tabla de Mensajes
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    conversation_id UUID,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios mensajes" ON public.messages;
DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios mensajes" ON public.messages;

CREATE POLICY "Usuarios pueden ver sus propios mensajes"
    ON public.messages FOR SELECT TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden insertar sus propios mensajes"
    ON public.messages FOR INSERT TO authenticated
    WITH CHECK (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON public.messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- 2.3 Tabla de Estado del Agente
CREATE TABLE IF NOT EXISTS public.agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su propio agent_state" ON public.agent_state;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio agent_state" ON public.agent_state;

CREATE POLICY "Usuarios pueden ver su propio agent_state"
    ON public.agent_state FOR SELECT TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden actualizar su propio agent_state"
    ON public.agent_state FOR ALL TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_agent_state_key ON public.agent_state(key);
CREATE INDEX IF NOT EXISTS idx_agent_state_project_id ON public.agent_state(project_id);

-- 2.4 Tabla de Tareas
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propias tareas" ON public.tasks;
DROP POLICY IF EXISTS "Usuarios pueden gestionar sus propias tareas" ON public.tasks;

CREATE POLICY "Usuarios pueden ver sus propias tareas"
    ON public.tasks FOR SELECT TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden gestionar sus propias tareas"
    ON public.tasks FOR ALL TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at ASC);

-- =============================================================================
-- SECCIÓN 3: TABLAS DE MIGRACIÓN (SUPABASE_MIGRATION.sql)
-- =============================================================================

-- 3.1 Tabla de Conversaciones
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    user_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden gestionar sus conversaciones" ON public.conversations;
CREATE POLICY "Usuarios pueden gestionar sus conversaciones"
    ON public.conversations FOR ALL TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);

-- Agregar columna conversation_id a messages si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'conversation_id'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- 3.2 Tabla de Estado de Sincronización CME
CREATE TABLE IF NOT EXISTS public.cme_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    last_sync TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cme_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su cme_sync_state" ON public.cme_sync_state;
CREATE POLICY "Usuarios pueden ver su cme_sync_state"
    ON public.cme_sync_state FOR ALL TO authenticated
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_cme_sync_project_id ON public.cme_sync_state(project_id);

-- 3.3 Tabla de Estadísticas de Uso
CREATE TABLE IF NOT EXISTS public.usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(),
    token_usage INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    feature_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus usage_stats" ON public.usage_stats;
CREATE POLICY "Usuarios pueden ver sus usage_stats"
    ON public.usage_stats FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_usage_stats_project_id ON public.usage_stats(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON public.usage_stats(user_id);

-- 3.4 Tabla de Logs de Errores
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    context TEXT,
    metadata JSONB,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Solo el service_role puede escribir logs de errores
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo service_role puede gestionar error_logs" ON public.error_logs;
CREATE POLICY "Solo service_role puede gestionar error_logs"
    ON public.error_logs FOR ALL
    USING (current_setting('request.role', true) = 'service_role');

CREATE INDEX IF NOT EXISTS idx_error_logs_level ON public.error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);

-- =============================================================================
-- SECCIÓN 4: TABLAS DE PAGERANK Y GOBERNANZA DEL AGENTE
-- Origen: supabase_mcp_update.sql
-- =============================================================================

-- 4.1 Nodos del grafo PageRank
CREATE TABLE IF NOT EXISTS public.agent_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_key TEXT NOT NULL UNIQUE,
    node_type TEXT NOT NULL DEFAULT 'tool',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.2 Contextos del agente
CREATE TABLE IF NOT EXISTS public.agent_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.3 Transiciones entre nodos (aristas del grafo)
CREATE TABLE IF NOT EXISTS public.agent_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node_id UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    context_id UUID REFERENCES public.agent_contexts(id) ON DELETE CASCADE,
    weight FLOAT NOT NULL DEFAULT 1.0,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(from_node_id, to_node_id, context_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_transitions_from ON public.agent_transitions(from_node_id);
CREATE INDEX IF NOT EXISTS idx_agent_transitions_to ON public.agent_transitions(to_node_id);
CREATE INDEX IF NOT EXISTS idx_agent_transitions_context ON public.agent_transitions(context_id);

-- 4.4 Scores de PageRank por contexto
CREATE TABLE IF NOT EXISTS public.agent_node_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    context_id UUID REFERENCES public.agent_contexts(id) ON DELETE CASCADE,
    rank_score FLOAT NOT NULL DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(node_id, context_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_node_ranks_score ON public.agent_node_ranks(rank_score DESC);

-- =============================================================================
-- SECCIÓN 5: FUNCIONES RPC
-- =============================================================================

-- 5.1 Función de búsqueda de similitud vectorial
CREATE OR REPLACE FUNCTION match_memory_vectors (
    query_embedding VECTOR(1536),
    match_threshold FLOAT,
    match_count INT,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mv.id,
        mv.content,
        mv.metadata,
        1 - (mv.embedding <=> query_embedding) AS similarity,
        mv.created_at
    FROM
        public.memory_vectors AS mv
    WHERE
        (p_project_id IS NULL OR mv.project_id = p_project_id)
        AND 1 - (mv.embedding <=> query_embedding) > match_threshold
    ORDER BY
        similarity DESC
    LIMIT
        match_count;
END;
$$;

-- 5.2 Función para incremento atómico de pesos de transición
CREATE OR REPLACE FUNCTION increment_transition_weight(
    p_from_node_key TEXT,
    p_to_node_key TEXT,
    p_context_name TEXT,
    p_increment FLOAT DEFAULT 1.0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_from_id UUID;
    v_to_id UUID;
    v_context_id UUID;
BEGIN
    SELECT id INTO v_from_id FROM public.agent_nodes WHERE node_key = p_from_node_key;
    SELECT id INTO v_to_id FROM public.agent_nodes WHERE node_key = p_to_node_key;
    SELECT id INTO v_context_id FROM public.agent_contexts WHERE name = p_context_name;

    IF v_from_id IS NULL OR v_to_id IS NULL OR v_context_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.agent_transitions (from_node_id, to_node_id, context_id, weight, count)
    VALUES (v_from_id, v_to_id, v_context_id, p_increment, 1)
    ON CONFLICT (from_node_id, to_node_id, context_id)
    DO UPDATE SET
        weight = agent_transitions.weight + p_increment,
        count = agent_transitions.count + 1,
        updated_at = now();
END;
$$;

-- =============================================================================
-- MENSAJE FINAL
-- =============================================================================
SELECT 'Master schema del ecosistema QodeIA aplicado exitosamente.' AS status;
