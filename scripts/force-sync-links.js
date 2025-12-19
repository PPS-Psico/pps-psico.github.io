
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN
// ==============================================================================

const AIRTABLE_PAT = "PEGAR_AQUI_TU_AIRTABLE_PAT"; 
const AIRTABLE_BASE_ID = "PEGAR_AQUI_TU_BASE_ID"; 

const SUPABASE_URL = "PEGAR_AQUI_TU_SUPABASE_URL"; 
const SUPABASE_SERVICE_KEY = "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

// ==============================================================================

if (AIRTABLE_PAT.includes("PEGAR") || SUPABASE_URL.includes("PEGAR")) {
    console.error("❌ ERROR: Edita scripts/force-sync-links.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;

async function forceSyncLinks() {
    console.log("🔨 Iniciando FORZADO de vínculos Práctica -> Estudiante...");

    // 1. Obtener Mapa de Estudiantes (Airtable ID -> Supabase UUID)
    console.log("   📥 Cargando estudiantes de Supabase...");
    const { data: estudiantes, error } = await supabase
        .from('estudiantes')
        .select('id, airtable_id, nombre, legajo');
    
    if (error) { console.error(error); return; }

    // Mapas para búsqueda rápida
    const idMap = new Map(); // AirtableID -> SupabaseUUID
    const debugMap = new Map(); // AirtableID -> Nombre (para logs)

    estudiantes.forEach(e => {
        if (e.airtable_id) {
            idMap.set(e.airtable_id, e.id);
            debugMap.set(e.airtable_id, e.nombre);
        }
    });
    console.log(`   ✅ Mapa construido con ${idMap.size} estudiantes.`);

    // 2. Descargar Prácticas de Airtable
    let allAirtableRecords = [];
    let offset = null;
    console.log("   📥 Descargando Prácticas de Airtable...");

    try {
        do {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Pr%C3%A1cticas?pageSize=100&fields%5B%5D=Estudiante%20Inscripto&fields%5B%5D=Nombre%20(de%20Instituci%C3%B3n)${offset ? `&offset=${offset}` : ''}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            const data = await res.json();
            allAirtableRecords = [...allAirtableRecords, ...data.records];
            offset = data.offset;
            if(offset) await new Promise(r => setTimeout(r, 200)); 
        } while (offset);
    } catch (e) {
        console.error("❌ Error Airtable:", e.message);
        return;
    }

    console.log(`   ✅ ${allAirtableRecords.length} prácticas en Airtable.`);

    // 3. Iterar y actualizar
    console.log("   ⚙️  Procesando actualizaciones...");
    
    let updatesCount = 0;
    const updates = [];

    for (const record of allAirtableRecords) {
        const atStudentId = cleanArray(record.fields['Estudiante Inscripto']);
        
        if (atStudentId) {
            const sbStudentId = idMap.get(atStudentId);
            const studentName = debugMap.get(atStudentId) || "Desconocido en Map";

            // LOG DE DEPURACIÓN ESPECÍFICO
            // Si encontramos a Camila o al Centro Camioneros, mostramos info detallada
            const institucion = String(record.fields['Nombre (de Institución)'] || '');
            if (studentName.toLowerCase().includes('barloqui') || institucion.includes('Camioneros')) {
                console.log(`   🔍 DEBUG: Práctica "${institucion}" (AT: ${record.id})`);
                console.log(`      -> Estudiante Airtable ID: ${atStudentId}`);
                console.log(`      -> Match en Supabase: ${sbStudentId ? 'SÍ' : 'NO'} (${studentName})`);
            }

            if (sbStudentId) {
                // Preparamos el update. Usamos el ID de airtable de la práctica para encontrarla en Supabase
                updates.push({
                    airtable_id: record.id,
                    estudiante_id: sbStudentId
                });
            }
        }
    }

    // 4. Ejecutar Updates en Lotes
    const BATCH_SIZE = 50;
    console.log(`   🚀 Ejecutando ${updates.length} actualizaciones en la base de datos...`);

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(u => 
            supabase
                .from('practicas')
                .update({ estudiante_id: u.estudiante_id })
                .eq('airtable_id', u.airtable_id)
        );

        await Promise.all(promises);
        updatesCount += batch.length;
        process.stdout.write(".");
    }

    console.log(`\n\n✅ PROCESO FINALIZADO.`);
    console.log(`   📝 Se forzó la actualización de ${updatesCount} vínculos.`);
    console.log(`   👉 Recarga la aplicación. Si Barloqui sigue sin aparecer, verifica que su 'airtable_id' en la tabla 'estudiantes' coincida con el ID que mostró el log de DEBUG.`);
}

forceSyncLinks();
