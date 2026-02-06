#!/bin/bash
set -e

echo "🚀 Deploying Agent Service..."

SERVICE_NAME="mi-agente-qodeia"
DOCKER_IMAGE="qodeia/agent:latest"
ENVIRONMENT=${1:-production}

echo "📦 Building Docker image..."
cd mi-agente-qodeia
docker build -t $DOCKER_IMAGE .

echo "🔍 Running tests..."
npm test

echo "🚢 Pushing to registry..."
docker push $DOCKER_IMAGE

echo "☁️  Deploying to Fly.io..."
fly deploy --config fly.toml --image $DOCKER_IMAGE

echo "✅ Agent deployed successfully!"
