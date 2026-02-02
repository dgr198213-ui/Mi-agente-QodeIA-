# 🌐 Guía de Configuración Web de MCP - QodeIA

Esta guía explica cómo configurar y gestionar la integración de **Model Context Protocol (MCP)** y **NotebookLM** directamente desde el navegador, eliminando la necesidad de scripts locales.

## 🚀 Pasos para la Activación

### 1. Configuración de Google OAuth
Para que el panel pueda obtener la sesión de NotebookLM automáticamente:
1. Ve a [Google Cloud Console](https://console.cloud.google.com).
2. Crea un proyecto y habilita las credenciales de **OAuth 2.0**.
3. Configura la URI de redirección: `https://tu-dominio.vercel.app/api/mcp/auth/callback`.
4. Obtén tu `Client ID` y `Client Secret`.

### 2. Variables de Entorno
Añade las siguientes variables a tu proyecto en Vercel:
- `GOOGLE_CLIENT_ID`: Tu ID de cliente de Google.
- `GOOGLE_CLIENT_SECRET`: Tu secreto de cliente de Google.
- `NEXT_PUBLIC_URL`: La URL base de tu aplicación.
- `VERCEL_TOKEN`: Token de acceso de Vercel (para actualizaciones automáticas).
- `VERCEL_PROJECT_ID`: ID de tu proyecto en Vercel.

### 3. Uso del Panel de Administración
Accede a `/admin/mcp` en tu aplicación desplegada:
1. **Autenticar**: Haz clic en "Autenticar con Google" y autoriza el acceso.
2. **Cuadernos**: Pega las URLs de tus cuadernos de NotebookLM (Howard OS, Soluciones).
3. **Probar**: Usa el botón "Probar Conexión" para verificar el acceso.
4. **Guardar**: Haz clic en "Guardar Configuración" para aplicar los cambios.
5. **Activar**: Usa el interruptor (toggle) en la parte superior para habilitar MCP en el agente.

## 📊 Monitoreo
El panel incluye un dashboard en tiempo real que muestra:
- **Consultas Totales**: Número de interacciones con la base de conocimiento.
- **Cache Hit Rate**: Eficiencia de la caché local.
- **Latencia**: Tiempo promedio de respuesta de NotebookLM.
- **Estado de Conexión**: Cuadernos actualmente vinculados.

---
*Última actualización: Febrero 2026*
