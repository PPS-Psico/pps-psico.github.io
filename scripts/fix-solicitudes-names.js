
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN
// ==============================================================================

const SUPABASE_URL = "PEGAR_TU_SUPABASE_URL_AQUI"; 
const SUPABASE_SERVICE_KEY = "PEGAR_TU_SUPABASE_SERVICE_KEY_AQUI";

// ==============================================================================

if (SUPABASE_URL.includes("PEGAR") || SUPABASE_SERVICE_KEY.includes("PEGAR")) {
    console.error("❌ ERROR: Edita scripts/fix-solicitudes-names.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fixNames() {
    console.log("🚑 Iniciando reparación INTELIGENTE de Solicitudes PPS...");

    // 1. Obtener TODAS las solicitudes (incluso las desvinculadas)
    const { data: solicitudes, error } = await supabase
        .from('solicitudes_pps')
        .select('id, estudiante_id, nombre_alumno, legajo, email');

    if (error) {
        console.error("Error leyendo solicitudes:", error);
        return;
    }

    console.log(`🔍 Analizando ${solicitudes.length} solicitudes en total...`);

    // 2. Obtener mapa completo de estudiantes para buscar coincidencias
    const { data: students } = await supabase
        .from('estudiantes')
        .select('id, nombre, legajo, correo');
    
    // Mapas para búsqueda rápida
    const studentMapById = new Map(students.map(s => [s.id, s]));
    const studentMapByLegajo = new Map(students.map(s => [String(s.legajo).trim(), s]));

    let fixedCount = 0;
    let linkedCount = 0;

    for (const req of solicitudes) {
        let needsUpdate = false;
        let updates = {};

        const currentName = req.nombre_alumno || '';
        const currentLegajo = String(req.legajo || '').trim();
        const currentId = req.estudiante_id;

        // Detectar si el nombre está roto o falta
        const isNameBad = !currentName || currentName === 'Estudiante' || currentName.startsWith('rec');

        let student = null;

        // Estrategia A: Si ya tiene ID, buscar estudiante
        if (currentId) {
            student = studentMapById.get(currentId);
        }

        // Estrategia B: Si no tiene ID o no se encontró, buscar por LEGAJO (si existe en la solicitud)
        if (!student && currentLegajo && currentLegajo !== '---') {
            student = studentMapByLegajo.get(currentLegajo);
            if (student) {
                // ¡Encontramos al dueño! Vinculamos
                updates.estudiante_id = student.id;
                linkedCount++;
                needsUpdate = true;
            }
        }

        // Si logramos identificar al estudiante, verificamos si hay que arreglar datos
        if (student) {
            // Arreglar nombre si está mal
            if (isNameBad) {
                updates.nombre_alumno = student.nombre;
                needsUpdate = true;
            }
            // Rellenar legajo snapshot si falta
            if (!req.legajo || req.legajo === '---') {
                updates.legajo = student.legajo;
                needsUpdate = true;
            }
            // Rellenar email snapshot si falta
            if (!req.email) {
                updates.email = student.correo;
                needsUpdate = true;
            }
        }

        // Aplicar cambios si corresponde
        if (needsUpdate) {
            const { error: updateError } = await supabase
                .from('solicitudes_pps')
                .update(updates)
                .eq('id', req.id);

            if (updateError) {
                console.error(`   ❌ Error actualizando ID ${req.id}:`, updateError.message);
            } else {
                fixedCount++;
                process.stdout.write(".");
            }
        }
    }

    console.log(`\n\n✅ Finalizado.`);
    console.log(`   - Solicitudes analizadas: ${solicitudes.length}`);
    console.log(`   - Vínculos recuperados (por legajo): ${linkedCount}`);
    console.log(`   - Registros corregidos: ${fixedCount}`);
}

fixNames();
