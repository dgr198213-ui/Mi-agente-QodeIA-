'use client';

import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface AgentStep {
  type: 'thinking' | 'tool_call' | 'observation' | 'decision';
  content: string;
  timestamp: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [showSteps, setShowSteps] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setCurrentSteps([]);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          sessionId,
          stream: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentSteps(data.steps || []);
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error de conexión: ${error.message}`,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSteps([]);
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'thinking':
        return '🤔';
      case 'tool_call':
        return '🔧';
      case 'observation':
        return '👁️';
      case 'decision':
        return '✅';
      default:
        return '📝';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🤖 Agente Autónomo
            </h1>
            <p className="text-sm text-gray-500">
              Session: {sessionId.substring(0, 8)}...
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showSteps ? 'Ocultar' : 'Ver'} Pasos
            </button>
            <button
              onClick={clearChat}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Limpiar Chat
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
        <div className="flex h-full gap-4 p-4">
          {/* Messages Area */}
          <div
            className={`flex-1 overflow-y-auto space-y-4 ${
              showSteps ? 'w-2/3' : 'w-full'
            }`}
          >
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-lg font-semibold">
                  ¡Hola! Soy tu agente autónomo.
                </p>
                <p className="mt-2">
                  Puedo ayudarte con GitHub, Supabase y Vercel.
                </p>
                <p className="mt-4 text-sm">
                  Prueba preguntarme algo como:
                </p>
                <ul className="mt-2 text-sm space-y-1">
                  <li>"Lista los archivos del repositorio"</li>
                  <li>"Crea una nueva rama llamada feature/test"</li>
                  <li>"Consulta las tareas pendientes"</li>
                  <li>"Muestra el estado de los deployments"</li>
                </ul>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">
                      {message.role === 'user' ? '👤' : '🤖'}
                    </span>
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={`text-xs mt-2 ${
                          message.role === 'user'
                            ? 'text-blue-100'
                            : 'text-gray-400'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">
                      El agente está pensando...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Steps Panel */}
          {showSteps && (
            <div className="w-1/3 bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto">
              <h3 className="font-bold text-gray-900 mb-4">
                Pasos del Agente
              </h3>
              {currentSteps.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No hay pasos para mostrar
                </p>
              ) : (
                <div className="space-y-3">
                  {currentSteps.map((step, index) => (
                    <div
                      key={index}
                      className="border-l-2 border-blue-600 pl-3 py-1"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">
                          {getStepIcon(step.type)}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-700 uppercase">
                            {step.type}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {step.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
