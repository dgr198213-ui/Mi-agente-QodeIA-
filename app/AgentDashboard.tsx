'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function AgentDashboard() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentState, setAgentState] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAgentState();
    const subscription = supabase
      .channel('agent_state_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_state' }, loadAgentState)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadAgentState() {
    const { data } = await supabase.from('agent_state').select('*');
    if (data) {
      const stateObj = data.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      setAgentState(stateObj);
    }
  }

  async function sendMessage() {
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, sessionId: 'dashboard-' + Date.now() })
      });

      const data = await response.json();
      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response, timestamp: new Date().toISOString() }]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0f0e] text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#111817] border-r border-[#1a2e2a] flex flex-col">
        <div className="p-6 border-b border-[#1a2e2a]">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#0087b1] to-[#00cd91] bg-clip-text text-transparent">
            QodeIA Agent
          </h1>
          <p className="text-xs text-gray-500 mt-1">v1.0.0-alpha</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Estado del Sistema</h2>
            <div className="space-y-2">
              <StatusItem label="Motor IA" status={agentState?.mcp_enabled?.enabled ? 'Online' : 'Offline'} color={agentState?.mcp_enabled?.enabled ? 'text-green-400' : 'text-gray-500'} />
              <StatusItem label="Memoria" status="Activa" color="text-blue-400" />
              <StatusItem label="Contexto" status="Howard OS" color="text-purple-400" />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Conexiones MCP</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-400">
                <span>NotebookLM</span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
              </div>
              <div className="flex items-center justify-between text-gray-400">
                <span>Supabase Knowledge</span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#1a2e2a]">
          <a href="/admin/mcp" className="block w-full py-2 px-4 bg-[#1a2e2a] hover:bg-[#253f3a] text-center rounded-lg text-sm transition-colors">
            Configurar MCP
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-[#1a2e2a] flex items-center justify-between px-8 bg-[#0a0f0e]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded border border-green-500/20">
              SISTEMA OPERATIVO ACTIVO
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Escuchando peticiones
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 pb-32">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-medium">Terminal del Agente QodeIA</h3>
              <p className="max-w-xs mt-2">Bienvenido al núcleo operativo. El agente está listo para recibir instrucciones.</p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl p-4 ${
                msg.role === 'user' 
                ? 'bg-[#0087b1] text-white rounded-tr-none' 
                : 'bg-[#1a2e2a] text-gray-100 border border-[#253f3a] rounded-tl-none'
              }`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <span className="text-[10px] opacity-50 mt-2 block">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#0a0f0e] via-[#0a0f0e] to-transparent">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Enviar comando al agente..."
              className="w-full bg-[#111817] border border-[#1a2e2a] rounded-xl py-4 pl-6 pr-16 focus:outline-none focus:border-[#00cd91] transition-colors shadow-2xl"
              disabled={loading}
            />
            <button 
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#00cd91] text-black rounded-lg hover:bg-[#00b37e] transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, status, color }: any) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${color}`}>{status}</span>
    </div>
  );
}
