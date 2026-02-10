# QodeIA - Arquitectura del Sistema

## Overview

Sistema de agente de IA con arquitectura headless:

```
┌─────────────┐     JWT      ┌──────────────┐
│  Web-QodeIA │─────────────▶│ Plataforma-qd│
│   (Portal)  │              │    (IDE)     │
└─────────────┘              └──────┬───────┘
                                    │
                                    │ HTTP/REST
                                    ▼
                            ┌───────────────┐
                            │ Mi-agente-    │
                            │   QodeIA      │
                            │  (Headless)   │
                            └───────┬───────┘
                                    │
                                    │ SQL
                                    ▼
                            ┌───────────────┐
                            │   Supabase    │
                            │   (Postgres)  │
                            └───────────────┘
```

## Componentes

### 1. Supabase
- PostgreSQL con pgvector
- Row Level Security (RLS)
- Edge Functions para embeddings
- Authentication

### 2. Mi-agente-QodeIA
- Servicio headless Node.js
- API REST
- Integración OpenAI
- Generación de planes
- Ejecución controlada

### 3. SDK TypeScript
- Cliente tipado
- Retry logic
- Error handling
- Rate limiting awareness

### 4. Plataforma-qd
- IDE frontend (Next.js)
- Interfaz del agente
- Panel de memoria
- Visualización de planes

### 5. Web-QodeIA
- Portal principal
- Dashboard de servicios
- Redirección con JWT

## Flujo de Datos

1. Usuario login en Web-QodeIA
2. JWT generado por Supabase Auth
3. Redirect a Plataforma-qd con JWT
4. Plataforma crea sesión de agente
5. Usuario solicita plan
6. SDK llama al agente
7. Agente genera plan vía OpenAI
8. Plan guardado en Supabase
9. Usuario ejecuta plan
10. Resultados almacenados
11. Memoria indexada con embeddings
