#!/bin/bash
set -e

echo "🚀 Setting up Supabase for QodeIA..."

if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo "❌ Error: SUPABASE_PROJECT_ID not set"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set"
    exit 1
fi

echo "📦 Installing Supabase CLI..."
npm install -g supabase

echo "🔗 Linking to Supabase project..."
supabase link --project-ref $SUPABASE_PROJECT_ID

echo "📊 Applying schema..."
psql $DATABASE_URL -f ./schema.sql

echo "✅ Supabase setup complete!"
