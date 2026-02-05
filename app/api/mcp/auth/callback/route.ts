import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) return new NextResponse('Missing parameters', { status: 400 });

  try {
    const { data: stateData } = await supabase
      .from('agent_state')
      .select('value')
      .eq('key', `oauth_state_${state}`)
      .single();

    if (!stateData) return new NextResponse('Invalid state', { status: 403 });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/mcp/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    const notebooklmCookie = await extractNotebookLMCookie(tokens.access_token);

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'mcp-auth-success', cookie: '${notebooklmCookie}' }, '*');
            }
          </script>
          <div style="text-align: center; padding: 50px; font-family: sans-serif;">
            <h1>✅ Autenticación Exitosa</h1>
            <p>Puedes cerrar esta ventana.</p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error en OAuth callback:', error);
    return new NextResponse('Authentication failed', { status: 500 });
  }
}

async function extractNotebookLMCookie(accessToken: string): Promise<string> {
  const response = await fetch('https://notebooklm.google.com/api/session', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const setCookie = response.headers.get('set-cookie');
  const cookieMatch = setCookie?.match(/SIDCC=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : '';
}
