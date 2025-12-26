
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
    console.error("❌ ERROR: Edita scripts/sync-deletions.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fetchAllAirtableIds(tableName) {
    let allIds = new Set();
    let offset = null;
    console.log(`📥 Descargando IDs de '${tableName}' desde Airtable...`);

    try {
        do {
            // CORRECCIÓN: Se eliminó el parámetro &fields%5B%5D=recordId que causaba el error 422.
            // Ahora traemos el registro estándar (un poco más de datos, pero seguro).
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            if (!res.ok) throw new Error(`Error API Airtable: ${res.status} ${res.statusText}`);
            
            const data = await res.json();
            data.records.forEach(r => allIds.add(r.id));
            
            offset = data.offset;
            if(offset) await new Promise(r => setTimeout(r, 200)); 
        } while (offset);
        return allIds;
    } catch (e) {
        console.error("❌ Error fatal conectando a Airtable:", e);
        return new Set(); // Retornar vacío para evitar borrar todo por error
    }
}

async function syncDeletions() {
    console.log("🧹 INICIANDO LIMPIEZA DE REGISTROS ELIMINADOS...");

    // 1. Obtener la lista maestra de IDs que existen HOY en Airtable
    const validAirtableIds = await fetchAllAirtableIds('Convocatorias');
    console.log(`   ✅ Airtable informa ${validAirtableIds.size} registros válidos.`);

    if (validAirtableIds.size === 0) {
        console.error("   ⚠️ ALERTA DE SEGURIDAD: Airtable devolvió 0 registros o falló.");
        console.error("   ⛔ Se aborta el proceso para evitar borrar toda la base de datos accidentalmente.");
        return;
    }

    // 2. Obtener todas las convocatorias en Supabase que provienen de Airtable
    const { data: supabaseRecords, error } = await supabase
        .from('convocatorias')
        .select('id, airtable_id')
        .not('airtable_id', 'is', null);

    if (error) {
        console.error("Error Supabase:", error);
        return;
    }

    console.log(`   📊 Supabase tiene ${supabaseRecords.length} registros vinculados.`);

    // 3. Identificar cuáles sobran en Supabase (Zombies)
    const toDelete = [];
    supabaseRecords.forEach(rec => {
        if (!validAirtableIds.has(rec.airtable_id)) {
            toDelete.push(rec.id);
        }
    });

    if (toDelete.length === 0) {
        console.log("   ✨ Todo limpio. Supabase está perfectamente sincronizado.");
        return;
    }

    console.log(`   🗑️  Se encontraron ${toDelete.length} registros 'zombies' en Supabase (borrados en Airtable). Eliminando...`);

    // 4. Eliminar en lotes
    const BATCH_SIZE = 100;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        const { error: delError } = await supabase.from('convocatorias').delete().in('id', batch);
        
        if (delError) console.error("Error eliminando lote:", delError);
        else process.stdout.write("X");
    }

    console.log(`\n\n✅ LIMPIEZA COMPLETADA.`);
    console.log(`   La base de datos ahora refleja exactamente lo que hay en Airtable.`);
}

syncDeletions();
