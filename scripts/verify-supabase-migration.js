const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Faltan variables de entorno en .env.local');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('--- Iniciando Verificación de Migración QodeIA ---');

  // 1. Verificar Tablas Nuevas
  const tables = ['conversations', 'cme_sync_state', 'usage_stats'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`❌ Tabla "${table}" no encontrada o inaccesible:`, error.message);
    } else {
      console.log(`✅ Tabla "${table}" verificada.`);
    }
  }

  // 2. Verificar Columnas Añadidas
  const { error: colError } = await supabase.from('messages').select('project_id, conversation_id').limit(1);
  if (colError) {
    console.error('❌ Columnas project_id/conversation_id no encontradas en "messages":', colError.message);
  } else {
    console.log('✅ Columnas en "messages" verificadas.');
  }

  // 3. Verificar Funciones RPC
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { data: stats, error: rpcError } = await supabase.rpc('get_project_stats', { p_project_id: dummyId });
  if (rpcError) {
    console.error('❌ Función RPC "get_project_stats" falló:', rpcError.message);
  } else {
    console.log('✅ Función RPC "get_project_stats" operativa.');
  }

  console.log('--- Verificación Finalizada ---');
}

verifyMigration();
