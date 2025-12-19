
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN - PEGA TUS CREDENCIALES AQUÍ
// ==============================================================================

const SUPABASE_URL = "PEGAR_TU_SUPABASE_URL_AQUI"; 
const SUPABASE_SERVICE_KEY = "PEGAR_TU_SUPABASE_SERVICE_KEY_AQUI";

// ==============================================================================

if (SUPABASE_URL.includes("PEGAR_TU") || SUPABASE_SERVICE_KEY.includes("PEGAR_TU")) {
    console.error("❌ ERROR: Edita el archivo scripts/delete-orphans.js y pega las credenciales (SERVICE KEY).");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function deleteOrphans() {
    console.log("🧹 Iniciando limpieza profunda de huérfanos...");

    // 1. Obtener lista de IDs de estudiantes válidos
    const { data: students, error: stError } = await supabase.from('estudiantes').select('id');
    if (stError) { console.error("Error leyendo estudiantes:", stError); return; }
    
    const validStudentIds = new Set(students.map(s => s.id));
    console.log(`✅ ${validStudentIds.size} estudiantes válidos encontrados.`);

    // --- LIMPIEZA DE PRÁCTICAS ---
    console.log("\n🔍 Analizando Prácticas...");
    const { data: practicas } = await supabase.from('practicas').select('id, estudiante_id');
    
    const practicasToDelete = [];
    practicas.forEach(p => {
        if (!p.estudiante_id || !validStudentIds.has(p.estudiante_id)) {
            practicasToDelete.push(p.id);
        }
    });

    if (practicasToDelete.length > 0) {
        console.log(`   ⚠️  Se encontraron ${practicasToDelete.length} prácticas huérfanas (Desconocido). Eliminando...`);
        const { error: delError } = await supabase.from('practicas').delete().in('id', practicasToDelete);
        if (delError) console.error("Error eliminando prácticas:", delError);
        else console.log("   🗑️  Prácticas eliminadas.");
    } else {
        console.log("   ✨ No hay prácticas huérfanas.");
    }

    // --- LIMPIEZA DE SOLICITUDES ---
    console.log("\n🔍 Analizando Solicitudes PPS...");
    const { data: solicitudes } = await supabase.from('solicitudes_pps').select('id, estudiante_id');
    
    const solicitudesToDelete = [];
    solicitudes.forEach(s => {
        if (!s.estudiante_id || !validStudentIds.has(s.estudiante_id)) {
            solicitudesToDelete.push(s.id);
        }
    });

    if (solicitudesToDelete.length > 0) {
        console.log(`   ⚠️  Se encontraron ${solicitudesToDelete.length} solicitudes huérfanas. Eliminando...`);
        const { error: delError } = await supabase.from('solicitudes_pps').delete().in('id', solicitudesToDelete);
        if (delError) console.error("Error eliminando solicitudes:", delError);
        else console.log("   🗑️  Solicitudes eliminadas.");
    } else {
        console.log("   ✨ No hay solicitudes huérfanas.");
    }
    
    console.log("\n🏁 Limpieza finalizada. Recarga tu panel de administrador.");
}

deleteOrphans();
