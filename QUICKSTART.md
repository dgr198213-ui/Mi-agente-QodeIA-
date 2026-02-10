# 🚀 QodeIA - Guía de Inicio Rápido

## ⚡ Quick Start (5 minutos)

### 1. Configurar Variables de Entorno

```bash
# Crear .env para cada proyecto

# Supabase
export SUPABASE_PROJECT_ID="tu-project-id"
export DATABASE_URL="postgresql://..."
export OPENAI_API_KEY="sk-..."

# mi-agente-qodeia/.env
SUPABASE_URL=https://tu-project.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key
OPENAI_API_KEY=sk-...
PORT=3000
NODE_ENV=development

# plataforma-qd/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
NEXT_PUBLIC_AGENT_API_URL=http://localhost:3000

# web-qodeia/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
NEXT_PUBLIC_AGENT_API_URL=http://localhost:3000
NEXT_PUBLIC_IDE_URL=http://localhost:3001
```

### 2. Setup Supabase (una sola vez)

```bash
cd supabase
chmod +x setup.sh
./setup.sh
```

### 3. Iniciar Agente

```bash
cd mi-agente-qodeia
npm install
npm run dev
# Agente corriendo en http://localhost:3000
```

### 4. Verificar Agente

```bash
curl http://localhost:3000/status
# Deberías ver: {"service":"mi-agente-qodeia","status":"ok",...}
```

### 5. Iniciar Frontends (en terminales separadas)

```bash
# Terminal 1 - Plataforma-qd
cd plataforma-qd
npm install
npm run dev
# IDE en http://localhost:3001

# Terminal 2 - Web-QodeIA
cd web-qodeia
npm install
npm run dev
# Portal en http://localhost:3000
```

## ✅ Verificación

1. Abrir http://localhost:3000 (Web-QodeIA)
2. Ver panel de servicios
3. Agente debe mostrar "Operativo"
4. Clic en "Abrir IDE"
5. Crear un plan de prueba
6. Ver resultado en DB

## 📦 Estructura de Archivos Completada

```
qodeia-full-stack/
├── supabase/
│   ├── schema.sql ✅
│   ├── setup.sh ✅
│   └── functions/
│       └── generate-embeddings/index.ts ✅
├── mi-agente-qodeia/
│   ├── src/
│   │   ├── core/
│   │   │   ├── planner.ts ✅
│   │   │   ├── executor.ts ✅
│   │   │   └── memory.ts ✅
│   │   ├── api/
│   │   │   ├── routes.ts ✅
│   │   │   ├── middleware.ts ✅
│   │   │   └── validators.ts ✅
│   │   ├── db/
│   │   │   └── supabase.ts ✅
│   │   ├── types/
│   │   │   └── index.ts ✅
│   │   └── index.ts ✅
│   ├── package.json ✅
│   ├── tsconfig.json ✅
│   ├── Dockerfile ✅
│   └── .env.example ✅
├── qodeia-agent-sdk/
│   ├── src/
│   │   ├── client.ts ✅
│   │   ├── types.ts ✅
│   │   ├── errors.ts ✅
│   │   └── index.ts ✅
│   ├── package.json ✅
│   └── tsconfig.json ✅
├── scripts/
│   ├── deploy-agent.sh ✅
│   └── health-check.sh ✅
├── docs/
│   ├── ARCHITECTURE.md ✅
│   └── CHECKLIST.md ✅
└── README.md ✅
```

## 🔧 Troubleshooting

### Error: "Missing Supabase credentials"
- Verificar que .env existe y tiene todas las variables
- Asegurarse de que SUPABASE_URL y SUPABASE_SERVICE_KEY están definidas

### Error: "Failed to connect to database"
- Verificar DATABASE_URL
- Confirmar que el proyecto de Supabase está activo
- Revisar reglas de firewall

### Error: "OpenAI API error"
- Verificar OPENAI_API_KEY
- Confirmar que tienes créditos disponibles

### Agente no responde
```bash
# Verificar que está corriendo
curl http://localhost:3000/health

# Ver logs
cd mi-agente-qodeia
npm run dev
```

### Embeddings no se generan
```bash
# Forzar procesamiento manual
curl -X POST https://tu-project.supabase.co/functions/v1/generate-embeddings \
  -H "Authorization: Bearer TU_ANON_KEY"

# Verificar tabla
psql $DATABASE_URL -c "SELECT embedding_status, COUNT(*) FROM agent_memory GROUP BY embedding_status;"
```

## 🚀 Deployment a Producción

Ver `scripts/deploy-agent.sh` para deployment automatizado.

Para deploy manual:

```bash
# 1. Build del agente
cd mi-agente-qodeia
docker build -t qodeia/agent:latest .

# 2. Deploy (ejemplo con Fly.io)
fly deploy

# 3. Deploy frontends (ejemplo con Vercel)
cd plataforma-qd
vercel --prod
```

## 📚 Próximos Pasos

1. Leer `docs/ARCHITECTURE.md` para entender el sistema
2. Revisar `docs/CHECKLIST.md` antes de producción
3. Personalizar prompts en `src/core/planner.ts`
4. Configurar monitoreo según necesidades

## 🆘 Soporte

- GitHub Issues: (tu repo)
- Email: (tu email)
- Docs: Ver carpeta `/docs`
