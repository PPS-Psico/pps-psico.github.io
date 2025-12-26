
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
    console.error("❌ ERROR: Edita scripts/heuristic-repair.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;
const normalize = (str) => String(str || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Helper para generar clave única de lanzamiento (Nombre + Fecha)
const getLaunchKey = (name, date) => {
    if (!name) return null;
    const cleanName = normalize(name).split(' - ')[0]; // Usar solo el nombre base
    const cleanDate = date ? date.substring(0, 10) : 'no-date';
    return `${cleanName}|${cleanDate}`;
};

async function fetchAirtableBatch(tableName, recordIds) {
    if (recordIds.size === 0) return [];
    const records = [];
    const ids = Array.from(recordIds);
    const BATCH_SIZE = 50; // Airtable URL limit safety

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        // Formula: OR(RECORD_ID()='rec1', RECORD_ID()='rec2'...)
        const formula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(',')})`;
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(formula)}`;
        
        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            const data = await res.json();
            if (data.records) records.push(...data.records);
        } catch (e) {
            console.error(`Error fetching batch from ${tableName}`, e);
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return records;
}

async function heuristicRepair() {
    console.log("🕵️  Iniciando REPARACIÓN HEURÍSTICA (Detective Mode)...");

    // 1. Obtener fantasmas de Supabase
    const { data: ghosts, error } = await supabase
        .from('convocatorias')
        .select('id, airtable_id, estudiante_id, lanzamiento_id')
        .not('airtable_id', 'is', null)
        .or('estudiante_id.is.null,lanzamiento_id.is.null');

    if (error || !ghosts.length) {
        console.log("✅ No se encontraron convocatorias rotas (o hubo error).");
        return;
    }

    console.log(`👻 Analizando ${ghosts.length} registros rotos...`);

    // 2. Descargar los registros originales de Airtable para ver qué tenían
    const ghostAirtableIds = new Set(ghosts.map(g => g.airtable_id));
    const atConvocatorias = await fetchAirtableBatch('Convocatorias', ghostAirtableIds);
    
    // Recolectar IDs de dependencias faltantes en Airtable
    const atStudentIds = new Set();
    const atLaunchIds = new Set();
    
    // Mapa: ConvocatoriaID -> { atStudentId, atLaunchId }
    const relationshipMap = new Map();

    atConvocatorias.forEach(rec => {
        const sId = cleanArray(rec.fields['Estudiante Inscripto']);
        const lId = cleanArray(rec.fields['Lanzamiento Vinculado']);
        if (sId) atStudentIds.add(sId);
        if (lId) atLaunchIds.add(lId);
        relationshipMap.set(rec.id, { sId, lId });
    });

    console.log(`   📦 Referencias encontradas en Airtable: ${atStudentIds.size} Estudiantes, ${atLaunchIds.size} Lanzamientos.`);

    // 3. Descargar DETALLES de esas dependencias desde Airtable
    //    (Necesitamos el LEGAJO del estudiante y el NOMBRE+FECHA del lanzamiento)
    console.log("   📥 Consultando detalles para cruzar datos...");
    
    const atStudentsDetails = await fetchAirtableBatch('Estudiantes', atStudentIds);
    const atLaunchesDetails = await fetchAirtableBatch('Lanzamientos de PPS', atLaunchIds);

    // 4. Construir Diccionarios de Traducción
    //    AirtableID -> Legajo
    const atIdToLegajo = new Map();
    atStudentsDetails.forEach(r => {
        const legajo = String(r.fields['Legajo'] || '').trim();
        if (legajo) atIdToLegajo.set(r.id, legajo);
    });

    //    AirtableID -> ClaveHeuristica (Nombre|Fecha)
    const atIdToLaunchKey = new Map();
    atLaunchesDetails.forEach(r => {
        const key = getLaunchKey(r.fields['Nombre PPS'], r.fields['Fecha Inicio']);
        if (key) atIdToLaunchKey.set(r.id, key);
    });

    // 5. Construir Mapas de Destino en Supabase
    //    Legajo -> SupabaseUUID
    console.log("   🗺️  Mapeando base de datos actual...");
    
    const { data: sbStudents } = await supabase.from('estudiantes').select('id, legajo');
    const sbLegajoMap = new Map();
    sbStudents.forEach(s => {
        if (s.legajo) sbLegajoMap.set(String(s.legajo).trim(), s.id);
    });

    //    ClaveHeuristica -> SupabaseUUID
    const { data: sbLaunches } = await supabase.from('lanzamientos_pps').select('id, nombre_pps, fecha_inicio');
    const sbLaunchMap = new Map();
    sbLaunches.forEach(l => {
        const key = getLaunchKey(l.nombre_pps, l.fecha_inicio);
        if (key) sbLaunchMap.set(key, l.id);
    });

    // 6. MATCHMAKING
    console.log("   ❤️  Uniendo parejas...");
    let updates = [];

    for (const ghost of ghosts) {
        const rel = relationshipMap.get(ghost.airtable_id);
        if (!rel) continue;

        let newStudentId = ghost.estudiante_id;
        let newLaunchId = ghost.lanzamiento_id;
        let changed = false;

        // Intentar reparar Estudiante por LEGAJO
        if (!newStudentId && rel.sId) {
            const legajo = atIdToLegajo.get(rel.sId);
            if (legajo) {
                const foundId = sbLegajoMap.get(legajo);
                if (foundId) {
                    newStudentId = foundId;
                    changed = true;
                }
            }
        }

        // Intentar reparar Lanzamiento por NOMBRE+FECHA
        if (!newLaunchId && rel.lId) {
            const key = atIdToLaunchKey.get(rel.lId);
            if (key) {
                const foundId = sbLaunchMap.get(key);
                if (foundId) {
                    newLaunchId = foundId;
                    changed = true;
                }
            }
        }

        if (changed) {
            updates.push({
                id: ghost.id,
                estudiante_id: newStudentId,
                lanzamiento_id: newLaunchId
            });
        }
    }

    // 7. Ejecutar Updates
    if (updates.length === 0) {
        console.log("   🤷 No se pudo conectar nada nuevo. Es posible que falten los datos maestros (Estudiantes/Lanzamientos) en Supabase.");
        return;
    }

    console.log(`   🚀 Reparando ${updates.length} registros...`);
    
    const CHUNK = 50;
    for (let i = 0; i < updates.length; i += CHUNK) {
        const batch = updates.slice(i, i + CHUNK);
        await Promise.all(batch.map(u => supabase.from('convocatorias').update(u).eq('id', u.id)));
        process.stdout.write(".");
    }

    console.log(`\n\n✅ ÉXITO: Se repararon ${updates.length} registros usando lógica heurística.`);
    console.log("   🔄 Recarga la aplicación.");
}

heuristicRepair();
