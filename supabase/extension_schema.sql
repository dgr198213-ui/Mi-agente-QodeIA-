-- =============================================================================
-- EXTENSIÓN DEL SCHEMA - Tablas Faltantes para QodeIA
-- Complementa master_schema.sql con tablas de comunidad y recursos
-- =============================================================================

-- =============================================================================
-- SECCIÓN 1: TABLAS DE COMUNIDAD
-- =============================================================================

-- 1.1 Tabla de Perfiles de Builders
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    github_username TEXT,
    twitter_handle TEXT,
    website_url TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver perfiles públicos" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.profiles;

CREATE POLICY "Usuarios pueden ver perfiles públicos"
    ON public.profiles FOR SELECT
    USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Usuarios pueden ver su propio perfil"
    ON public.profiles FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar su propio perfil"
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON public.profiles(is_public);

-- =============================================================================
-- SECCIÓN 2: TABLAS DE RECURSOS
-- =============================================================================

-- 2.1 Tabla de Recursos (Guías, Tutoriales, Snippets)
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('guide', 'tutorial', 'snippet', 'template')),
    category TEXT DEFAULT 'general',
    tags JSONB DEFAULT '[]'::jsonb,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver recursos publicados" ON public.resources;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios recursos" ON public.resources;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear recursos" ON public.resources;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propios recursos" ON public.resources;

CREATE POLICY "Usuarios pueden ver recursos publicados"
    ON public.resources FOR SELECT
    USING (is_published = true OR auth.uid() = author_id);

CREATE POLICY "Usuarios pueden ver sus propios recursos"
    ON public.resources FOR SELECT TO authenticated
    USING (auth.uid() = author_id);

CREATE POLICY "Usuarios autenticados pueden crear recursos"
    ON public.resources FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Usuarios pueden actualizar sus propios recursos"
    ON public.resources FOR UPDATE TO authenticated
    USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_resources_author_id ON public.resources(author_id);
CREATE INDEX IF NOT EXISTS idx_resources_is_published ON public.resources(is_published);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type ON public.resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at DESC);

-- 2.2 Tabla de Snippets (Código Compartido)
CREATE TABLE IF NOT EXISTS public.snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    language TEXT DEFAULT 'typescript',
    tags JSONB DEFAULT '[]'::jsonb,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    fork_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver snippets públicos" ON public.snippets;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios snippets" ON public.snippets;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear snippets" ON public.snippets;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propios snippets" ON public.snippets;

CREATE POLICY "Usuarios pueden ver snippets públicos"
    ON public.snippets FOR SELECT
    USING (is_public = true OR auth.uid() = author_id);

CREATE POLICY "Usuarios pueden ver sus propios snippets"
    ON public.snippets FOR SELECT TO authenticated
    USING (auth.uid() = author_id);

CREATE POLICY "Usuarios autenticados pueden crear snippets"
    ON public.snippets FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Usuarios pueden actualizar sus propios snippets"
    ON public.snippets FOR UPDATE TO authenticated
    USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_snippets_author_id ON public.snippets(author_id);
CREATE INDEX IF NOT EXISTS idx_snippets_is_public ON public.snippets(is_public);
CREATE INDEX IF NOT EXISTS idx_snippets_language ON public.snippets(language);
CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON public.snippets(created_at DESC);

-- =============================================================================
-- SECCIÓN 3: TABLAS DE INTERACCIÓN COMUNITARIA
-- =============================================================================

-- 3.1 Tabla de Comentarios
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver comentarios" ON public.comments;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear comentarios" ON public.comments;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propios comentarios" ON public.comments;

CREATE POLICY "Usuarios pueden ver comentarios"
    ON public.comments FOR SELECT
    USING (true);

CREATE POLICY "Usuarios autenticados pueden crear comentarios"
    ON public.comments FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Usuarios pueden actualizar sus propios comentarios"
    ON public.comments FOR UPDATE TO authenticated
    USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE INDEX IF NOT EXISTS idx_comments_resource_id ON public.comments(resource_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);

-- 3.2 Tabla de Likes/Favoritos
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, resource_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver likes" ON public.likes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear likes" ON public.likes;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios likes" ON public.likes;

CREATE POLICY "Usuarios pueden ver likes"
    ON public.likes FOR SELECT
    USING (true);

CREATE POLICY "Usuarios autenticados pueden crear likes"
    ON public.likes FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar sus propios likes"
    ON public.likes FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_resource_id ON public.likes(resource_id);

-- =============================================================================
-- SECCIÓN 4: FUNCIONES RPC ADICIONALES
-- =============================================================================

-- 4.1 Función para obtener recursos populares
CREATE OR REPLACE FUNCTION public.get_popular_resources(
    p_limit INT DEFAULT 10,
    p_resource_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    resource_type TEXT,
    author_id UUID,
    view_count INTEGER,
    like_count INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.title,
        r.description,
        r.resource_type,
        r.author_id,
        r.view_count,
        r.like_count,
        r.created_at
    FROM public.resources r
    WHERE r.is_published = true
        AND (p_resource_type IS NULL OR r.resource_type = p_resource_type)
    ORDER BY r.view_count DESC, r.like_count DESC
    LIMIT p_limit;
END;
$$;

-- 4.2 Función para incrementar view count
CREATE OR REPLACE FUNCTION public.increment_resource_views(p_resource_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.resources
    SET view_count = view_count + 1
    WHERE id = p_resource_id;
END;
$$;

-- 4.3 Función para obtener perfiles de builders activos
CREATE OR REPLACE FUNCTION public.get_active_builders(p_limit INT DEFAULT 10)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    github_username TEXT,
    skills JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.display_name,
        p.bio,
        p.avatar_url,
        p.github_username,
        p.skills
    FROM public.profiles p
    WHERE p.is_public = true
    ORDER BY p.updated_at DESC
    LIMIT p_limit;
END;
$$;

-- =============================================================================
-- MENSAJE FINAL
-- =============================================================================
SELECT 'Extensión del schema de QodeIA aplicada exitosamente.' AS status;
