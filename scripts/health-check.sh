#!/bin/bash
set -e

SERVICES=(
  "https://agent.qodeia.ai/health|Agent"
  "https://web.qodeia.ai|Web"
  "https://ide.qodeia.ai|IDE"
)

echo "🏥 Running health checks..."

for service in "${SERVICES[@]}"; do
  IFS='|' read -r url name <<< "$service"
  echo -n "Checking $name... "
  if curl -sf "$url" > /dev/null 2>&1; then
    echo "✅ OK"
  else
    echo "❌ DOWN"
  fi
done
