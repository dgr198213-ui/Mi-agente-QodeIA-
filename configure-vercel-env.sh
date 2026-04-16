#!/bin/bash
# Script para configurar variables de entorno en Vercel para Mi Agente QodeIA
# Ejecutar desde el directorio del proyecto: ./configure-vercel-env.sh
#
# IMPORTANTE: Este script NO contiene valores de credenciales hardcodeados.
# Las claves sensibles deben exportarse como variables de entorno antes de ejecutar:
#   export NEXT_PUBLIC_SUPABASE_ANON_KEY="tu_clave_aqui"
#   export HOWARD_OS_SUPABASE_KEY="tu_clave_aqui"
#   ./configure-vercel-env.sh

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
  
  if [ -z "$value" ] || [[ "$value" == "<"* ]]; then
    echo "⚠️  Saltando $key (valor no configurado - define la variable de entorno o configura manualmente en Vercel)"
    return
  fi

  echo "📝 Añadiendo $key..."
  
  for env in $env_type; do
    # Usar printf en lugar de echo para evitar saltos de línea accidentales en el token
    printf '%s' "$value" | vercel env add "$key" "$env" --yes 2>/dev/null || echo "  ⚠️  $key ya existe en $env"
  done
}

# Supabase Operativa (Agente QodeIA)
# Los valores se leen desde variables de entorno del sistema (NO hardcodear aquí)
add_env "NEXT_PUBLIC_SUPABASE_URL" "${NEXT_PUBLIC_SUPABASE_URL:-https://nknevqndawnokiaickkl.supabase.co}"
add_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-<TU_SUPABASE_ANON_KEY>}"

# Supabase Howard OS (Base de Conocimiento)
add_env "HOWARD_OS_SUPABASE_URL" "${HOWARD_OS_SUPABASE_URL:-https://tztypjxqklxygfzbpkmm.supabase.co}"
add_env "HOWARD_OS_SUPABASE_KEY" "${HOWARD_OS_SUPABASE_KEY:-<TU_HOWARD_OS_SUPABASE_KEY>}"

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
echo "   - VERCEL_TOKEN (tu token de Vercel - CRÍTICO: copiar sin saltos de línea)"
echo "   - HOWARD_OS_NOTEBOOK_URL (URL del notebook de Howard OS en NotebookLM)"
echo "   - SOLUCIONES_NOTEBOOK_URL (URL del notebook de Soluciones en NotebookLM)"
echo "   - NOTEBOOKLM_COOKIE (cookie de autenticación de NotebookLM)"
echo ""
echo "⚠️  NOTA CRÍTICA sobre VERCEL_TOKEN:"
echo "   Al copiar el token desde el panel de Vercel, asegúrate de que NO contenga"
echo "   saltos de línea. Error conocido: 'Must not contain: \\n'"
echo ""
echo "🔄 Para aplicar los cambios, ejecuta:"
echo "   vercel --prod"
