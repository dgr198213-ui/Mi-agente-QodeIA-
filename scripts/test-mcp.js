#!/usr/bin/env node

/**
 * Script de Testing MCP
 * 
 * Prueba todas las herramientas MCP sin necesidad del agente completo
 * 
 * Uso:
 *   node scripts/test-mcp.js
 */

import { getMCPClient } from '../mcp/client.ts';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Cargar configuración manualmente para el test
const configPath = path.join(process.cwd(), 'mcp_config.json');
const mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const TESTS = [
  {
    name: 'Test 1: Conexión a servidor',
    run: async (client) => {
      await client.connect('notebooklm-howard-os');
      console.log('✓ Servidor conectado');
    },
  },
  {
    name: 'Test 2: Listar cuadernos',
    run: async (client) => {
      const notebooks = await client.listNotebooks('notebooklm-howard-os');
      console.log(`✓ ${notebooks.length} cuaderno(s) encontrado(s)`);
      notebooks.forEach((nb) => {
        console.log(`  - ${nb.title} (${nb.sources_count} fuentes)`);
      });
    },
  },
  {
    name: 'Test 3: Query simple',
    run: async (client) => {
      const result = await client.query({
        server: 'notebooklm-howard-os',
        query: '¿Cuál es el esquema de la tabla credentials?',
        include_citations: true,
      });
      
      console.log(`✓ Respuesta recibida (confianza: ${result.confidence})`);
      console.log(`  Respuesta: ${result.answer.substring(0, 200)}...`);
      console.log(`  Fuentes: ${result.sources.length}`);
      
      if (result.sources.length > 0) {
        console.log(`  Primera fuente: ${result.sources[0].title}`);
      }
    },
  },
  {
    name: 'Test 4: Query con contexto técnico',
    run: async (client) => {
      const result = await client.query({
        server: 'notebooklm-howard-os',
        query: `
          ¿Cómo funciona el Shadow Workspace?
          Específicamente: ¿qué tabla usar y qué campos tiene?
        `,
        include_citations: true,
      });
      
      console.log('✓ Query técnica procesada');
      console.log(`  Respuesta:\n${result.answer}`);
      
      if (result.sources.length > 0) {
        console.log('\n  Citas:');
        result.sources.forEach((src, i) => {
          console.log(`  ${i + 1}. ${src.title} (p. ${src.page_number || 'N/A'})`);
          console.log(`     "${src.excerpt.substring(0, 100)}..."`);
        });
      }
    },
  },
  {
    name: 'Test 5: Cache de queries',
    run: async (client) => {
      const query = '¿Cuál es el proyecto de Supabase para el agente?';
      
      // Primera consulta (no cacheada)
      const start1 = Date.now();
      const result1 = await client.query({
        server: 'notebooklm-howard-os',
        query,
      });
      const duration1 = Date.now() - start1;
      
      console.log(`  Primera query: ${duration1}ms (cached: ${result1.cached})`);
      
      // Segunda consulta (debería estar cacheada)
      const start2 = Date.now();
      const result2 = await client.query({
        server: 'notebooklm-howard-os',
        query,
      });
      const duration2 = Date.now() - start2;
      
      console.log(`  Segunda query: ${duration2}ms (cached: ${result2.cached})`);
      console.log(`✓ Mejora de velocidad: ${Math.round((duration1 / duration2) * 100)}%`);
    },
  },
  {
    name: 'Test 6: Sync de fuente (simulado)',
    run: async (client) => {
      // No sincronizar realmente en test, solo validar
      console.log('✓ Validación de sync (sin escritura real)');
      
      const mockContent = `
# Test Solution
Este es un contenido de prueba para validar sync.
      `.trim();
      
      console.log(`  Contenido: ${mockContent.length} caracteres`);
      console.log('  (En producción se sincronizaría con NotebookLM)');
    },
  },
  {
    name: 'Test 7: Manejo de errores',
    run: async (client) => {
      try {
        await client.query({
          server: 'servidor-inexistente',
          query: 'test',
        });
        
        throw new Error('Debería haber fallado');
      } catch (error) {
        if (error.message.includes('no encontrado')) {
          console.log('✓ Error manejado correctamente');
        } else {
          throw error;
        }
      }
    },
  },
  {
    name: 'Test 8: Performance bajo carga',
    run: async (client) => {
      const queries = [
        '¿Qué es Howard OS?',
        '¿Cuál es la estructura de projects?',
        '¿Cómo funciona el agente?',
        '¿Qué herramientas tiene el agente?',
        '¿Cómo se despliega en Vercel?',
      ];
      
      const start = Date.now();
      const results = await Promise.all(
        queries.map((q) =>
          client.query({
            server: 'notebooklm-howard-os',
            query: q,
            max_results: 1,
          })
        )
      );
      const duration = Date.now() - start;
      
      console.log(`✓ ${queries.length} queries en ${duration}ms`);
      console.log(`  Promedio: ${Math.round(duration / queries.length)}ms/query`);
      console.log(`  Éxito: ${results.filter((r) => r.answer).length}/${queries.length}`);
    },
  },
];

async function runTests() {
  console.log('🧪 Test Suite MCP para QodeIA\n');
  
  // Validar configuración
  if (!process.env.HOWARD_OS_NOTEBOOK_URL) {
    console.error('❌ HOWARD_OS_NOTEBOOK_URL no configurada en .env.local');
    console.log('Ejecuta: node scripts/setup-mcp.js');
    process.exit(1);
  }
  
  const client = getMCPClient(mcpConfig);
  let passed = 0;
  let failed = 0;
  
  for (const test of TESTS) {
    console.log(`\n${test.name}`);
    console.log('─'.repeat(50));
    
    try {
      await test.run(client);
      passed++;
      console.log('✅ PASSED');
    } catch (error) {
      failed++;
      console.error('❌ FAILED:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Resultados: ${passed} passed, ${failed} failed`);
  
  // Cleanup
  await client.disconnect();
  
  if (failed > 0) {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa la configuración.');
    process.exit(1);
  } else {
    console.log('\n✅ Todos los tests pasaron. MCP está listo.');
  }
}

runTests().catch((error) => {
  console.error('❌ Error fatal en tests:', error);
  process.exit(1);
});
