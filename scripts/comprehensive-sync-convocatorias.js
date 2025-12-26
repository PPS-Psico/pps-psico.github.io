
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN
// ==============================================================================

const AIRTABLE_PAT = process.env.VITE_AIRTABLE_PAT || "PEGAR_AQUI_TU_AIRTABLE_PAT"; 
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || "PEGAR_AQUI_TU_BASE_ID"; 

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "PEGAR_AQUI_TU_SUPABASE_URL"; 
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

const AIRTABLE_TABLES = ['Convocatorias', 'Convocatorias 2'];

// ==============================================================================

if ((!SUPABASE_URL || SUPABASE_URL.includes("PEGAR")) && !process.env.VITE_SUPABASE_URL) {
    console.error("❌ ERROR: Configura las credenciales al inicio del script.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Helpers
const normalize = (str) => str ? String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
const getDateKey = (isoString) => isoString ? isoString.substring(0, 10) : 'no-date';
const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;
const cleanText = (val) => (val ? String(val).trim() : null);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Wrapper para reintentos (Maneja error 520)
async function supabaseOperationWithRetry(operation, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await operation();
            if (result.error) throw result.error;
            return result;
        } catch (err) {
            const msg = err.message || JSON.stringify(err);
            if (i === retries - 1) return { error: err }; // Falló definitivo
            
            // Si es un error de servidor o conexión, esperamos y reintentamos
            if (msg.includes('520') || msg.includes('500') || msg.includes('fetch')) {
                console.log(`      ⚠️ Error transitorio (${msg}). Reintentando (${i+1}/${retries})...`);
                await sleep(2000 * (i + 1));
            } else {
                return { error: err }; // Error lógico (ej: constraint), no reintentar
            }
        }
    }
}

// --- 1. Fetch from Airtable ---
async function fetchAirtableTable(tableName) {
    let allRecords = [];
    let offset = null;
    console.log(`📥 Descargando '${tableName}'...`);

    try {
        do {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            if (res.status === 404) return [];
            if (!res.ok) throw new Error(`Error Airtable (${res.status})`);
            const data = await res.json();
            allRecords = [...allRecords, ...data.records];
            offset = data.offset;
            if(offset) await sleep(200); 
            process.stdout.write(`   ...${allRecords.length}\r`);
        } while (offset);
        return allRecords;
    } catch (error) {
        console.error(`   ❌ Error en '${tableName}':`, error.message);
        return [];
    }
}

// --- 2. Cargar Datos Maestros ---
async function loadReferenceData() {
    console.log("📚 Indexando datos de referencia...");
    
    const { data: students } = await supabase.from('estudiantes').select('id, airtable_id');
    const studentMap = new Map();
    students?.forEach(s => { if(s.airtable_id) studentMap.set(s.airtable_id, s.id); });

    const { data: launches } = await supabase.from('lanzamientos_pps').select('id, airtable_id, nombre_pps, fecha_inicio');
    const launchMapById = new Map();
    const launchMapByNameDate = new Map();
    const launchMapByName = new Map();

    launches?.forEach(l => {
        if (l.airtable_id) launchMapById.set(l.airtable_id, l.id);
        const key = `${normalize(l.nombre_pps)}|${getDateKey(l.fecha_inicio)}`;
        launchMapByNameDate.set(key, l.id);
        launchMapByName.set(normalize(l.nombre_pps), l.id);
    });

    return { studentMap, launchMapById, launchMapByNameDate, launchMapByName };
}

