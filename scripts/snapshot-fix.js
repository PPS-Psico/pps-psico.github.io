
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN - PEGA TUS CREDENCIALES AQUÍ
// ==============================================================================
const AIRTABLE_PAT = "TU_AIRTABLE_PAT"; 
const AIRTABLE_BASE_ID = "TU_BASE_ID"; 

const SUPABASE_URL = "TU_SUPABASE_URL"; 
const SUPABASE_SERVICE_KEY = "TU_SERVICE_ROLE_KEY";
// ==============================================================================

// Validación básica de que las variables existen
if (!AIRTABLE_PAT || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: Faltan credenciales en el archivo scripts/snapshot-fix.js");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const cleanValue = (val) => {
    if (!val) return null;
    if (Array.isArray(val)) return val[0] || null;
    return val;
};

async function fetchAirtableBatch(recordIds) {
    if (recordIds.length === 0) return [];
    
    const formula = `OR(${recordIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;
    const fields = ['Nombre PPS', 'Fecha Inicio'];
    const fieldsParams = fields.map(f => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Convocatorias?filterByFormula=${encodeURIComponent(formula)}&${fieldsParams}`;
    
    try {
        const res = await fetch(url, { 
            headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } 
        });

        if (!res.ok) {
            const errorBody = await res.text();
            console.error(`   ❌ Error Airtable (${res.status}):`, errorBody);
            return [];
        }

        const data = await res.json();
        return data.records || [];
    } catch (e) {
        console.error("   ❌ Error de red:", e.message);
        return [];
    }
}

async function runSnapshotFix() {
    console.log("📸 Iniciando RELLENO DE DATOS (Snapshot Fix para Convocatorias)...");
    
    // 1. Buscamos en Supabase registros que no tengan nombre_pps
    const { data: brokenRecords, error: sbError } = await supabase
        .from('convocatorias')
        .select('id, airtable_id')
        .not('airtable_id', 'is', null)
        .is('nombre_pps', null);

    if (sbError) {
        console.error("❌ Error Supabase:", sbError.message);
        return;
    }

    if (!brokenRecords || brokenRecords.length === 0) {
        console.log("   ✅ No hay registros sin nombre en 'convocatorias'.");
        return;
    }

    console.log(`   📝 Se encontraron ${brokenRecords.length} registros incompletos.`);

    const airtableIds = brokenRecords.map(r => r.airtable_id);
    const updates = [];
    
    // 2. Procesar en lotes muy pequeños (10)
    const BATCH_SIZE = 10;
    console.log(`   📥 Recuperando datos de Airtable en lotes de ${BATCH_SIZE}...`);

    for (let i = 0; i < airtableIds.length; i += BATCH_SIZE) {
        const batchIds = airtableIds.slice(i, i + BATCH_SIZE);
        const atRecords = await fetchAirtableBatch(batchIds);
        
        atRecords.forEach(atRec => {
            const sbRecord = brokenRecords.find(r => r.airtable_id === atRec.id);
            if (sbRecord) {
                updates.push({
                    id: sbRecord.id,
                    nombre_pps: cleanValue(atRec.fields['Nombre PPS']),
                    fecha_inicio: cleanValue(atRec.fields['Fecha Inicio'])
                });
            }
        });
        process.stdout.write(".");
        await new Promise(r => setTimeout(r, 400)); // Delay para rate limit
    }

    console.log(`\n   💾 Guardando ${updates.length} correcciones en Supabase...`);

    // 3. Aplicar cambios
    for (const update of updates) {
        if (!update.nombre_pps) continue;
        
        const { error: upError } = await supabase
            .from('convocatorias')
            .update({
                nombre_pps: update.nombre_pps,
                fecha_inicio: update.fecha_inicio
            })
            .eq('id', update.id);
            
        if (upError) console.error(`   ⚠️ Error en ID ${update.id}:`, upError.message);
    }

    console.log(`\n✅ PROCESO FINALIZADO.`);
    console.log(`   ✨ Se rellenaron ${updates.length} registros.`);
}

runSnapshotFix();
