'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CredentialPanel } from './components/CredentialPanel';
import { Terminal, Shield, Zap, Users, BookOpen, Activity, ChevronRight, Loader2 } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function AgentDashboard() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentState, setAgentState] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'credentials' | 'audit'>('chat');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAgentState();
    loadAuditLogs();
    
    const stateSub = supabase
      .channel('agent_state_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_state' }, loadAgentState)
      .subscribe();

    const auditSub = supabase
      .channel('audit_logs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_audit_logs' }, (payload) => {
        setAuditLogs(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stateSub);
      supabase.removeChannel(auditSub);
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

  async function loadAuditLogs() {
    const { data } = await supabase
      .from('agent_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setAuditLogs(data);
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
        body: JSON.stringify({ 
          message: input, 
          sessionId: 'dashboard-session',
          context: 'dashboard'
        })
      });

      const data = await response.json();
      if (data.response) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response, 
          timestamp: new Date().toISOString(),
          delegatedTasks: data.delegatedTasks
        }]);
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
      <div className="w-72 bg-[#111817] border-r border-[#1a2e2a] flex flex-col">
        <div className="p-6 border-b border-[#1a2e2a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-slate-950 font-bold" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#0087b1] to-[#00cd91] bg-clip-text text-transparent">
              QodeIA Agent
            </h1>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">Multi-Agent Orchestrator v2.0</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Estado del Sistema</h2>
            <div className="space-y-2">
              <StatusItem label="CEO (Gemini Flash)" status="Activo" color="text-emerald-400" />
              <StatusItem label="GitHub (DeepSeek)" status="Ready" color="text-blue-400" />
              <StatusItem label="Supa (Gemini Flash)" status="Ready" color="text-cyan-400" />
              <StatusItem label="Vercel (Gemini Flash)" status="Ready" color="text-emerald-400" />
              <StatusItem label="MCP (Mistral)" status="Ready" color="text-orange-400" />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Navegación</h2>
            <nav className="space-y-1">
              <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<Terminal size={16} />} label="Terminal Chat" />
              <NavButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<Activity size={16} />} label="Auditoría de Agentes" />
              <NavButton active={activeTab === 'credentials'} onClick={() => setActiveTab('credentials')} icon={<Shield size={16} />} label="Credenciales" />
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-[#1a2e2a]">
          <div className="bg-[#1a2e2a]/50 rounded-xl p-3 border border-[#1a2e2a]">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Uso de Créditos</span>
              <span className="text-emerald-400">FREE TIER</span>
            </div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[10%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-[#1a2e2a] flex items-center justify-between px-8 bg-[#0a0f0e]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20 uppercase tracking-widest">
              Gemini Flash CEO Active
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Gemini Flash CEO Escuchando
            </div>
          </div>
        </header>

        {activeTab === 'chat' ? (
          <>
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 pb-32">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                    <Zap size={40} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-medium">QodeIA CEO Orchestrator</h3>
                  <p className="max-w-xs mt-2">Sistema multi-agente listo. Puedo gestionar GitHub, Supabase, Vercel y análisis técnico.</p>
                </div>
              )}
              
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-5 ${
                    msg.role === 'user' 
                    ? 'bg-[#0087b1] text-white rounded-tr-none' 
                    : 'bg-[#111817] text-gray-100 border border-[#1a2e2a] rounded-tl-none shadow-xl'
                  }`}>
                    <div className="flex items-center gap-2 mb-2 opacity-50 text-[10px] uppercase tracking-widest font-bold">
                      {msg.role === 'user' ? 'Usuario' : 'QodeIA CEO'}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.delegatedTasks && msg.delegatedTasks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        <div className="text-[10px] uppercase text-emerald-400 font-bold mb-2">Tareas Delegadas:</div>
                        {msg.delegatedTasks.map((task: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs bg-white/5 p-2 rounded border border-white/5">
                            <ChevronRight size={12} className="text-emerald-500" />
                            <span className="font-bold text-emerald-400">[{task.specialist.toUpperCase()}]</span>
                            <span className="text-gray-400 truncate">{task.task}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <span className="text-[10px] opacity-30 mt-3 block">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#111817] border border-[#1a2e2a] rounded-2xl rounded-tl-none p-5 flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-emerald-500" />
                    <span className="text-sm text-gray-400">CEO está orquestando especialistas...</span>
                  </div>
                </div>
              )}
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
                  placeholder="Describe tu objetivo (ej: Crea un repo y configura auth)..."
                  className="w-full bg-[#111817] border border-[#1a2e2a] rounded-xl py-4 pl-6 pr-16 focus:outline-none focus:border-[#00cd91] transition-colors shadow-2xl text-sm"
                  disabled={loading}
                />
                <button 
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#00cd91] text-black rounded-lg hover:bg-[#00b37e] transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
                </button>
              </div>
            </div>
          </>
        ) : activeTab === 'audit' ? (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Auditoría de Agentes</h2>
                <button onClick={loadAuditLogs} className="text-xs text-emerald-400 hover:underline">Actualizar logs</button>
              </div>
              
              <div className="space-y-4">
                {auditLogs.map((log, i) => (
                  <div key={i} className="bg-[#111817] border border-[#1a2e2a] rounded-xl p-5 hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          log.specialist === 'github' ? 'bg-blue-500/10 text-blue-400' :
                          log.specialist === 'supabase' ? 'bg-cyan-500/10 text-cyan-400' :
                          log.specialist === 'vercel' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-orange-500/10 text-orange-400'
                        }`}>
                          {log.specialist}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <span className="text-xs text-gray-500">{log.execution_time}ms</span>
                    </div>
                    <h4 className="text-sm font-bold mb-2 text-gray-200">{log.task_description}</h4>
                    <p className="text-xs text-gray-400 bg-black/20 p-3 rounded border border-white/5 font-mono overflow-x-auto">
                      {log.result_summary}
                    </p>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="text-center py-20 text-gray-500">No hay logs de auditoría disponibles.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
              <CredentialPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusItem({ label, status, color }: any) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${color}`}>{status}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`}></span>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-lg text-sm transition-all ${
        active 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
