
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
    console.error("❌ ERROR: Edita scripts/advanced-repair.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;
const cleanNum = (val) => (val ? Number(val) : null);
const cleanText = (val) => (val ? String(val).trim() : null);

// Mapper Functions (Simplified for speed, add more fields if needed)
const mapEstudiante = (f) => ({
    legajo: cleanText(f['Legajo']),
    nombre: cleanText(f['Nombre']),
    dni: cleanNum(f['DNI']),
    correo: cleanText(f['Correo']),
    telefono: cleanText(f['Teléfono']),
    orientacion_elegida: cleanText(f['Orientación Elegida']),
    notas_internas: cleanText(f['Notas Internas']), 
    // Additional fields
    nombre_separado: cleanText(f['Nombre (Separado)']),
    apellido_separado: cleanText(f['Apellido (Separado)']),
});

const mapLanzamiento = (f) => ({
    nombre_pps: cleanText(f['Nombre PPS']),
    fecha_inicio: f['Fecha Inicio'] || null,
    fecha_finalizacion: f['Fecha Finalización'] || null,
    orientacion: cleanText(f['Orientación']),
    cupos_disponibles: cleanNum(f['Cupos disponibles']),
    horas_acreditadas: cleanNum(f['Horas Acreditadas']),
    estado_convocatoria: cleanText(f['Estado de Convocatoria']),
});

async function fetchSpecificRecords(tableName, recordIds) {
    if (recordIds.size === 0) return [];
    console.log(`   📥 Descargando ${recordIds.size} registros específicos de ${tableName}...`);
    
    const records = [];
    const chunks = [];
    const ids = Array.from(recordIds);
    
    // Airtable allows filterByFormula. Construct OR(RECORD_ID()='...', ...)
    // Max URL length is limited, so we batch by ~20 IDs
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const formula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(',')})`;
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(formula)}`;
        
        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            const data = await res.json();
            if (data.records) records.push(...data.records);
        } catch (e) {
            console.error(`Error fetching batch for ${tableName}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 100)); // Rate limit
    }
    return records;
}

async function advancedRepair() {
    console.log("🚑 Iniciando REPARACIÓN AVANZADA de Convocatorias...");

    // 1. Identificar Fantasmas
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
        console.log("   ✅ No hay inscripciones fantasma. Todo limpio.");
        return;
    }

    console.log(`   👻 Se encontraron ${ghosts.length} inscripciones fantasma.`);

    // 2. Traer la verdad de Airtable para esos fantasmas
    console.log("   📥 Consultando Airtable para ver qué IDs faltan...");
    
    // Fetch Convocatorias from Airtable to get the link IDs
    // Optimization: Only fetch the broken ones. We need to fetch by ID.
    // Since there might be many, we'll fetch them in batches.
    
    const ghostAirtableIds = new Set(ghosts.map(g => g.airtable_id));
    const convocatoriasSource = await fetchSpecificRecords('Convocatorias', ghostAirtableIds);
    
    const missingStudentIds = new Set();
    const missingLaunchIds = new Set();
    const fixableMap = new Map(); // airtable_conv_id -> { studentAtId, launchAtId }

    // Maps for existing Supabase records
    const { data: existStudents } = await supabase.from('estudiantes').select('id, airtable_id');
    const sbStudentMap = new Map();
    existStudents.forEach(s => s.airtable_id && sbStudentMap.set(s.airtable_id, s.id));

    const { data: existLaunches } = await supabase.from('lanzamientos_pps').select('id, airtable_id');
    const sbLaunchMap = new Map();
    existLaunches.forEach(l => l.airtable_id && sbLaunchMap.set(l.airtable_id, l.id));

    for (const rec of convocatoriasSource) {
        const sId = cleanArray(rec.fields['Estudiante Inscripto']);
        const lId = cleanArray(rec.fields['Lanzamiento Vinculado']);
        
        if (sId && !sbStudentMap.has(sId)) missingStudentIds.add(sId);
        if (lId && !sbLaunchMap.has(lId)) missingLaunchIds.add(lId);
        
        fixableMap.set(rec.id, { sId, lId });
    }

    console.log(`   📦 Faltantes detectados: ${missingStudentIds.size} Estudiantes, ${missingLaunchIds.size} Lanzamientos.`);

    // 3. Importar Entidades Faltantes
    if (missingStudentIds.size > 0) {
        console.log("   🚀 Importando Estudiantes faltantes...");
        const studentsToImport = await fetchSpecificRecords('Estudiantes', missingStudentIds);
        const toInsert = studentsToImport.map(r => ({
            ...mapEstudiante(r.fields),
            airtable_id: r.id,
            created_at: r.createdTime
        }));
        
        if (toInsert.length > 0) {
             const { data: inserted, error: insErr } = await supabase.from('estudiantes').upsert(toInsert, { onConflict: 'airtable_id' }).select('id, airtable_id');
             if (insErr) console.error("Error insertando estudiantes:", insErr);
             else inserted.forEach(r => sbStudentMap.set(r.airtable_id, r.id));
             console.log(`      + ${inserted?.length || 0} estudiantes importados.`);
        }
    }

    if (missingLaunchIds.size > 0) {
        console.log("   🚀 Importando Lanzamientos faltantes...");
        const launchesToImport = await fetchSpecificRecords('Lanzamientos de PPS', missingLaunchIds);
        const toInsert = launchesToImport.map(r => ({
            ...mapLanzamiento(r.fields),
            airtable_id: r.id,
            created_at: r.createdTime
        }));
        
        if (toInsert.length > 0) {
             const { data: inserted, error: insErr } = await supabase.from('lanzamientos_pps').upsert(toInsert, { onConflict: 'airtable_id' }).select('id, airtable_id');
             if (insErr) console.error("Error insertando lanzamientos:", insErr);
             else inserted.forEach(r => sbLaunchMap.set(r.airtable_id, r.id));
             console.log(`      + ${inserted?.length || 0} lanzamientos importados.`);
        }
    }

    // 4. Reparar Convocatorias
    console.log("   🔧 Reparando vínculos...");
    let fixed = 0;
    const updates = [];

    for (const ghost of ghosts) {
        const target = fixableMap.get(ghost.airtable_id);
        if (target) {
            const sbSId = target.sId ? sbStudentMap.get(target.sId) : null;
            const sbLId = target.lId ? sbLaunchMap.get(target.lId) : null;
            
            if (sbSId || sbLId) {
                const patch = { id: ghost.id };
                if (sbSId) patch.estudiante_id = sbSId;
                if (sbLId) patch.lanzamiento_id = sbLId;
                updates.push(patch);
            }
        }
    }

    // Apply updates
    const CHUNK_SIZE = 50;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        const promises = chunk.map(u => supabase.from('convocatorias').update(u).eq('id', u.id));
        await Promise.all(promises);
        fixed += chunk.length;
        process.stdout.write(".");
    }

    console.log(`\n\n✅ FIN DE PROCESO. Se repararon ${fixed} registros.`);
    console.log(`   (Si el número es menor a los fantasmas encontrados, es porque en Airtable esos registros tampoco tienen el vínculo)`);
}

advancedRepair();
