/**
 * Script de verificación de integración MCP (JS)
 */
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando archivos de integración...');

const files = [
  'mcp/client.ts',
  'agent/tools/mcp_notebooklm.ts',
  'agent/core/agent_with_mcp.ts',
  'hooks/mcp-sync.ts',
  'scripts/setup-mcp.js',
  'scripts/test-mcp.js',
  'mcp_config.json'
];

let allExist = true;
files.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file} existe`);
  } else {
    console.log(`❌ ${file} NO existe`);
    allExist = false;
  }
});

console.log('\n🔍 Verificando dependencias...');
try {
  const pkg = require('../package.json');
  const deps = pkg.dependencies || {};
  if (deps['notebooklm-mcp']) {
    console.log(`✅ notebooklm-mcp está en package.json (${deps['notebooklm-mcp']})`);
  } else {
    console.log('❌ notebooklm-mcp NO está en package.json');
    allExist = false;
  }
} catch (e) {
  console.log('❌ No se pudo leer package.json');
  allExist = false;
}

if (allExist) {
  console.log('\n✨ La integración de archivos y dependencias se ha completado con éxito.');
  console.log('Nota: Para ejecutar los tests funcionales, se requiere una configuración válida de NotebookLM.');
} else {
  console.log('\n⚠️ Faltan algunos componentes de la integración.');
  process.exit(1);
}
