-- Esquema SQL para el sistema de Gobernanza PageRank en Mi-agente-QodeIA

-- 1. Tabla de nodos gobernados
-- Almacena herramientas, memorias, tareas y agentes con su score global.
CREATE TABLE IF NOT EXISTS public.agent_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_type TEXT NOT NULL CHECK (node_type IN ('tool', 'memory', 'task', 'agent')),
    node_key TEXT NOT NULL UNIQUE, -- ej: github.createPullRequest
    rank_score DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_nodes_node_type ON public.agent_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_agent_nodes_rank_score ON public.agent_nodes(rank_score DESC);

-- 2. Tabla de transiciones globales (Matriz M)
CREATE TABLE IF NOT EXISTS public.agent_transitions (
    from_node UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    to_node UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    weight DOUBLE PRECISION DEFAULT 1,
    PRIMARY KEY (from_node, to_node)
);

-- 3. Tabla de contextos
CREATE TABLE IF NOT EXISTS public.agent_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar contextos básicos
INSERT INTO public.agent_contexts (name, description) VALUES
('code', 'Edición y lectura de repositorios'),
('debug', 'Resolución de errores y fallos de build'),
('deploy', 'Gestión de despliegues y Vercel'),
('db', 'Operaciones de base de datos y Supabase'),
('docs', 'Consulta y gestión de documentación (MCP)'),
('planning', 'Diseño y planificación de arquitectura')
ON CONFLICT (name) DO NOTHING;

-- 4. Rank por contexto (Vector R_c)
CREATE TABLE IF NOT EXISTS public.agent_node_ranks (
    node_id UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    context_id UUID REFERENCES public.agent_contexts(id) ON DELETE CASCADE,
    rank_score DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (node_id, context_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_node_ranks_context ON public.agent_node_ranks(context_id);
CREATE INDEX IF NOT EXISTS idx_agent_node_ranks_score ON public.agent_node_ranks(rank_score DESC);

-- 5. Transiciones por contexto (Matriz M_c)
CREATE TABLE IF NOT EXISTS public.agent_transitions_ctx (
    from_node UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    to_node UUID REFERENCES public.agent_nodes(id) ON DELETE CASCADE,
    context_id UUID REFERENCES public.agent_contexts(id) ON DELETE CASCADE,
    weight DOUBLE PRECISION DEFAULT 1,
    PRIMARY KEY (from_node, to_node, context_id)
);

-- 6. Configuración de gobernanza
CREATE TABLE IF NOT EXISTS public.agent_governance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    damping_factor DOUBLE PRECISION DEFAULT 0.85,
    last_run TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Gobernanza por contexto
CREATE TABLE IF NOT EXISTS public.agent_governance_ctx (
    context_id UUID REFERENCES public.agent_contexts(id) ON DELETE CASCADE,
    damping_factor DOUBLE PRECISION DEFAULT 0.85,
    last_run TIMESTAMPTZ,
    PRIMARY KEY (context_id)
);

-- 8. Función para búsqueda de memoria híbrida (Similarity + PageRank)
-- Esta función combina la similitud semántica con el rank estructural.
CREATE OR REPLACE FUNCTION match_memory_vectors_ranked (
    query_embedding VECTOR(1536),
    match_threshold FLOAT,
    match_count INT,
    target_context_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    rank_score DOUBLE PRECISION,
    combined_score DOUBLE PRECISION,
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
        COALESCE(
            CASE
                WHEN target_context_name IS NOT NULL THEN
                    (SELECT r.rank_score FROM public.agent_node_ranks r
                     JOIN public.agent_contexts c ON c.id = r.context_id
                     WHERE r.node_id = n.id AND c.name = target_context_name)
                ELSE n.rank_score
            END,
            0.1 -- Score por defecto si no hay rank
        ) AS rank_score,
        ((1 - (mv.embedding <=> query_embedding)) *
         COALESCE(
            CASE
                WHEN target_context_name IS NOT NULL THEN
                    (SELECT r.rank_score FROM public.agent_node_ranks r
                     JOIN public.agent_contexts c ON c.id = r.context_id
                     WHERE r.node_id = n.id AND c.name = target_context_name)
                ELSE n.rank_score
            END,
            0.1
         )) AS combined_score,
        mv.created_at
    FROM
        public.memory_vectors AS mv
    LEFT JOIN
        public.agent_nodes AS n ON n.node_key = mv.id::text
    WHERE
        1 - (mv.embedding <=> query_embedding) > match_threshold
    ORDER BY
        combined_score DESC
    LIMIT
        match_count;
END;
$$;

-- Mensaje final
SELECT 'Esquema de Gobernanza PageRank creado exitosamente.' as status;
