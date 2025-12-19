
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN - PEGA TUS CREDENCIALES AQUÍ
// ==============================================================================

const AIRTABLE_PAT = "PEGAR_AQUI_TU_AIRTABLE_PAT"; 
const AIRTABLE_BASE_ID = "PEGAR_AQUI_TU_BASE_ID"; 

const SUPABASE_URL = "PEGAR_AQUI_TU_SUPABASE_URL"; 
const SUPABASE_SERVICE_KEY = "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

// ==============================================================================

if (AIRTABLE_PAT.includes("PEGAR") || SUPABASE_URL.includes("PEGAR")) {
    console.error("❌ ERROR: Edita scripts/repair-practicas-students.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;

async function repairPracticeStudentLinks() {
    console.log("🚑 Iniciando reparación de vínculos Práctica -> Estudiante...");

    // 1. Obtener Mapa de Estudiantes (Airtable ID -> Supabase ID)
    // Necesitamos saber qué ID de Supabase corresponde a cada registro de Airtable
    console.log("   📥 Cargando mapa de estudiantes existentes en Supabase...");
    let { data: estudiantes, error } = await supabase.from('estudiantes').select('id, airtable_id');
    
    if (error) {
        console.error("Error cargando estudiantes:", error);
        return;
    }

    const studentMap = new Map();
    if (estudiantes) {
        estudiantes.forEach(e => {
            if (e.airtable_id) studentMap.set(e.airtable_id, e.id);
        });
    }
    console.log(`   ✅ Mapa de estudiantes listo (${studentMap.size} registros).`);

    // 2. Descargar Prácticas de Airtable (Fuente de la verdad)
    let allAirtableRecords = [];
    let offset = null;
    console.log("   📥 Descargando Prácticas originales de Airtable (campo 'Estudiante Inscripto')...");

    try {
        do {
            // Traemos solo el campo de vinculación
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Pr%C3%A1cticas?pageSize=100&fields%5B%5D=Estudiante%20Inscripto${offset ? `&offset=${offset}` : ''}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            const data = await res.json();
            allAirtableRecords = [...allAirtableRecords, ...data.records];
            offset = data.offset;
            if(offset) await new Promise(r => setTimeout(r, 200)); 
        } while (offset);
    } catch (e) {
        console.error("❌ Error conectando a Airtable:", e.message);
        return;
    }

    console.log(`   ✅ ${allAirtableRecords.length} prácticas obtenidas de Airtable.`);

    // 3. Obtener Prácticas de Supabase para comparar y solo actualizar las rotas
    // (Optimizamos para no actualizar todo si no es necesario, aunque el upsert es barato)
    const { data: sbPracticas } = await supabase.from('practicas').select('id, airtable_id, estudiante_id');
    const sbPracticasMap = new Map(); // AirtableID -> { sbID, currentStudentId }
    if (sbPracticas) sbPracticas.forEach(p => sbPracticasMap.set(p.airtable_id, { id: p.id, currentStudentId: p.estudiante_id }));

    // 4. Preparar actualizaciones
    console.log("   ⚙️  Analizando vínculos rotos...");
    
    let updates = [];
    let fixedCount = 0;

    for (const atRecord of allAirtableRecords) {
        const atStudentIdRaw = cleanArray(atRecord.fields['Estudiante Inscripto']); // ID de Airtable del estudiante (recXXXX...)
        
        // Si la práctica en Airtable tiene un estudiante asignado
        if (atStudentIdRaw) {
            // Buscamos cuál es el ID de Supabase para ese estudiante
            const targetSupabaseStudentId = studentMap.get(atStudentIdRaw);
            
            // Buscamos la práctica correspondiente en Supabase
            const sbPractice = sbPracticasMap.get(atRecord.id);

            if (targetSupabaseStudentId && sbPractice) {
                // Si la práctica en Supabase NO tiene estudiante, o tiene uno diferente
                if (sbPractice.currentStudentId !== targetSupabaseStudentId) {
                    updates.push({
                        id: sbPractice.id, // ID Supabase de la práctica
                        estudiante_id: targetSupabaseStudentId
                    });
                }
            }
        }
    }

    // 5. Aplicar actualizaciones
    if (updates.length === 0) {
        console.log("   ✨ No se encontraron vínculos rotos para reparar. Todo parece estar en orden.");
        return;
    }

    console.log(`   🚀 Reparando ${updates.length} prácticas con vínculos incorrectos o faltantes...`);

    const BATCH_SIZE = 100;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        // Hacemos updates paralelos o secuenciales. 
        // Supabase no tiene un "updateMany" nativo simple para valores diferentes por fila sin usar upsert, 
        // pero upsert requiere todos los campos required.
        // Haremos promesas paralelas por lote para velocidad.
        
        const promises = batch.map(u => 
            supabase
                .from('practicas')
                .update({ estudiante_id: u.estudiante_id })
                .eq('id', u.id)
        );

        await Promise.all(promises);
        fixedCount += batch.length;
        process.stdout.write(".");
    }

    console.log(`\n\n✅ REPARACIÓN DE VÍNCULOS COMPLETADA.`);
    console.log(`   📝 Se reconectaron ${fixedCount} prácticas con sus estudiantes.`);
    console.log(`   🔄 Recarga la aplicación para ver los nombres corregidos.`);
}

repairPracticeStudentLinks();
