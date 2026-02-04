import { NextRequest, NextResponse } from 'next/server';
import { supabase as createClient } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabase.from('agent_state').upsert({
      key: `oauth_state_${state}`,
      value: { created_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/mcp/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const auth_url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return NextResponse.json({ auth_url });
  } catch (error) {
    console.error('Error en OAuth init:', error);
    return NextResponse.json({ error: 'Error al iniciar autenticación' }, { status: 500 });
  }
}
