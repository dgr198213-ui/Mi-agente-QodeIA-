# Guía para Obtener Claves Privadas - Mi Agente QodeIA

## 🔐 Claves Requeridas

Este documento te guía paso a paso para obtener las claves privadas necesarias para el funcionamiento completo del agente.

---

## 1. SUPABASE_SERVICE_ROLE_KEY

### ¿Para qué sirve?
Permite al agente realizar operaciones administrativas en la base de datos (insertar, actualizar, eliminar).

### Cómo obtenerla:

1. Ve a https://supabase.com/dashboard
2. Selecciona el proyecto **Agente QodeIA** (nknevqndawnokiaickkl)
3. En el menú lateral, ve a **Settings** → **API**
4. Busca la sección **Project API keys**
5. Copia la clave **service_role** (⚠️ NO la clave `anon`)
6. Guárdala de forma segura

### Configurar en Vercel:

```bash
cd /home/ubuntu/mi-agente-qodeia
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Pega la clave cuando te lo pida
```

⚠️ **IMPORTANTE**: Esta clave tiene permisos completos sobre la base de datos. **NUNCA** la commitees al repositorio ni la compartas públicamente.

---

## 2. OPENAI_API_KEY

### ¿Para qué sirve?
Permite al agente usar los modelos de lenguaje de OpenAI (GPT-4, GPT-3.5) para razonamiento y generación de respuestas.

### Cómo obtenerla:

1. Ve a https://platform.openai.com
2. Inicia sesión o crea una cuenta
3. Ve a **API keys** en el menú lateral
4. Haz clic en **Create new secret key**
5. Dale un nombre descriptivo (ej: "Mi Agente QodeIA")
6. Copia la clave (solo se muestra una vez)
7. Guárdala de forma segura

### Configurar en Vercel:

```bash
vercel env add OPENAI_API_KEY production
# Pega la clave cuando te lo pida
```

### Costos:
- OpenAI cobra por uso (tokens procesados)
- Revisa los precios en: https://openai.com/pricing
- Puedes configurar límites de gasto en el dashboard

---

## 3. GITHUB_TOKEN

### ¿Para qué sirve?
Permite al agente gestionar repositorios, crear ramas, commits, pull requests, issues, etc.

### Cómo obtenerla:

1. Ve a https://github.com/settings/tokens
2. Haz clic en **Generate new token** → **Generate new token (classic)**
3. Dale un nombre descriptivo (ej: "Mi Agente QodeIA")
4. Selecciona los siguientes permisos:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Haz clic en **Generate token**
6. Copia el token (solo se muestra una vez)
7. Guárdalo de forma segura

### Configurar en Vercel:

```bash
vercel env add GITHUB_TOKEN production
# Pega el token cuando te lo pida
```

---

## 4. VERCEL_TOKEN

### ¿Para qué sirve?
Permite al agente gestionar despliegues en Vercel (listar proyectos, ver estado de despliegues, etc.).

### Cómo obtenerla:

1. Ve a https://vercel.com/account/tokens
2. Haz clic en **Create Token**
3. Dale un nombre descriptivo (ej: "Mi Agente QodeIA")
4. Selecciona el alcance:
   - **Full Account** (recomendado para desarrollo)
   - O selecciona proyectos específicos
5. Haz clic en **Create**
6. Copia el token (solo se muestra una vez)
7. Guárdalo de forma segura

### Configurar en Vercel:

```bash
vercel env add VERCEL_TOKEN production
# Pega el token cuando te lo pida
```

---

## 5. NotebookLM MCP (Opcional pero Recomendado)

### ¿Para qué sirve?
Permite al agente consultar documentación técnica verificable y sincronizar soluciones con una base de conocimiento.

### Paso 1: Crear Notebooks en NotebookLM

1. Ve a https://notebooklm.google.com
2. Crea dos notebooks:
   - **Howard OS**: Documentación técnica del sistema
   - **Soluciones**: Base de conocimiento de errores resueltos

### Paso 2: Obtener URLs de los Notebooks

1. Abre cada notebook
2. Copia la URL de la barra de direcciones
3. Ejemplo: `https://notebooklm.google.com/notebook/abc123xyz`

### Paso 3: Obtener Cookie de Autenticación

1. Abre NotebookLM en tu navegador
2. Abre la consola de desarrollador (F12)
3. Ve a la pestaña **Console**
4. Ejecuta: `document.cookie`
5. Copia todo el texto que aparece
6. Guárdalo de forma segura

### Configurar en Vercel:

```bash
vercel env add HOWARD_OS_NOTEBOOK_URL production
# Pega la URL del notebook de Howard OS

vercel env add SOLUCIONES_NOTEBOOK_URL production
# Pega la URL del notebook de Soluciones

vercel env add NOTEBOOKLM_COOKIE production
# Pega la cookie completa
```

---

## Verificación de Configuración

### Listar Variables Configuradas

```bash
vercel env ls
```

### Verificar que Todas las Variables Estén Configuradas

Deberías ver:
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ HOWARD_OS_SUPABASE_URL
- ✅ HOWARD_OS_SUPABASE_KEY
- ✅ OPENAI_API_KEY
- ✅ GITHUB_TOKEN
- ✅ GITHUB_OWNER
- ✅ GITHUB_REPO
- ✅ VERCEL_TOKEN
- ✅ VERCEL_TEAM_ID
- ✅ VERCEL_PROJECT_ID
- ✅ NEXT_PUBLIC_HOWARD_OS_URL
- ✅ NEXT_PUBLIC_WEB_URL
- ⚠️ HOWARD_OS_NOTEBOOK_URL (opcional)
- ⚠️ SOLUCIONES_NOTEBOOK_URL (opcional)
- ⚠️ NOTEBOOKLM_COOKIE (opcional)

---

## Redesplegar el Proyecto

Una vez configuradas todas las variables, redespliega el proyecto:

```bash
cd /home/ubuntu/mi-agente-qodeia
vercel --prod
```

---

## Seguridad

### ⚠️ NUNCA hagas lo siguiente:

- ❌ Commitear claves privadas al repositorio
- ❌ Compartir claves en mensajes públicos
- ❌ Usar claves de producción en desarrollo local
- ❌ Dejar claves en archivos `.env` sin añadir a `.gitignore`

### ✅ Buenas prácticas:

- ✅ Usar variables de entorno en Vercel
- ✅ Rotar claves periódicamente
- ✅ Usar claves diferentes para desarrollo y producción
- ✅ Configurar límites de gasto en servicios de pago (OpenAI)
- ✅ Revisar logs de acceso regularmente

---

## Troubleshooting

### "No puedo encontrar la service_role key en Supabase"

**Solución:**
1. Asegúrate de estar en el proyecto correcto (Agente QodeIA)
2. Ve a Settings → API
3. Busca la sección "Project API keys"
4. La clave service_role está debajo de la clave anon

### "Mi token de GitHub no funciona"

**Solución:**
1. Verifica que hayas seleccionado los permisos correctos (`repo`, `workflow`)
2. Verifica que el token no haya expirado
3. Genera un nuevo token si es necesario

### "La cookie de NotebookLM no funciona"

**Solución:**
1. La cookie puede expirar, obtén una nueva
2. Asegúrate de copiar la cookie completa (puede ser muy larga)
3. Verifica que estés usando el navegador correcto

---

**Última actualización:** 5 de febrero de 2026
