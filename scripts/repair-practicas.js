
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
    console.error("❌ ERROR: Edita scripts/repair-practicas.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;

async function repairPracticas() {
    console.log("🚑 Iniciando reparación de nombres de Prácticas...");

    // 1. Obtener Mapa de Lanzamientos (Airtable ID -> Supabase ID) para arreglar vínculos rotos
    console.log("   📥 Cargando mapa de lanzamientos...");
    const { data: lanzamientos } = await supabase.from('lanzamientos_pps').select('id, airtable_id');
    const lanzamientosMap = new Map();
    if (lanzamientos) {
        lanzamientos.forEach(l => {
            if (l.airtable_id) lanzamientosMap.set(l.airtable_id, l.id);
        });
    }

    // 2. Descargar Prácticas de Airtable (La fuente de la verdad)
    let allAirtableRecords = [];
    let offset = null;
    console.log("   📥 Descargando Prácticas originales de Airtable...");

    try {
        do {
            // Traemos campos clave
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Pr%C3%A1cticas?pageSize=100&fields%5B%5D=Nombre%20(de%20Instituci%C3%B3n)&fields%5B%5D=Lanzamiento%20Vinculado${offset ? `&offset=${offset}` : ''}`;
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

    console.log(`   ✅ ${allAirtableRecords.length} registros encontrados en Airtable.`);

    // 3. Preparar actualizaciones
    console.log("   ⚙️  Analizando diferencias y preparando parches...");
    
    let updates = [];
    let fixedCount = 0;

    for (const atRecord of allAirtableRecords) {
        const atNameRaw = atRecord.fields['Nombre (de Institución)'];
        // Asegurar que obtenemos un string limpio del nombre
        const atName = cleanArray(atNameRaw); 
        
        const atLanzamientoIdRaw = cleanArray(atRecord.fields['Lanzamiento Vinculado']);
        const sbLanzamientoId = atLanzamientoIdRaw ? lanzamientosMap.get(atLanzamientoIdRaw) : null;

        if (atName) {
            updates.push({
                airtable_id: atRecord.id,
                nombre_institucion: atName, // Forzamos la sobreescritura del nombre
                lanzamiento_id: sbLanzamientoId // Intentamos reparar el vínculo si es posible
            });
        }
    }

    // 4. Aplicar actualizaciones en lotes a Supabase
    console.log(`   🚀 Aplicando parches a ${updates.length} registros en Supabase...`);

    // Usamos upsert o update. Dado que necesitamos hacer match por airtable_id,
    // y la columna id es la PK, lo más eficiente es iterar o hacer un upsert si tenemos un índice único en airtable_id.
    // Asumiremos que no hay constraint único formal, así que haremos updates por lotes buscando primero el ID.
    
    // Optimización: Traer todos los IDs de prácticas de Supabase para hacer el match localmente
    const { data: sbPracticas } = await supabase.from('practicas').select('id, airtable_id');
    const sbPracticasMap = new Map();
    if(sbPracticas) sbPracticas.forEach(p => sbPracticasMap.set(p.airtable_id, p.id));

    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (u) => {
            const sbId = sbPracticasMap.get(u.airtable_id);
            if (sbId) {
                // Solo actualizamos si encontramos el registro en Supabase
                const payload = { nombre_institucion: u.nombre_institucion };
                if (u.lanzamiento_id) payload.lanzamiento_id = u.lanzamiento_id;

                const { error } = await supabase
                    .from('practicas')
                    .update(payload)
                    .eq('id', sbId);
                
                if (!error) fixedCount++;
            }
        });

        await Promise.all(promises);
        process.stdout.write(".");
    }

    console.log(`\n\n✅ REPARACIÓN COMPLETADA.`);
    console.log(`   📝 Se actualizaron los nombres de ${fixedCount} prácticas.`);
    console.log(`   🔄 Recarga la aplicación para ver los cambios.`);
}

repairPracticas();
