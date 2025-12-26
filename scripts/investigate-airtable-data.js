
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
    console.error("❌ ERROR: Edita scripts/investigate-airtable-data.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fetchAirtableRecord(tableName, recordId) {
    try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        if (res.status === 404) return null; // No existe en Airtable
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return await res.json();
    } catch (error) {
        return null;
    }
}

async function investigate() {
    console.log("🕵️  INICIANDO INVESTIGACIÓN FORENSE DE DATOS...\n");

    // 1. INVESTIGAR ESTUDIANTES VACÍOS
    console.log("--- CASO 1: ESTUDIANTES SIN NOMBRE/LEGAJO ---");
    const { data: brokenStudents } = await supabase
        .from('estudiantes')
        .select('id, airtable_id')
        .or('nombre.is.null,legajo.is.null')
        .not('airtable_id', 'is', null)
        .limit(5); // Muestra solo 5 para no saturar

    if (brokenStudents && brokenStudents.length > 0) {
        for (const s of brokenStudents) {
            const atRecord = await fetchAirtableRecord('Estudiantes', s.airtable_id);
            if (!atRecord) {
                console.log(`🗑️  ID ${s.airtable_id}: NO EXISTE en Airtable (Borrado en origen). -> SEGURO BORRAR EN DB.`);
            } else {
                const nombre = atRecord.fields['Nombre'];
                const legajo = atRecord.fields['Legajo'];
                if (!nombre && !legajo) {
                    console.log(`🔴 ID ${s.airtable_id}: Existe en Airtable pero ESTÁ VACÍO (Campos en blanco). -> SEGURO BORRAR.`);
                } else {
                    console.log(`🟡 ID ${s.airtable_id}: En Airtable TIENE DATOS (${nombre || 'Sin Nom'} - ${legajo || 'Sin Leg'}). -> FALLÓ MIGRACIÓN.`);
                }
            }
        }
    } else {
        console.log("✅ No se encontraron estudiantes rotos para analizar en esta muestra.");
    }

    console.log("\n--- CASO 2: CONVOCATORIAS HUÉRFANAS ---");
    // Buscamos convocatorias que tienen ID de Airtable pero les falta el link al estudiante
    const { data: brokenConvs } = await supabase
        .from('convocatorias')
        .select('id, airtable_id')
        .is('estudiante_id', null)
        .not('airtable_id', 'is', null)
        .limit(5);

    if (brokenConvs && brokenConvs.length > 0) {
        for (const c of brokenConvs) {
            const atRecord = await fetchAirtableRecord('Convocatorias', c.airtable_id);
            
            if (!atRecord) {
                console.log(`🗑️  ID ${c.airtable_id}: NO EXISTE en Airtable. -> SEGURO BORRAR.`);
                continue;
            }

            const estudianteLink = atRecord.fields['Estudiante Inscripto']; // Array de IDs
            const lanzamientoLink = atRecord.fields['Lanzamiento Vinculado']; // Array de IDs

            if (!estudianteLink || estudianteLink.length === 0) {
                 console.log(`🔴 ID ${c.airtable_id}: En Airtable NO TIENE ESTUDIANTE asignado. -> REGISTRO INCOMPLETO (Basura).`);
            } else {
                // El registro en Airtable SÍ apunta a un estudiante. Verificamos si ese estudiante existe en nuestra DB.
                const studentAirtableId = estudianteLink[0];
                const { data: studentInDb } = await supabase.from('estudiantes').select('id').eq('airtable_id', studentAirtableId).maybeSingle();
                
                if (studentInDb) {
                    console.log(`🟡 ID ${c.airtable_id}: Tiene link a estudiante ${studentAirtableId} y el estudiante EXISTE en DB. -> SE PUEDE REPARAR (Re-vincular).`);
                } else {
                    console.log(`🟠 ID ${c.airtable_id}: Tiene link a estudiante ${studentAirtableId} pero el estudiante NO EXISTE en DB. -> FALTA MIGRAR ESTUDIANTE.`);
                }
            }
        }
    } else {
         console.log("✅ No se encontraron convocatorias huérfanas en esta muestra.");
    }
    
    console.log("\n🏁 Investigación finalizada.");
}

investigate();
