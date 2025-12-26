
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN DE CREDENCIALES
// ==============================================================================

const AIRTABLE_PAT = "PEGAR_AQUI_TU_AIRTABLE_PAT"; 
const AIRTABLE_BASE_ID = "PEGAR_AQUI_TU_BASE_ID"; 

const SUPABASE_URL = "PEGAR_AQUI_TU_SUPABASE_URL"; 
// ¡IMPORTANTE! Usar la SERVICE_ROLE_KEY para permisos de escritura
const SUPABASE_SERVICE_KEY = "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

// ==============================================================================

if (AIRTABLE_PAT.includes("PEGAR") || SUPABASE_URL.includes("PEGAR")) {
    console.error("❌ ERROR: Edita scripts/fix-data-integrity.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;

// --- 1. REPARACIÓN DE NOMBRES EN SOLICITUDES PPS ---
async function fixSolicitudesNames() {
    console.log("\n🛠️  FASE 1: Reparando Nombres en Solicitudes de PPS...");

    // 1. Obtener todas las solicitudes que tienen estudiante pero les faltan datos visuales (o todos para asegurar)
    // Traemos también estudiantes para hacer el cruce en memoria
    const { data: solicitudes, error: solError } = await supabase
        .from('solicitudes_pps')
        .select('id, estudiante_id, nombre_alumno, legajo')
        .not('estudiante_id', 'is', null);

    if (solError) { console.error("Error leyendo solicitudes:", solError); return; }

    const { data: estudiantes, error: estError } = await supabase
        .from('estudiantes')
        .select('id, nombre, legajo, correo');

    if (estError) { console.error("Error leyendo estudiantes:", estError); return; }

    // Mapa de estudiantes para acceso rápido
    const studentMap = new Map(estudiantes.map(s => [s.id, s]));

    let updates = [];
    
    for (const sol of solicitudes) {
        const student = studentMap.get(sol.estudiante_id);
        
        if (student) {
            // Verificamos si faltan datos o son diferentes
            const needsUpdate = !sol.nombre_alumno || !sol.legajo || sol.nombre_alumno === 'Estudiante';
            
            if (needsUpdate) {
                updates.push({
                    id: sol.id,
                    nombre_alumno: student.nombre,
                    legajo: student.legajo,
                    email: student.correo // También actualizamos el email por si acaso
                });
            }
        }
    }

    if (updates.length === 0) {
        console.log("   ✅ No se encontraron solicitudes con nombres faltantes.");
    } else {
        console.log(`   📝 Actualizando ${updates.length} solicitudes con datos del estudiante...`);
        
        const BATCH_SIZE = 50;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE);
            const promises = batch.map(u => 
                supabase.from('solicitudes_pps').update({
                    nombre_alumno: u.nombre_alumno,
                    legajo: u.legajo,
                    email: u.email
                }).eq('id', u.id)
            );
            await Promise.all(promises);
            process.stdout.write(".");
        }
        console.log("\n   ✅ Solicitudes actualizadas.");
    }
}

// --- 2. REPARACIÓN DE VÍNCULOS EN FINALIZACIONES ---
async function fixFinalizacionLinks() {
    console.log("\n🔗 FASE 2: Reparando Vínculos en Solicitudes de Finalización...");

    // 1. Buscar finalizaciones huérfanas que tengan airtable_id
    const { data: ghosts, error } = await supabase
        .from('finalizacion_pps')
        .select('id, airtable_id')
        .is('estudiante_id', null)
        .not('airtable_id', 'is', null);

    if (error) { console.error("Error leyendo finalizaciones:", error); return; }

    if (ghosts.length === 0) {
        console.log("   ✅ No hay finalizaciones huérfanas para reparar.");
        return;
    }

    console.log(`   👻 Se encontraron ${ghosts.length} finalizaciones sin estudiante.`);

    // 2. Obtener mapa de estudiantes (Airtable ID -> Supabase ID)
    const { data: students } = await supabase.from('estudiantes').select('id, airtable_id');
    const studentMap = new Map();
    students.forEach(s => { if(s.airtable_id) studentMap.set(s.airtable_id, s.id); });

    // 3. Consultar Airtable para obtener el ID del estudiante original
    console.log("   📥 Consultando Airtable para recuperar vínculos...");
    
    // Lo hacemos en lotes para no saturar la URL
    let updates = [];
    const CHUNK_SIZE = 40;
    const ghostIds = ghosts.map(g => g.airtable_id);

    for (let i = 0; i < ghostIds.length; i += CHUNK_SIZE) {
        const batchIds = ghostIds.slice(i, i + CHUNK_SIZE);
        const formula = `OR(${batchIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;
        // Pedimos el campo 'Nombre' que en Airtable es el link al Estudiante
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Finalizaci%C3%B3n%20de%20PPS?fields%5B%5D=Nombre&filterByFormula=${encodeURIComponent(formula)}`;

        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            const data = await res.json();
            
            if (data.records) {
                for (const atRecord of data.records) {
                    const atStudentId = cleanArray(atRecord.fields['Nombre']); // ID del estudiante en Airtable
                    
                    if (atStudentId) {
                        const sbStudentId = studentMap.get(atStudentId);
                        const ghostRecord = ghosts.find(g => g.airtable_id === atRecord.id);

                        if (sbStudentId && ghostRecord) {
                            updates.push({
                                id: ghostRecord.id,
                                estudiante_id: sbStudentId
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error("   ❌ Error consultando Airtable:", e.message);
        }
        await new Promise(r => setTimeout(r, 200));
    }

    // 4. Aplicar parches
    if (updates.length > 0) {
        console.log(`   🚀 Reparando ${updates.length} vínculos de finalización...`);
        for (let i = 0; i < updates.length; i += 50) {
            const batch = updates.slice(i, i + 50);
            const promises = batch.map(u => 
                supabase.from('finalizacion_pps').update({ estudiante_id: u.estudiante_id }).eq('id', u.id)
            );
            await Promise.all(promises);
            process.stdout.write(".");
        }
        console.log("\n   ✅ Vínculos reparados.");
    } else {
        console.log("   ⚠️ No se pudieron recuperar vínculos (quizás los estudiantes no existen en Airtable o no se migraron).");
    }
}

async function main() {
    await fixSolicitudesNames();
    await fixFinalizacionLinks();
    console.log("\n🏁 PROCESO COMPLETADO.");
}

main();
