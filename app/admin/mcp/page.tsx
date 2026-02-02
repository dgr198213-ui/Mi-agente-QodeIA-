'use client';

/**
 * Panel de Administración MCP
 * 
 * Permite configurar y activar MCP desde la interfaz web
 * sin necesidad de ejecutar scripts locales
 */

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente de Supabase (asumiendo variables de entorno configuradas)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface MCPConfig {
  howard_os_notebook_url: string;
  soluciones_notebook_url: string;
  ecosistema_notebook_url: string;
  notebooklm_cookie: string;
  enabled: boolean;
  last_updated: string;
}

interface MCPStats {
  total_queries: number;
  cache_hit_rate: number;
  avg_response_time: number;
  last_sync: string;
  notebooks_connected: number;
}

export default function MCPAdminPanel() {
  const [config, setConfig] = useState<MCPConfig>({
    howard_os_notebook_url: '',
    soluciones_notebook_url: '',
    ecosistema_notebook_url: '',
    notebooklm_cookie: '',
    enabled: false,
    last_updated: '',
  });

  const [stats, setStats] = useState<MCPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [authStep, setAuthStep] = useState<'idle' | 'authenticating' | 'done'>('idle');

  useEffect(() => {
    loadConfiguration();
    loadStats();
  }, []);

  /**
   * Cargar configuración actual desde Supabase
   */
  async function loadConfiguration() {
    try {
      const { data, error } = await supabase
        .from('agent_state')
        .select('value')
        .eq('key', 'mcp_config')
        .single();

      if (data && !error) {
        setConfig(data.value as MCPConfig);
      }
    } catch (error) {
      console.error('Error loading MCP config:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Cargar estadísticas de uso MCP
   */
  async function loadStats() {
    try {
      const response = await fetch('/api/mcp/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading MCP stats:', error);
    }
  }

  /**
   * Iniciar proceso de autenticación OAuth con Google
   */
  async function handleAuthenticateWithGoogle() {
    setAuthStep('authenticating');

    try {
      const response = await fetch('/api/mcp/auth/google', {
        method: 'POST',
      });

      const { auth_url } = await response.json();

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        auth_url,
        'NotebookLM Authentication',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const messageListener = async (event: MessageEvent) => {
        if (event.data.type === 'mcp-auth-success') {
          const { cookie } = event.data;
          
          setConfig((prev) => ({
            ...prev,
            notebooklm_cookie: cookie,
          }));

          setAuthStep('done');
          authWindow?.close();
          window.removeEventListener('message', messageListener);
          alert('✅ Autenticación exitosa con Google');
        }
      };

      window.addEventListener('message', messageListener);
    } catch (error) {
      console.error('Error en autenticación:', error);
      alert('❌ Error en autenticación. Intenta de nuevo.');
      setAuthStep('idle');
    }
  }

  /**
   * Guardar configuración
   */
  async function handleSaveConfiguration() {
    setSaving(true);

    try {
      const { error: dbError } = await supabase.from('agent_state').upsert({
        key: 'mcp_config',
        value: {
          ...config,
          last_updated: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      await fetch('/api/mcp/update-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          HOWARD_OS_NOTEBOOK_URL: config.howard_os_notebook_url,
          SOLUCIONES_NOTEBOOK_URL: config.soluciones_notebook_url,
          ECOSISTEMA_NOTEBOOK_URL: config.ecosistema_notebook_url,
          NOTEBOOKLM_COOKIE: config.notebooklm_cookie,
        }),
      });

      alert('✅ Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('❌ Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Probar conexión MCP
   */
  async function handleTestConnection() {
    setTestingConnection(true);

    try {
      const response = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebook_url: config.howard_os_notebook_url,
          cookie: config.notebooklm_cookie,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(
          `✅ Conexión exitosa!\n\n` +
          `Cuadernos encontrados: ${result.notebooks_count}\n` +
          `Fuentes totales: ${result.sources_count}`
        );
      } else {
        alert(`❌ Error de conexión:\n${result.error}`);
      }
    } catch (error) {
      alert('❌ Error al probar conexión');
    } finally {
      setTestingConnection(false);
    }
  }

  /**
   * Activar/Desactivar MCP
   */
  async function handleToggleMCP(enabled: boolean) {
    setConfig((prev) => ({ ...prev, enabled }));
    
    await supabase.from('agent_state').upsert({
      key: 'mcp_enabled',
      value: { enabled },
      updated_at: new Date().toISOString(),
    });

    await fetch('/api/agent/reload', { method: 'POST' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando configuración MCP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">
                Panel de Administración MCP
              </h1>
              <p className="text-gray-500 mt-2">
                Gestiona la integración con NotebookLM y la base de conocimiento de QodeIA.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {config.enabled ? 'Activo' : 'Inactivo'}
              </span>
              <button
                onClick={() => handleToggleMCP(!config.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  config.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Consultas" value={stats.total_queries} icon="📊" />
            <StatCard title="Cache Hit" value={`${stats.cache_hit_rate}%`} icon="⚡" />
            <StatCard title="Latencia" value={`${stats.avg_response_time}ms`} icon="⏱️" />
            <StatCard title="Cuadernos" value={stats.notebooks_connected} icon="📚" />
          </div>
        )}

        {/* Configuration Sections */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
          {/* 1. Authentication */}
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Autenticación</h2>
            <p className="text-gray-600 mb-6">
              Conecta tu cuenta de Google para permitir que el agente acceda a tus cuadernos de NotebookLM de forma segura.
            </p>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleAuthenticateWithGoogle}
                disabled={authStep === 'authenticating'}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {authStep === 'authenticating' ? 'Autenticando...' : 'Autenticar con Google'}
              </button>
              {config.notebooklm_cookie && (
                <span className="text-green-600 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Sesión activa
                </span>
              )}
            </div>
          </div>

          {/* 2. Notebook URLs */}
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. Configuración de Cuadernos</h2>
            <div className="space-y-6">
              <InputGroup
                label="Howard OS (Arquitectura)"
                value={config.howard_os_notebook_url}
                onChange={(v) => setConfig({ ...config, howard_os_notebook_url: v })}
                placeholder="https://notebooklm.google.com/notebook/..."
              />
              <InputGroup
                label="Soluciones QodeIA"
                value={config.soluciones_notebook_url}
                onChange={(v) => setConfig({ ...config, soluciones_notebook_url: v })}
                placeholder="https://notebooklm.google.com/notebook/..."
              />
              <InputGroup
                label="Ecosistema (Opcional)"
                value={config.ecosistema_notebook_url}
                onChange={(v) => setConfig({ ...config, ecosistema_notebook_url: v })}
                placeholder="https://notebooklm.google.com/notebook/..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-8 bg-gray-50 rounded-b-xl flex items-center justify-between">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection || !config.howard_os_notebook_url}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {testingConnection ? 'Probando...' : '🧪 Probar Conexión'}
            </button>
            <button
              onClick={handleSaveConfiguration}
              disabled={saving}
              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : '💾 Guardar Configuración'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-sm text-gray-500 mt-2 font-medium">{title}</p>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
      />
    </div>
  );
}
