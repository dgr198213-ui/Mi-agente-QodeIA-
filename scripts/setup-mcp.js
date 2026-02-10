#!/usr/bin/env node

/**
 * Script de Setup MCP para QodeIA
 * 
 * Instala y configura el servidor MCP de NotebookLM
 * 
 * Uso:
 *   node scripts/setup-mcp.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('🔧 Configuración MCP para QodeIA\n');

  // 1. Verificar Node.js
  console.log('✓ Verificando Node.js...');
  const nodeVersion = process.version;
  if (parseInt(nodeVersion.slice(1)) < 18) {
    console.error('❌ Node.js 18+ requerido. Versión actual:', nodeVersion);
    process.exit(1);
  }

  // 2. Instalar notebooklm-mcp
  console.log('\n📦 Instalando notebooklm-mcp...');
  await runCommand('npm', ['install', '-g', 'notebooklm-mcp@latest']);

  // 3. Autenticación
  console.log('\n🔐 Autenticación con NotebookLM');
  console.log('Se abrirá Chrome para iniciar sesión en tu cuenta de Google...\n');
  
  const shouldAuth = await question('¿Continuar con autenticación? (y/n): ');
  if (shouldAuth.toLowerCase() === 'y') {
    await runCommand('notebooklm-mcp-auth', []);
  } else {
    console.log('⚠️  Puedes autenticar más tarde con: notebooklm-mcp-auth');
  }

  // 4. Configurar cuadernos
  console.log('\n📚 Configuración de Cuadernos');
  
  const notebooks = {
    HOWARD_OS_NOTEBOOK_URL: 'Cuaderno de Howard OS (arquitectura)',
    SOLUCIONES_NOTEBOOK_URL: 'Cuaderno de Soluciones (patrones)',
    ECOSISTEMA_NOTEBOOK_URL: 'Cuaderno del Ecosistema (cross-repo)',
  };

  const envVars = {};
  
  for (const [key, description] of Object.entries(notebooks)) {
    const url = await question(`URL de ${description}: `);
    if (url.trim()) {
      envVars[key] = url.trim();
    }
  }

  // 5. Obtener cookie de autenticación
  console.log('\n🍪 Obteniendo cookie de autenticación...');
  const cookieFile = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.notebooklm-mcp',
    'auth.json'
  );

  let authCookie = '';
  if (fs.existsSync(cookieFile)) {
    try {
      const authData = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
      authCookie = authData.cookie || '';
      console.log('✓ Cookie encontrada');
    } catch (error) {
      console.warn('⚠️  No se pudo leer cookie. Configúrala manualmente.');
    }
  }

  envVars.NOTEBOOKLM_COOKIE = authCookie;

  // 6. Actualizar .env
  console.log('\n📝 Actualizando .env...');
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Añadir variables MCP
  envContent += '\n# MCP Configuration\n';
  for (const [key, value] of Object.entries(envVars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}="${value}"`;
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, line);
    } else {
      envContent += `${line}\n`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✓ Variables de entorno actualizadas');

  // 7. Crear cuadernos iniciales (si no existen)
  console.log('\n📚 Subiendo documentación inicial...');
  
  const createInitial = await question(
    '¿Subir PDFs existentes a NotebookLM? (y/n): '
  );
  
  if (createInitial.toLowerCase() === 'y') {
    await uploadInitialDocs(envVars);
  }

  // 8. Test de conectividad
  console.log('\n🧪 Probando conexión...');
  await testMCPConnection(envVars.HOWARD_OS_NOTEBOOK_URL);

  console.log('\n✅ ¡Configuración completada!');
  console.log('\nPróximos pasos:');
  console.log('1. Reinicia el servidor de desarrollo');
  console.log('2. Prueba: node scripts/test-mcp.js');
  console.log('3. Activa MCP en el agente (ver agent/core/agent_with_mcp.ts)');

  rl.close();
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comando falló con código ${code}`));
      }
    });
  });
}

async function uploadInitialDocs(envVars) {
  console.log('Buscando PDFs en /mnt/user-data/uploads...');
  
  const uploadsDir = '/mnt/user-data/uploads';
  if (!fs.existsSync(uploadsDir)) {
    console.log('⚠️  Directorio de uploads no encontrado');
    return;
  }

  const pdfs = fs
    .readdirSync(uploadsDir)
    .filter((f) => f.endsWith('.pdf'));

  if (pdfs.length === 0) {
    console.log('No se encontraron PDFs');
    return;
  }

  console.log(`Encontrados ${pdfs.length} PDFs:`);
  pdfs.forEach((pdf) => console.log(`  - ${pdf}`));

  console.log('\n📤 Sube estos archivos manualmente a tus cuadernos:');
  console.log(`1. Ve a ${envVars.HOWARD_OS_NOTEBOOK_URL}`);
  console.log(`2. Haz clic en "Add source" > "Upload"`);
  console.log(`3. Selecciona los PDFs del directorio ${uploadsDir}`);
  
  await question('\nPresiona Enter cuando hayas terminado...');
}

async function testMCPConnection(notebookUrl) {
  if (!notebookUrl) {
    console.log('⚠️  No se configuró URL del cuaderno. Saltando test.');
    return;
  }

  try {
    console.log('Enviando query de prueba...');
    
    // Test simple usando CLI de notebooklm-mcp
    await runCommand('npx', [
      'notebooklm-mcp@latest',
      'query',
      `--notebook=${notebookUrl}`,
      '--query=¿Cuál es el proyecto de Supabase para Howard OS?',
    ]);
    
    console.log('✓ Conexión exitosa');
  } catch (error) {
    console.error('❌ Error en test de conexión:', error.message);
    console.log('Verifica la configuración manualmente');
  }
}

main().catch((error) => {
  console.error('❌ Error en setup:', error);
  process.exit(1);
});
