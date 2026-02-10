# 🚀 QodeIA - Full Stack Implementation

Sistema completo de agente de IA con arquitectura headless.

## 📁 Estructura del Proyecto

```
qodeia-full-stack/
├── supabase/              # Base de datos y backend
├── mi-agente-qodeia/      # Servicio headless del agente
├── qodeia-agent-sdk/      # SDK TypeScript
├── plataforma-qd/         # IDE Frontend
├── web-qodeia/            # Portal Web
├── scripts/               # Scripts de deployment
└── docs/                  # Documentación
```

## 🎯 Orden de Implementación

1. **Supabase Setup** (30 min)
   ```bash
   cd supabase
   ./setup.sh
   ```

2. **Agente Headless** (1 hora)
   ```bash
   cd mi-agente-qodeia
   npm install
   npm run build
   npm test
   ```

3. **SDK** (30 min)
   ```bash
   cd qodeia-agent-sdk
   npm install
   npm run build
   ```

4. **Plataforma-qd** (1 hora)
   ```bash
   cd plataforma-qd
   npm install
   npm run dev
   ```

5. **Web-QodeIA** (30 min)
   ```bash
   cd web-qodeia
   npm install
   npm run dev
   ```

## 🔧 Variables de Entorno Requeridas

### Supabase
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `OPENAI_API_KEY`

### Agente
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`
- `PORT=3000`

### Frontends
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AGENT_API_URL`

## 📚 Documentación Completa

Ver `/docs` para:
- Guía de arquitectura
- API Reference (OpenAPI)
- Troubleshooting
- Deployment guides

## ✅ Checklist

Ver `docs/CHECKLIST.md` para validación completa.

## 🆘 Soporte

Revisar `docs/TROUBLESHOOTING.md` para problemas comunes.
