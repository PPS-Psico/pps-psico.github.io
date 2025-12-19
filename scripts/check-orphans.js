
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN DE DIAGNÓSTICO
// ==============================================================================

const SUPABASE_URL = "PEGAR_AQUI_TU_SUPABASE_URL"; 
const SUPABASE_SERVICE_KEY = "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

// ==============================================================================

if (SUPABASE_URL.includes("PEGAR_AQUI") || SUPABASE_SERVICE_KEY.includes("PEGAR_AQUI")) {
    console.error("❌ ERROR: Pega las credenciales en scripts/check-orphans.js antes de ejecutar.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkOrphans() {
    console.log("🕵️  Iniciando escaneo de prácticas huérfanas...");

    // 1. Obtener todas las prácticas
    const { data: practicas, error } = await supabase
        .from('practicas')
        .select('id, estudiante_id, lanzamiento_id, nombre_institucion, airtable_id');
        
    if (error) {
        console.error("❌ Error al leer prácticas:", error.message);
        return;
    }

    let orphans = 0;
    let missingLaunch = 0;
    let missingStudent = 0;

    console.log(`📊 Total de prácticas en DB: ${practicas.length}`);
    console.log("--- DETALLE DE HUÉRFANOS ---");

    for (const p of practicas) {
        let isOrphan = false;

        // Check if student exists
        if (!p.estudiante_id) {
             // Es huérfana de estudiante
             isOrphan = true;
             missingStudent++;
        }

        // Check if launch exists
        if (!p.lanzamiento_id) {
             isOrphan = true;
             missingLaunch++;
        }

        if (isOrphan) {
            orphans++;
            // Try to find the student in DB if we have an Airtable ID link in 'estudiante_id' but it failed foreign key lookup?
            // Actually, if it's NULL, it's NULL.
            console.log(`⚠️  Práctica ID: ${p.id} (Airtable: ${p.airtable_id || 'N/A'})`);
            console.log(`   Institución (Texto): ${p.nombre_institucion || 'VACÍO'}`);
            console.log(`   Problema: ${!p.estudiante_id ? 'Falta Estudiante' : ''} ${!p.lanzamiento_id ? 'Falta Lanzamiento' : ''}`);
        }
    }

    console.log("\n--- RESUMEN ---");
    console.log(`Practicas con problemas: ${orphans}`);
    console.log(`Falta Estudiante (Vinculación): ${missingStudent}`);
    console.log(`Falta Lanzamiento (Institución): ${missingLaunch}`);
    
    if (orphans > 0) {
        console.log("\n💡 RECOMENDACIÓN:");
        console.log("Si estas prácticas son residuos de pruebas o errores de migración, puedes borrarlas.");
        console.log("Si son datos históricos valiosos, deberás vincularlas manualmente a un estudiante o lanzamiento desde el Editor DB.");
    } else {
        console.log("\n✅ La base de datos de prácticas parece saludable.");
    }
}

checkOrphans();
