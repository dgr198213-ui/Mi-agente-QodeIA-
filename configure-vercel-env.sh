#!/bin/bash
# Script para configurar variables de entorno en Vercel para Mi Agente QodeIA
# Ejecutar desde el directorio del proyecto: ./configure-vercel-env.sh

set -e

PROJECT_NAME="mi-agente-qode-ia"
TEAM_ID="team_JAdXWfQ7CTEn4X65PX7iNJ5E"

echo "🚀 Configurando variables de entorno para $PROJECT_NAME en Vercel..."
echo ""

# Función para añadir variable de entorno
add_env() {
  local key=$1
  local value=$2
  local env_type=${3:-"production preview development"}
  
  echo "📝 Añadiendo $key..."
  
  for env in $env_type; do
    echo "$value" | vercel env add "$key" "$env" --yes 2>/dev/null || echo "  ⚠️  $key ya existe en $env"
  done
}

# Supabase Operativa (Agente QodeIA)
add_env "NEXT_PUBLIC_SUPABASE_URL" "https://nknevqndawnokiaickkl.supabase.co"
add_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rbmV2cW5kYXdub2tpYWlja2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjYwNDYsImV4cCI6MjA4NTM0MjA0Nn0.-bbHiVQFBsThmIOw4DRxAuk1YQbPFrp4FPvWELxjU5M"

# Supabase Howard OS (Base de Conocimiento)
add_env "HOWARD_OS_SUPABASE_URL" "https://tztypjxqklxygfzbpkmm.supabase.co"
add_env "HOWARD_OS_SUPABASE_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6dHlwanhxa2x4eWdmemJwa21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjI5MTAsImV4cCI6MjA4NTAzODkxMH0.3rdL5389_b2evuZclL9pMOarn_Od3vg6Uwj-p--iZc8"

# GitHub
add_env "GITHUB_OWNER" "dgr198213-ui"
add_env "GITHUB_REPO" "Mi-agente-QodeIA-"

# Vercel
add_env "VERCEL_TEAM_ID" "team_JAdXWfQ7CTEn4X65PX7iNJ5E"
add_env "VERCEL_PROJECT_ID" "prj_He7Xk8zyji0mdREOS2IB20H7uKUH"

# URLs del Ecosistema
add_env "NEXT_PUBLIC_HOWARD_OS_URL" "https://plataforma-qd.vercel.app"
add_env "NEXT_PUBLIC_WEB_URL" "https://web-qode-ia.vercel.app"

echo ""
echo "✅ Configuración completada!"
echo ""
echo "⚠️  IMPORTANTE: Las siguientes variables deben ser configuradas manualmente:"
echo "   - SUPABASE_SERVICE_ROLE_KEY (obtener del dashboard de Supabase)"
echo "   - OPENAI_API_KEY (tu API key de OpenAI)"
echo "   - GITHUB_TOKEN (tu token de GitHub)"
echo "   - VERCEL_TOKEN (tu token de Vercel)"
echo "   - HOWARD_OS_NOTEBOOK_URL (URL del notebook de Howard OS en NotebookLM)"
echo "   - SOLUCIONES_NOTEBOOK_URL (URL del notebook de Soluciones en NotebookLM)"
echo "   - NOTEBOOKLM_COOKIE (cookie de autenticación de NotebookLM)"
echo ""
echo "🔄 Para aplicar los cambios, ejecuta:"
echo "   vercel --prod"
