-- Esquema SQL para la base de datos del Agente Autónomo en Supabase

-- 1. Habilitar la extensión pgvector
-- Asegúrate de que la extensión `vector` esté habilitada en tu proyecto de Supabase.
-- Puedes hacerlo desde el panel de control de Supabase en "Database" -> "Extensions".
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla de Mensajes (Memoria de Conversación)
-- Almacena el historial de interacciones entre el usuario y el agente.
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
        'user',
        'assistant',
        'system'
    )),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para la tabla de mensajes
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- 3. Tabla de Estado del Agente
-- Almacena el estado persistente del agente (contadores, configuración, etc.).
CREATE TABLE IF NOT EXISTS public.agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para la tabla de estado del agente
CREATE INDEX IF NOT EXISTS idx_agent_state_key ON public.agent_state(key);

-- 4. Tabla de Tareas
-- Sistema de gestión de tareas para el agente.
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in_progress',
        'completed',
        'failed'
    )),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Índices para la tabla de tareas
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at ASC);

-- 5. Tabla de Memoria Vectorial (Memoria a Largo Plazo)
-- Almacena embeddings para búsqueda semántica.
CREATE TABLE IF NOT EXISTS public.memory_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL, -- Usar 1536 para text-embedding-3-small
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para la tabla de memoria vectorial
-- Índice IVFFlat para búsqueda aproximada de vecinos más cercanos (ANN)
-- El número de listas (lists) debe ser aproximadamente sqrt(N) donde N es el número de filas
-- Para empezar, 100 es un buen número.
CREATE INDEX IF NOT EXISTS idx_memory_vectors_embedding ON public.memory_vectors USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- 6. Función de Búsqueda de Similitud
-- Función RPC para buscar en la memoria vectorial.
CREATE OR REPLACE FUNCTION match_memory_vectors (
    query_embedding VECTOR(1536),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
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
        1 - (mv.embedding <=> query_embedding) > match_threshold
    ORDER BY
        similarity DESC
    LIMIT
        match_count;
END;
$$;

-- 7. Políticas de Seguridad (Row Level Security - RLS)
-- Por defecto, las tablas deben estar protegidas. Aquí se muestra cómo habilitar RLS
-- y crear políticas. Descomenta y ajusta según tus necesidades de autenticación.

-- Habilitar RLS en las tablas
-- ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.memory_vectors ENABLE ROW LEVEL SECURITY;

-- Políticas de ejemplo (requiere autenticación de usuarios de Supabase)
-- CREATE POLICY "Allow full access to own messages" ON public.messages
-- FOR ALL USING (auth.uid() = (metadata->>'user_id')::uuid);

-- CREATE POLICY "Allow service_role to bypass RLS" ON public.messages
-- FOR ALL USING (current_setting('request.role', true) = 'service_role');

-- Repite políticas similares para las otras tablas si es necesario.

-- Mensaje final
SELECT 'Esquema de base de datos para el agente autónomo creado exitosamente.' as status;
