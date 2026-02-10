import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Lógica para resetear el cliente singleton de MCP si existe en el ámbito global
    // @ts-ignore
    if (global.__mcp_client) {
      // @ts-ignore
      delete global.__mcp_client;
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
