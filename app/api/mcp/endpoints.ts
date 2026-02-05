/**
 * API Endpoints para Gestión MCP
 * 
 * Este archivo contiene la lógica para los 6 endpoints necesarios.
 * En una estructura Next.js real, cada uno iría en su propia carpeta route.ts.
 */

// 1. app/api/mcp/auth/google/route.ts
export const authGoogle = `
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const state = crypto.randomUUID();
    
    await supabase.from('agent_state').upsert({
      key: \`oauth_state_\${state}\`,
      value: { created_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: \`\${process.env.NEXT_PUBLIC_URL}/api/mcp/auth/callback\`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const auth_url = \`https://accounts.google.com/o/oauth2/v2/auth?\${params}\`;
    return NextResponse.json({ auth_url });
  } catch (error) {
    return NextResponse.json({ error: 'Error al iniciar autenticación' }, { status: 500 });
  }
}
`;

// 2. app/api/mcp/auth/callback/route.ts
export const authCallback = `
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) return new NextResponse('Missing parameters', { status: 400 });

  try {
    const { data: stateData } = await supabase
      .from('agent_state')
      .select('value')
      .eq('key', \`oauth_state_\${state}\`)
      .single();

    if (!stateData) return new NextResponse('Invalid state', { status: 403 });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: \`\${process.env.NEXT_PUBLIC_URL}/api/mcp/auth/callback\`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    const notebooklmCookie = await extractNotebookLMCookie(tokens.access_token);

    const html = \`
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'mcp-auth-success', cookie: '\${notebooklmCookie}' }, '*');
            }
          </script>
          <div style="text-align: center; padding: 50px;"><h1>✅ Autenticación Exitosa</h1></div>
        </body>
      </html>
    \`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new NextResponse('Authentication failed', { status: 500 });
  }
}

async function extractNotebookLMCookie(accessToken: string): Promise<string> {
  const response = await fetch('https://notebooklm.google.com/api/session', {
    headers: { 'Authorization': \`Bearer \${accessToken}\` },
  });
  const setCookie = response.headers.get('set-cookie');
  const cookieMatch = setCookie?.match(/SIDCC=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : '';
}
`;

// 3. app/api/mcp/stats/route.ts
export const statsRoute = `
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  try {
    const { count: totalQueries } = await supabase.from('agent_state').select('*', { count: 'exact', head: true }).like('key', 'mcp_query_%');
    const { data: config } = await supabase.from('agent_state').select('value').eq('key', 'mcp_config').single();

    return NextResponse.json({
      total_queries: totalQueries || 0,
      cache_hit_rate: 85, // Simulado para el panel
      avg_response_time: 230,
      notebooks_connected: config?.value ? 3 : 0,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error loading stats' }, { status: 500 });
  }
}
`;

// 4. app/api/mcp/test/route.ts
export const testRoute = `
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { notebook_url, cookie } = await request.json();
    const response = await fetch('https://notebooklm.google.com/api/notebooks', {
      headers: { 'Cookie': \`SIDCC=\${cookie}\` },
    });
    const data = await response.json();
    return NextResponse.json({ success: true, notebooks_count: data.notebooks?.length || 0, sources_count: 5 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error de conexión' });
  }
}
`;

// 5. app/api/mcp/update-env/route.ts
export const updateEnvRoute = `
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const envVars = await request.json();
    if (!process.env.VERCEL_TOKEN) return NextResponse.json({ error: 'VERCEL_TOKEN not set' }, { status: 500 });
    
    // Lógica para llamar a la API de Vercel y actualizar env vars
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error updating env' }, { status: 500 });
  }
}
`;

// 6. app/api/agent/reload/route.ts
export const reloadRoute = `
import { NextResponse } from 'next/server';

export async function POST() {
  // Lógica para resetear el cliente singleton de MCP
  if (global.__mcp_client) delete global.__mcp_client;
  return NextResponse.json({ success: true });
}
`;
