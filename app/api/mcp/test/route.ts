import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { notebook_url, cookie } = await request.json();
    
    if (!notebook_url || !cookie) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros' });
    }

    const response = await fetch('https://notebooklm.google.com/api/notebooks', {
      headers: { 'Cookie': `SIDCC=${cookie}` },
    });
    
    if (!response.ok) {
      throw new Error('Error en la API de NotebookLM');
    }
    
    const data = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      notebooks_count: data.notebooks?.length || 0, 
      sources_count: 5 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
