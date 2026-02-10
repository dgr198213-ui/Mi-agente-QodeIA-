-- SUPABASE_MIGRATION.sql
-- Migración para la integración CME y mejoras del Agente QodeIA

-- FASE 1: Crear tablas faltantes
-- Tabla de Conversaciones
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID DEFAULT auth.uid()
);

-- FASE 2: Actualizar tabla messages
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='messages' AND COLUMN_NAME='project_id') THEN
        ALTER TABLE public.messages ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='messages' AND COLUMN_NAME='conversation_id') THEN
        ALTER TABLE public.messages ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON public.messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- FASE 3: Actualizar memory_vectors
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='memory_vectors' AND COLUMN_NAME='project_id') THEN
        ALTER TABLE public.memory_vectors ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memory_vectors_project_id ON public.memory_vectors(project_id);

-- FASE 4: Mejorar agent_state
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='agent_state' AND COLUMN_NAME='project_id') THEN
        ALTER TABLE public.agent_state ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_state_project_id ON public.agent_state(project_id);

-- FASE 5: Crear tabla cme_sync_state
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

CREATE INDEX IF NOT EXISTS idx_cme_sync_project_id ON public.cme_sync_state(project_id);

-- FASE 6: Crear tabla usage_stats
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

CREATE INDEX IF NOT EXISTS idx_usage_stats_project_id ON public.usage_stats(project_id);

-- FASE 7: Crear funciones RPC
-- Función para obtener el contexto completo del proyecto
CREATE OR REPLACE FUNCTION public.get_project_context(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'project', (SELECT row_to_json(p) FROM public.projects p WHERE p.id = p_project_id),
        'memory', (SELECT row_to_json(m) FROM public.context_memory m WHERE m.project_id = p_project_id),
        'recent_messages', (SELECT jsonb_agg(msg) FROM (SELECT * FROM public.messages WHERE project_id = p_project_id ORDER BY created_at DESC LIMIT 10) msg),
        'sync_state', (SELECT row_to_json(s) FROM public.cme_sync_state s WHERE s.project_id = p_project_id ORDER BY created_at DESC LIMIT 1)
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas del proyecto
CREATE OR REPLACE FUNCTION public.get_project_stats(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_tokens', (SELECT COALESCE(SUM(token_usage), 0) FROM public.usage_stats WHERE project_id = p_project_id),
        'total_api_calls', (SELECT COALESCE(SUM(api_calls), 0) FROM public.usage_stats WHERE project_id = p_project_id),
        'message_count', (SELECT COUNT(*) FROM public.messages WHERE project_id = p_project_id)
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- FASE 8: Habilitar RLS (Opcional - Se incluyen las políticas básicas)
-- ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.cme_sync_state ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

-- Ejemplo de política para conversations (comentada)
-- CREATE POLICY "Users can view their own conversations" ON public.conversations
--     FOR SELECT USING (auth.uid() = user_id);

SELECT 'Migración de Supabase completada exitosamente.' as status;
