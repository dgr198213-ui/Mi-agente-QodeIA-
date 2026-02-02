-- Script de Actualización para MCP y Ecosistema QodeIA
-- Este script añade las tablas y estructuras necesarias para la integración avanzada.

-- 1. Tabla de Soluciones del Agente (agent_solutions)
-- Almacena soluciones validadas que luego se sincronizan con NotebookLM.
CREATE TABLE IF NOT EXISTS public.agent_solutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_signature TEXT NOT NULL UNIQUE,
    solution_steps JSONB NOT NULL,
    context JSONB,
    success_count INTEGER DEFAULT 1,
    last_used TIMESTAMPTZ DEFAULT now(),
    synced_to_notebooklm BOOLEAN DEFAULT false,
    notebooklm_source_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_solutions_signature ON public.agent_solutions(error_signature);
CREATE INDEX IF NOT EXISTS idx_agent_solutions_synced ON public.agent_solutions(synced_to_notebooklm);

-- 2. Tabla de Proyectos (projects)
-- Almacena la configuración de los proyectos gestionados por el agente.
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    repository_url TEXT,
    user_id UUID, -- Referencia a auth.users(id) si se usa RLS
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- 3. Tabla de Memoria de Contexto (context_memory)
-- Almacena snapshots de la estructura y contexto de los proyectos.
CREATE TABLE IF NOT EXISTS public.context_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    files_count INTEGER,
    token_estimate INTEGER,
    semantic_index JSONB,
    compressed_context TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_memory_project_id ON public.context_memory(project_id);

-- 4. Asegurar que agent_state tenga los campos necesarios para OAuth
-- (La tabla ya existe, pero nos aseguramos de que el uso sea consistente)
-- Las claves usadas serán: 'mcp_config', 'mcp_enabled', 'oauth_state_<uuid>'

-- 5. Función para actualizar el timestamp de updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a la tabla projects
DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Mensaje de confirmación
SELECT 'Actualización de esquema para MCP completada exitosamente.' as status;
