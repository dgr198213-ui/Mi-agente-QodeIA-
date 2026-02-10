/**
 * Mi-agente-QodeIA/app/api/agent/chat/route.ts
 * 
 * Chat conversacional con streaming SSE
 */

import { NextRequest } from 'next/server';
import { Agent } from '@/agent/core/agent';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, projectId, conversationId, context } = await req.json();

    logger.info('[Chat] Nuevo mensaje', {
      projectId,
      conversationId,
      contextSource: context?.source || 'none',
      messageLength: message.length
    });

    // Validaciones
    if (!message || !projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing message or projectId' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 1. Inicializar agente
    const agent = new Agent({
      projectId,
      conversationId,
      initialContext: context?.cached ? {
        content: context.content,
        strategy: context.strategy,
        tokens: context.tokens,
        source: 'cme',
        files: context.files
      } : null
    });

    // 2. Crear stream de respuesta
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Callback para cada chunk de la respuesta
          const onChunk = (chunk: any) => {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          // Ejecutar chat con streaming
          await agent.chat(message, {
            onChunk,
            stream: true
          });

          // Enviar señal de finalización
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          logger.error('[Chat] Error en stream:', error);
          
          const errorData = `data: ${JSON.stringify({
            type: 'error',
            error: error.message
          })}\n\n`;
          
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      }
    });

    // 3. Retornar stream
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    logger.error('[Chat] Error inicial:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
