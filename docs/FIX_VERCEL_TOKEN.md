# Corrección del Error de Token en Vercel

## Diagnóstico

El error `You defined "--token", but its contents are invalid. Must not contain: "\n"` indica que la variable de entorno `VERCEL_TOKEN` configurada en el proyecto de Vercel contiene un **salto de línea (`\n`)** al final del valor.

Este problema ocurre cuando el token se copia con un salto de línea accidental desde el terminal o desde el panel de Vercel.

## Causa Raíz

Vercel CLI internamente pasa el token como argumento `--token` al ejecutar `vercel build`. Si el valor de `VERCEL_TOKEN` contiene un `\n`, el CLI lo rechaza con este error.

## Solución: Pasos Manuales Requeridos

### Paso 1: Acceder al Panel de Vercel

1. Ir a [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Seleccionar el proyecto **mi-agente-qode-ia**
3. Ir a **Settings** → **Environment Variables**

### Paso 2: Identificar y Eliminar el VERCEL_TOKEN Corrupto

1. Buscar la variable `VERCEL_TOKEN`
2. Hacer clic en **Edit**
3. **Eliminar** el valor actual (que contiene el salto de línea)
4. **Pegar** el nuevo token asegurándose de que NO tenga salto de línea al final

### Paso 3: Obtener un Token Limpio

Si necesitas generar un nuevo token:

1. Ir a [https://vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Crear un nuevo token con nombre descriptivo (ej: `mi-agente-qode-ia-ci`)
3. Copiar el token **sin hacer doble clic** (para evitar seleccionar el salto de línea)

### Paso 4: Verificar que el Token no Tiene Salto de Línea

En tu terminal local, puedes verificar el token antes de pegarlo:

```bash
# Verificar que el token no tiene saltos de línea
echo -n "TU_TOKEN_AQUI" | wc -c
# El resultado debe ser exactamente la longitud del token sin caracteres extra
```

### Paso 5: Configurar el Token en Vercel

En el panel de Vercel, al pegar el token:
- Usar **Ctrl+Shift+V** (pegar sin formato) en lugar de **Ctrl+V**
- O usar la función de "pegar como texto plano" del navegador

### Paso 6: Disparar un Nuevo Deployment

Una vez corregido el token, el siguiente push a `main` debería desplegar exitosamente.

Si quieres forzar un redeploy sin hacer cambios en el código:

```bash
cd Mi-agente-QodeIA-
git commit --allow-empty -m "chore: trigger redeploy after fixing VERCEL_TOKEN"
git push origin main
```

## Verificación

Después de aplicar la corrección, el log de build debería mostrar:

```
Running "vercel build"
Vercel CLI 51.x.x
Vercel CLI 51.x.x
Installing dependencies...
...
Build Completed
```

En lugar del error anterior.

## Nota Técnica

El script `configure-vercel-env.sh` ha sido actualizado para usar `printf '%s'` en lugar de `echo` al inyectar variables, lo que previene la adición accidental de saltos de línea. Sin embargo, si el `VERCEL_TOKEN` ya fue configurado con un salto de línea en el panel de Vercel, debe corregirse manualmente como se describe arriba.
