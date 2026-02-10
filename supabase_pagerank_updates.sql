-- supabase_pagerank_updates.sql
-- Actualizaciones para el sistema de Gobernanza PageRank

-- Función para incremento atómico de transiciones por contexto
CREATE OR REPLACE FUNCTION public.increment_transition_ctx(
    p_from_node UUID,
    p_to_node UUID,
    p_context_id UUID,
    p_increment DOUBLE PRECISION DEFAULT 1.0
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.agent_transitions_ctx (from_node, to_node, context_id, weight)
    VALUES (p_from_node, p_to_node, p_context_id, p_increment)
    ON CONFLICT (from_node, to_node, context_id)
    DO UPDATE SET weight = public.agent_transitions_ctx.weight + p_increment;
END;
$$;

-- Función para incremento atómico de transiciones globales
CREATE OR REPLACE FUNCTION public.increment_transition_global(
    p_from_node UUID,
    p_to_node UUID,
    p_increment DOUBLE PRECISION DEFAULT 1.0
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.agent_transitions (from_node, to_node, weight)
    VALUES (p_from_node, p_to_node, p_increment)
    ON CONFLICT (from_node, to_node)
    DO UPDATE SET weight = public.agent_transitions.weight + p_increment;
END;
$$;

-- Tabla de auditoría para gobernanza
CREATE TABLE IF NOT EXISTS public.agent_governance_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_id UUID,
    context_id UUID REFERENCES public.agent_contexts(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_governance_audit_user ON public.agent_governance_audit(user_id);