// --- MAIN ---
async function main() {
    console.log("🚀 INICIANDO SINCRONIZACIÓN PROFESIONAL (V2: ANTI-COLISIONES)");

    try {
        const { studentMap, launchMapById, launchMapByNameDate, launchMapByName } = await loadReferenceData();

        let allAirtableRecords = [];
        for (const table of AIRTABLE_TABLES) {
            const records = await fetchAirtableTable(table);
            allAirtableRecords = [...allAirtableRecords, ...records];
        }

        console.log(`\n⚙️  Procesando ${allAirtableRecords.length} registros...`);
        
        let stats = { inserted: 0, updated: 0, reconciled: 0, collisionsFixed: 0, errors: 0, skipped: 0 };
        const processedCompositeKeys = new Set(); 

        for (let i = 0; i < allAirtableRecords.length; i++) {
            const record = allAirtableRecords[i];
            const f = record.fields;
            
            if (i % 50 === 0) process.stdout.write(`   Procesando: ${Math.round((i / allAirtableRecords.length) * 100)}%\r`);

            // 1. Resolver Vínculos
            const atStudentId = cleanArray(f['Estudiante Inscripto']);
            const sbStudentId = atStudentId ? studentMap.get(atStudentId) : null;

            let sbLaunchId = null;
            const atLaunchId = cleanArray(f['Lanzamiento Vinculado']);
            
            if (atLaunchId) sbLaunchId = launchMapById.get(atLaunchId);
            
            if (!sbLaunchId) {
                const textName = cleanText(f['Nombre PPS']);
                const textDate = f['Fecha Inicio'];
                if (textName) {
                    const nName = normalize(textName);
                    const nDate = getDateKey(textDate);
                    sbLaunchId = launchMapByNameDate.get(`${nName}|${nDate}`) || launchMapByName.get(nName);
                }
            }

            // Datos a guardar
            const payload = {
                airtable_id: record.id,
                created_at: record.createdTime,
                estudiante_id: sbStudentId,
                lanzamiento_id: sbLaunchId,
                nombre_pps: cleanArray(f['Nombre PPS']),
                fecha_inicio: f['Fecha Inicio'],
                fecha_finalizacion: f['Fecha Finalización'],
                estado_inscripcion: cleanText(f['Estado']),
                horario_seleccionado: cleanText(f['Horario']),
                orientacion: cleanText(f['Orientación']),
                direccion: cleanText(f['Dirección']),
                termino_cursar: cleanText(f['¿Terminó de cursar?']),
                finales_adeuda: cleanText(f['Finales que adeuda']),
                otra_situacion_academica: cleanText(f['Otra situación académica']),
                cursando_electivas: cleanText(f['¿Está cursando electivas?']),
                legajo: cleanArray(f['Legajo']),
                dni: cleanArray(f['DNI']),
                correo: cleanArray(f['Correo']),
                telefono: cleanArray(f['Teléfono']),
            };

            if (sbStudentId && sbLaunchId) {
                const compositeKey = `${sbStudentId}_${sbLaunchId}`;
                
                if (processedCompositeKeys.has(compositeKey)) {
                    stats.skipped++;
                    continue;
                }
                processedCompositeKeys.add(compositeKey);

                // A. Buscar el registro "Lógico" (El que tiene la verdad de negocio: Estudiante + Lanzamiento)
                const { data: existingByLogic } = await supabaseOperationWithRetry(() => 
                    supabase.from('convocatorias').select('id, airtable_id').eq('estudiante_id', sbStudentId).eq('lanzamiento_id', sbLaunchId).maybeSingle()
                );

                // B. Buscar el registro "Técnico" (El que tiene el ID de Airtable actual)
                const { data: existingById } = await supabaseOperationWithRetry(() => 
                    supabase.from('convocatorias').select('id').eq('airtable_id', record.id).maybeSingle()
                );

                if (existingByLogic) {
                    // Existe el registro lógico. 
                    
                    // ¿Necesitamos cambiarle el ID de Airtable?
                    if (existingByLogic.airtable_id !== record.id) {
                        
                        // COLISIÓN: ¿El ID nuevo ya lo tiene otro registro diferente?
                        if (existingById && existingById.id !== existingByLogic.id) {
                            // SÍ. Eliminamos al usurpador para liberar el ID.
                            await supabaseOperationWithRetry(() => supabase.from('convocatorias').delete().eq('id', existingById.id));
                            stats.collisionsFixed++;
                        }
                        stats.reconciled++;
                    } else {
                        stats.updated++;
                    }

                    // Actualizamos el registro lógico (ahora seguro)
                    const { error } = await supabaseOperationWithRetry(() => 
                        supabase.from('convocatorias').update(payload).eq('id', existingByLogic.id)
                    );
                    
                    if (error) {
                        console.error(`❌ Error actualizando ${existingByLogic.id}:`, error.message);
                        stats.errors++;
                    }

                } else {
                    // No existe el registro lógico.
                    // Si 'existingById' existe, se actualizará (es un cambio de estudiante/lanzamiento en Airtable).
                    // Si no existe, se insertará.
                    // Upsert maneja esto, pero usamos nuestra función con retry.
                    const { error } = await supabaseOperationWithRetry(() => 
                        supabase.from('convocatorias').upsert(payload, { onConflict: 'airtable_id' })
                    );
                    
                    if (error) {
                         console.error(`❌ Error upsert ${record.id}:`, error.message);
                         stats.errors++;
                    } else {
                        stats.inserted++;
                    }
                }
            } else {
                // Sin vínculos, solo confiamos en el ID de Airtable (Snapshot)
                const { error } = await supabaseOperationWithRetry(() => 
                    supabase.from('convocatorias').upsert(payload, { onConflict: 'airtable_id' })
                );
                
                if (error) stats.errors++;
                else stats.inserted++;
            }
        }

        console.log(`\n✅ SINCRONIZACIÓN COMPLETADA.`);
        console.log(`   📊 Resumen:`);
        console.log(`   - Insertados/Normales:   ${stats.inserted}`);
        console.log(`   - Actualizados:          ${stats.updated}`);
        console.log(`   - Reconciliados (Fix):   ${stats.reconciled}`);
        console.log(`   - Colisiones Eliminadas: ${stats.collisionsFixed} (Corrección 'Duplicate Key')`);
        console.log(`   - Saltados (Dupl. hoy):  ${stats.skipped}`);
        console.log(`   - Errores:               ${stats.errors}`);

    } catch (e) {
        console.error("\n❌ Error fatal:", e);
    }
}

main();
