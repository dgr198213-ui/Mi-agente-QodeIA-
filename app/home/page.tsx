/**
 * Landing Page Pública - QodeIA
 * Página de inicio sin requerir autenticación
 * Objetivo: Captar leads y presentar el ecosistema
 */

import Link from 'next/link';
import { ArrowRight, Code2, Zap, Users, BookOpen, Github, Mail } from 'lucide-react';

export const metadata = {
  title: 'QodeIA - Ecosistema AI para Builders Hispanohablantes',
  description: 'Agente autónomo, IDE contextual y comunidad para desarrolladores de habla hispana',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header/Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Code2 size={20} className="text-slate-950 font-bold" />
            </div>
            <span className="text-xl font-bold text-emerald-400">QodeIA</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="https://mi-agente-qode-ia.vercel.app" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition">QodeIA Agent</a>
            <a href="https://plataforma-qd.vercel.app" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition">QodeIA Howard</a>
            <a href="https://web-qode-ia.vercel.app" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition">QodeIA Community</a>
            <a href="#contacto" className="text-slate-300 hover:text-white transition">Contacto</a>
          </nav>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-lg font-semibold hover:bg-emerald-400 transition"
          >
            Acceder
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Construye Mejor con IA
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
            QodeIA es un ecosistema completo de herramientas AI para builders hispanohablantes. 
            Agente autónomo, IDE contextual y comunidad en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-emerald-500 text-slate-950 rounded-lg font-semibold hover:bg-emerald-400 transition flex items-center justify-center gap-2"
            >
              Comenzar Ahora <ArrowRight size={20} />
            </Link>
            <button
              onClick={() => {
                const email = prompt('Ingresa tu email para acceso temprano:');
                if (email) {
                  console.log('Email registrado:', email);
                  alert('¡Gracias! Te contactaremos pronto.');
                }
              }}
              className="px-8 py-3 border border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500/10 transition"
            >
              Acceso Temprano
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400 mb-2">4+</div>
            <p className="text-slate-300">Herramientas MCP Integradas</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400 mb-2">19+</div>
            <p className="text-slate-300">Integraciones Externas</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400 mb-2">70%</div>
            <p className="text-slate-300">Compresión de Contexto</p>
          </div>
        </div>
      </section>

      {/* Producto Section */}
      <section id="producto" className="bg-slate-900/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">El Ecosistema QodeIA</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Agente */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:border-emerald-500/50 transition">
              <Zap className="text-emerald-400 mb-4" size={32} />
              <h3 className="text-xl font-bold mb-3">Agente Autónomo</h3>
              <p className="text-slate-300 mb-4">
                Ejecuta tareas complejas con acceso a GitHub, Supabase, Vercel y NotebookLM.
              </p>
              <ul className="text-sm text-slate-400 space-y-2">
                <li>✓ Gobernanza PageRank</li>
                <li>✓ Memoria Contextual (CME)</li>
                <li>✓ Multi-LLM (Groq, DeepSeek, Gemini)</li>
              </ul>
            </div>

            {/* IDE */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:border-emerald-500/50 transition">
              <Code2 className="text-cyan-400 mb-4" size={32} />
              <h3 className="text-xl font-bold mb-3">QodeIA Howard</h3>
              <p className="text-slate-300 mb-4">
                IDE contextual con editor de código, gestión de credenciales y análisis.
              </p>
              <ul className="text-sm text-slate-400 space-y-2">
                <li>✓ Editor Monaco integrado</li>
                <li>✓ Bias Firewall & Hype Detector</li>
                <li>✓ Context Memory Visualizer</li>
              </ul>
            </div>

            {/* Comunidad */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:border-emerald-500/50 transition">
              <Users className="text-blue-400 mb-4" size={32} />
              <h3 className="text-xl font-bold mb-3">Comunidad</h3>
              <p className="text-slate-300 mb-4">
                Conecta con otros builders en QodeIA Community, comparte proyectos y aprende juntos.
              </p>
              <ul className="text-sm text-slate-400 space-y-2">
                <li>✓ Perfiles de Builder</li>
                <li>✓ Proyectos Compartidos</li>
                <li>✓ Guías MCP en Español</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Recursos Section */}
      <section id="recursos" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Recursos & Documentación</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8">
              <BookOpen className="text-emerald-400 mb-4" size={32} />
              <h3 className="text-xl font-bold mb-3">Guías Técnicas</h3>
              <p className="text-slate-300">
                Documentación completa sobre cómo usar el agente, configurar MCP y optimizar tu flujo de trabajo.
              </p>
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8">
              <Github className="text-blue-400 mb-4" size={32} />
              <h3 className="text-xl font-bold mb-3">Código Abierto</h3>
              <p className="text-slate-300">
                Todos nuestros repositorios están disponibles en GitHub. Contribuye y mejora el ecosistema.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contacto" className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">¿Listo para Construir?</h2>
          <p className="text-xl text-slate-300 mb-8">
            Únete a la comunidad de builders hispanohablantes que están transformando el desarrollo con IA.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-emerald-500 text-slate-950 rounded-lg font-semibold hover:bg-emerald-400 transition"
            >
              Acceder al Dashboard
            </Link>
            <a
              href="mailto:hola@qodeia.dev"
              className="px-8 py-3 border border-emerald-500 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500/10 transition flex items-center justify-center gap-2"
            >
              <Mail size={20} /> Contactar
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">QodeIA</h4>
              <p className="text-slate-400 text-sm">
                Ecosistema AI para builders hispanohablantes.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Producto</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="https://mi-agente-qode-ia.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">QodeIA Agent</a></li>
                <li><a href="https://plataforma-qd.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">QodeIA Howard</a></li>
                <li><a href="https://web-qode-ia.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">QodeIA Community</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Recursos</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="/docs" className="hover:text-white transition">Documentación</a></li>
                <li><a href="https://github.com/dgr198213-ui" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a></li>
                <li><a href="https://web-qode-ia.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacidad</a></li>
                <li><a href="#" className="hover:text-white transition">Términos</a></li>
                <li><a href="#" className="hover:text-white transition">Contacto</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-400 text-sm">
            <p>&copy; 2026 QodeIA. Construido por builders, para builders.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
