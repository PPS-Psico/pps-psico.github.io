
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
    console.error("❌ ERROR: Edita scripts/repair-convocatorias.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;

async function repairConvocatorias() {
    console.log("🚑 Iniciando operación de rescate de Convocatorias Fantasma...");

    // 1. Identificar a los fantasmas en Supabase
    // Buscamos registros que vinieron de Airtable pero les falta estudiante o lanzamiento
    console.log("   🔍 Buscando registros rotos en Supabase...");
    
    const { data: ghosts, error } = await supabase
        .from('convocatorias')
        .select('id, airtable_id, estudiante_id, lanzamiento_id')
        .not('airtable_id', 'is', null)
        .or('estudiante_id.is.null,lanzamiento_id.is.null');

    if (error) {
        console.error("Error consultando Supabase:", error);
        return;
    }

    if (ghosts.length === 0) {
        console.log("   ✅ No se encontraron convocatorias rotas con ID de Airtable.");
        return;
    }

    console.log(`   👻 Se encontraron ${ghosts.length} inscripciones fantasma para reparar.`);

    // 2. Construir Mapas de Referencia de Supabase (Para traducir ID Airtable -> ID Supabase)
    console.log("   🗺️  Construyendo mapas de Estudiantes y Lanzamientos...");
    
    const { data: students } = await supabase.from('estudiantes').select('id, airtable_id');
    const studentMap = new Map();
    if (students) students.forEach(s => { if(s.airtable_id) studentMap.set(s.airtable_id, s.id); });

    const { data: launches } = await supabase.from('lanzamientos_pps').select('id, airtable_id');
    const launchMap = new Map();
    if (launches) launches.forEach(l => { if(l.airtable_id) launchMap.set(l.airtable_id, l.id); });

    console.log(`      -> ${studentMap.size} estudiantes mapeados.`);
    console.log(`      -> ${launchMap.size} lanzamientos mapeados.`);

    // 3. Descargar la verdad de Airtable
    // Solo necesitamos los campos de relación para los IDs que tenemos problemas
    console.log("   📥 Consultando Airtable para recuperar vínculos perdidos...");
    
    let allAirtableRecords = [];
    let offset = null;

    try {
        do {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Convocatorias?pageSize=100&fields%5B%5D=Estudiante%20Inscripto&fields%5B%5D=Lanzamiento%20Vinculado${offset ? `&offset=${offset}` : ''}`;
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

    // Crear mapa de Airtable para acceso rápido
    const airtableSourceMap = new Map(allAirtableRecords.map(r => [r.id, r]));

    // 4. Analizar y Preparar Parches
    console.log("   ⚙️  Analizando reparaciones...");
    
    let updates = [];
    let cantFix = 0;

    for (const ghost of ghosts) {
        const source = airtableSourceMap.get(ghost.airtable_id);
        
        if (source) {
            const atStudentId = cleanArray(source.fields['Estudiante Inscripto']);
            const atLaunchId = cleanArray(source.fields['Lanzamiento Vinculado']);

            const sbStudentId = atStudentId ? studentMap.get(atStudentId) : null;
            const sbLaunchId = atLaunchId ? launchMap.get(atLaunchId) : null;

            // Solo actualizamos si encontramos algo nuevo que no teníamos
            const needsStudentFix = !ghost.estudiante_id && sbStudentId;
            const needsLaunchFix = !ghost.lanzamiento_id && sbLaunchId;

            if (needsStudentFix || needsLaunchFix) {
                const patch = { id: ghost.id };
                if (needsStudentFix) patch.estudiante_id = sbStudentId;
                if (needsLaunchFix) patch.lanzamiento_id = sbLaunchId;
                updates.push(patch);
            } else {
                cantFix++;
                // console.log(`      ⚠️ No se pudo reparar ID ${ghost.id} (AT: ${ghost.airtable_id}). Faltan datos en destino.`);
            }
        }
    }

    // 5. Aplicar Parches
    if (updates.length === 0) {
        console.log("   🤷 No se pudo reparar ningún registro (probablemente los estudiantes o lanzamientos tampoco están en Supabase).");
        return;
    }

    console.log(`   🚀 Aplicando reparaciones a ${updates.length} registros...`);

    const BATCH_SIZE = 50;
    let successCount = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        // Hacemos updates individuales en paralelo ya que son updates parciales específicos por ID
        const promises = batch.map(u => 
            supabase
                .from('convocatorias')
                .update(u)
                .eq('id', u.id)
        );

        await Promise.all(promises);
        successCount += batch.length;
        process.stdout.write(".");
    }

    console.log(`\n\n✅ OPERACIÓN COMPLETADA`);
    console.log(`   ✨ Se repararon ${successCount} inscripciones fantasma.`);
    console.log(`   ⚠️ Quedaron ${cantFix} sin reparar (falta el estudiante o el lanzamiento base).`);
    console.log(`   🔄 Recarga la aplicación para ver los datos recuperados.`);
}

repairConvocatorias();
