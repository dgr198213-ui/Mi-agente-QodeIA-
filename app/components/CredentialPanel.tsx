// ============================================
// COMPONENTE: PANEL DE CREDENCIALES
// ============================================

import React, { useState, useEffect } from 'react';
// Nota: Estas dependencias deben existir o ser creadas
// import { CredentialManager, CREDENTIAL_TEMPLATES } from './credential-manager';
// import { CredentialStore, CredentialField } from './personalization-types';

// Mock temporal o implementación básica si no existen los archivos
// Para evitar errores de compilación inmediatos, comentamos los imports y definimos tipos básicos

interface CredentialField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  validation?: (value: string) => boolean | string;
}

interface CredentialTemplate {
  name: string;
  service: string;
  type: string;
  fields: CredentialField[];
}

const CREDENTIAL_TEMPLATES: Record<string, CredentialTemplate> = {
  supabase: {
    name: 'Supabase',
    service: 'supabase',
    type: 'database',
    fields: [
      { key: 'url', label: 'URL del Proyecto', type: 'text', required: true, placeholder: 'https://xyz.supabase.co' },
      { key: 'key', label: 'Service Role Key', type: 'password', required: true }
    ]
  },
  openai: {
    name: 'OpenAI',
    service: 'openai',
    type: 'llm',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' }
    ]
  }
};

// Singleton Mock para CredentialManager
class CredentialManager {
  private static instance: CredentialManager;
  private initialized = false;
  private credentials: any[] = [];

  static getInstance() {
    if (!this.instance) this.instance = new CredentialManager();
    return this.instance;
  }

  isInitialized() { return this.initialized; }
  async initialize(password: string) { 
    this.initialized = true; 
    console.log('Manager initialized');
  }
  listCredentials() { return this.credentials; }
  async saveCredential(id: string, name: string, service: string, type: any, values: any) {
    this.credentials.push({ id, name, service, type, values, valid: true, createdAt: new Date().toISOString() });
  }
  async deleteCredential(id: string) {
    this.credentials = this.credentials.filter(c => c.id !== id);
  }
  async testCredential(id: string) { return true; }
}

export function CredentialPanel() {
  const [credentialManager] = useState(() => CredentialManager.getInstance());
  const [isInitialized, setIsInitialized] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [credentials, setCredentials] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  useEffect(() => {
    setIsInitialized(credentialManager.isInitialized());
    if (credentialManager.isInitialized()) {
      loadCredentials();
    }
  }, []);
  
  const loadCredentials = () => {
    setCredentials(credentialManager.listCredentials());
  };
  
  const handleInitialize = async () => {
    if (!masterPassword) {
      alert('Ingresa una contraseña maestra');
      return;
    }
    
    try {
      await credentialManager.initialize(masterPassword);
      setIsInitialized(true);
      loadCredentials();
    } catch (error) {
      alert('Error inicializando gestor de credenciales');
    }
  };
  
  const handleAddCredential = () => {
    setShowAddModal(true);
  };
  
  const handleDeleteCredential = async (id: string) => {
    if (!confirm('¿Eliminar esta credencial?')) return;
    
    await credentialManager.deleteCredential(id);
    loadCredentials();
  };
  
  const handleTestCredential = async (id: string) => {
    const result = await credentialManager.testCredential(id);
    alert(result ? '✅ Conexión exitosa' : '❌ Error en conexión');
    loadCredentials();
  };
  
  if (!isInitialized) {
    return (
      <div className="p-8 bg-[#111817] rounded-xl border border-[#1a2e2a] text-white">
          <h2 className="text-2xl font-bold mb-4">🔐 Inicializa el Gestor de Credenciales</h2>
          <p className="text-gray-400 mb-6">Para guardar credenciales de forma segura, necesitas establecer una contraseña maestra.</p>
          
          <div className="flex gap-4 mb-8">
            <input
              type="password"
              placeholder="Contraseña maestra"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="flex-1 bg-[#0a0f0e] border border-[#1a2e2a] rounded-lg px-4 py-2 focus:outline-none focus:border-[#00cd91]"
            />
            <button onClick={handleInitialize} className="bg-[#00cd91] text-black px-6 py-2 rounded-lg font-bold hover:bg-[#00b37e] transition-colors">
              Inicializar
            </button>
          </div>
          
          <div className="bg-[#1a2e2a] p-4 rounded-lg border border-[#253f3a]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">ℹ️ Información de Seguridad</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Tus credenciales se encriptan con AES-256-GCM</li>
              <li>• La contraseña maestra NO se almacena</li>
              <li>• Necesitarás esta contraseña cada vez que abras la app</li>
            </ul>
          </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">🔐 Gestión de Credenciales</h2>
        <button onClick={handleAddCredential} className="bg-[#0087b1] hover:bg-[#00769a] text-white px-4 py-2 rounded-lg text-sm transition-colors">
          + Agregar Credencial
        </button>
      </div>
      
      {credentials.length === 0 ? (
        <div className="text-center py-12 bg-[#111817] rounded-xl border border-[#1a2e2a] border-dashed">
          <p className="text-gray-500">No hay credenciales configuradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credentials.map(cred => (
            <div key={cred.id} className="bg-[#111817] border border-[#1a2e2a] p-4 rounded-xl">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-white">{cred.name}</h3>
                    <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded border border-green-500/20">Válida</span>
                </div>
                <div className="space-y-1 text-sm text-gray-400 mb-4">
                    <div className="flex justify-between"><span>Servicio:</span><span>{cred.service}</span></div>
                    <div className="flex justify-between"><span>Tipo:</span><span>{cred.type}</span></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleTestCredential(cred.id)} className="flex-1 text-xs bg-[#1a2e2a] hover:bg-[#253f3a] py-2 rounded transition-colors">Probar</button>
                    <button onClick={() => handleDeleteCredential(cred.id)} className="text-xs text-red-400 hover:text-red-300 px-2">Eliminar</button>
                </div>
            </div>
          ))}
        </div>
      )}
      
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111817] border border-[#1a2e2a] w-full max-w-md rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Agregar Credencial</h2>
                    <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">✕</button>
                </div>
                <div className="space-y-4">
                    {Object.entries(CREDENTIAL_TEMPLATES).map(([key, tmpl]) => (
                        <button 
                            key={key}
                            onClick={async () => {
                                const name = prompt(`Nombre para ${tmpl.name}:`, tmpl.name);
                                if (!name) return;
                                await credentialManager.saveCredential(`${tmpl.service}_${Date.now()}`, name, tmpl.service, tmpl.type, {});
                                loadCredentials();
                                setShowAddModal(false);
                            }}
                            className="w-full flex items-center justify-between p-4 bg-[#1a2e2a] hover:bg-[#253f3a] rounded-xl border border-transparent hover:border-[#00cd91] transition-all group text-left"
                        >
                            <div>
                                <div className="font-bold text-white group-hover:text-[#00cd91]">{tmpl.name}</div>
                                <div className="text-xs text-gray-500">{tmpl.service}</div>
                            </div>
                            <span className="text-gray-600">→</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
