
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN DE EMERGENCIA
// ==============================================================================

const SUPABASE_URL = "PEGAR_AQUI_TU_SUPABASE_URL"; 
const SUPABASE_SERVICE_KEY = "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

// ==============================================================================

if (SUPABASE_URL.includes("PEGAR_AQUI") || SUPABASE_SERVICE_KEY.includes("PEGAR_AQUI")) {
    console.error("❌ ERROR: Pega las credenciales en scripts/revert-migration.js antes de ejecutar.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function revertSolicitudes() {
    console.log("🚨 INICIANDO PROTOCOLO DE REVERSIÓN DE SOLICITUDES 🚨");
    
    // Definir el umbral de tiempo (ej: registros creados en las últimas 24 horas)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24); 
    const isoDate = cutoffDate.toISOString();

    console.log(`🔍 Buscando registros creados después de: ${isoDate}`);
    console.log(`   Criterio: Tienen 'airtable_id' (creados por migración) y son recientes.`);

    // 1. Seleccionar los registros "invasores"
    const { data: badRecords, error: fetchError } = await supabase
        .from('solicitudes_pps')
        .select('id, nombre_alumno, nombre_institucion, created_at')
        .not('airtable_id', 'is', null) // Solo los que trajo la migración
        .gt('created_at', isoDate);     // Solo los creados recientemente

    if (fetchError) {
        console.error("❌ Error al buscar registros:", fetchError.message);
        return;
    }

    if (!badRecords || badRecords.length === 0) {
        console.log("✅ No se encontraron registros recientes de migración para eliminar.");
        return;
    }

    console.log(`⚠️  Se encontraron ${badRecords.length} registros duplicados/migrados recientemente.`);
    console.log(`   Ejemplo: ${badRecords[0].nombre_alumno} - ${badRecords[0].nombre_institucion}`);

    // Confirmación visual (espera 5 segundos antes de borrar por seguridad)
    console.log("\n⏳ Eliminando en 5 segundos... (Ctrl+C para cancelar)");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. Eliminar por lotes
    const idsToDelete = badRecords.map(r => r.id);
    const batchSize = 100;
    
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        
        const { error: deleteError } = await supabase
            .from('solicitudes_pps')
            .delete()
            .in('id', batch);

        if (deleteError) {
            console.error(`❌ Error borrando lote ${i}:`, deleteError.message);
        } else {
            console.log(`✅ Eliminados ${batch.length} registros...`);
        }
    }

    console.log("\n🏁 REVERSIÓN COMPLETADA. Verifica tu aplicación.");
}

revertSolicitudes();
