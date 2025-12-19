
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN DE CREDENCIALES
// ==============================================================================

const AIRTABLE_PAT = "PEGAR_AQUI_TU_AIRTABLE_PAT"; 
const AIRTABLE_BASE_ID = "PEGAR_AQUI_TU_BASE_ID"; 

const SUPABASE_URL = "PEGAR_AQUI_TU_SUPABASE_URL"; 
// ¡IMPORTANTE! Usar la SERVICE_ROLE_KEY para tener permisos de escritura
const SUPABASE_SERVICE_KEY = "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

// ==============================================================================

if (AIRTABLE_PAT.includes("PEGAR_AQUI") || SUPABASE_URL.includes("PEGAR_AQUI")) {
    console.error("❌ ERROR: Edita el archivo scripts/migrate.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const idMap = new Map(); // Airtable ID -> Supabase UUID

// --- Funciones Auxiliares ---

async function fetchAllAirtable(airtableTableName) {
    let allRecords = [];
    let offset = null;
    console.log(`📥 Descargando '${airtableTableName}' de Airtable...`);

    try {
        do {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(airtableTableName)}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
            if (!res.ok) throw new Error(`Error Airtable (${res.status}): ${await res.text()}`);
            const data = await res.json();
            allRecords = [...allRecords, ...data.records];
            offset = data.offset;
            if(offset) await new Promise(r => setTimeout(r, 200)); 
        } while (offset);
        return allRecords;
    } catch (error) {
        console.error(`   ❌ Falló la descarga de '${airtableTableName}'.`);
        throw error;
    }
}

// Helpers de Limpieza
const cleanArray = (val) => (Array.isArray(val) ? val[0] : val) || null;
const cleanDate = (val) => val || null;
const cleanNum = (val) => (val ? Number(val) : null);
const cleanText = (val) => (val ? String(val).trim() : null);

// --- Mapeadores Exactos basados en tu Log ---

const mapEstudiante = (f) => ({
    legajo: cleanText(f['Legajo']),
    nombre: cleanText(f['Nombre']),
    dni: cleanNum(f['DNI']),
    correo: cleanText(f['Correo']),
    telefono: cleanText(f['Teléfono']),
    orientacion_elegida: cleanText(f['Orientación Elegida']),
    notas_internas: cleanText(f['Notas Internas']), 
    fecha_nacimiento: cleanDate(f['Fecha de Nacimiento']),
    // El log dice "Fecha de creación", usamos esa como fallback si no hay fecha fin
    fecha_finalizacion: cleanDate(f['Fecha de creación']), 
    // Mapeo exacto del log:
    nombre_separado: cleanText(f['Nombre (Separado)']),
    apellido_separado: cleanText(f['Apellido (Separado)']),
    // Campos calculados no están en el log directo, se infieren o dejan null
});

const mapInstitucion = (f) => ({
    nombre: cleanText(f['Nombre']),
    // El log mostró: "Tipo de Institución", "Tutor", "Convenio Nuevo", "Cantidad de alumnos...".
    // No mostró dirección explícita en el log, intentar 'Dirección' por las dudas, o dejar null.
    convenio_nuevo: !!f['Convenio Nuevo'],
    tutor: cleanText(f['Tutor'])
});

const mapLanzamiento = (f) => ({
    nombre_pps: cleanText(f['Nombre PPS']),
    fecha_inicio: cleanDate(f['Fecha Inicio']),
    fecha_finalizacion: cleanDate(f['Fecha Finalización']),
    orientacion: cleanText(f['Orientación']),
    cupos_disponibles: cleanNum(f['Cupos disponibles']),
    horas_acreditadas: cleanNum(f['Horas Acreditadas']),
    estado_convocatoria: cleanText(f['Estado de Convocatoria']),
});

const mapConvocatoria = (f) => ({
    lanzamiento_id: idMap.get(cleanArray(f['Lanzamiento Vinculado'])),
    estudiante_id: idMap.get(cleanArray(f['Estudiante Inscripto'])),
    estado_inscripcion: cleanText(f['Estado']),
    horario_seleccionado: cleanText(f['Horario']),
    termino_cursar: cleanText(f['¿Terminó de cursar?']),
    finales_adeuda: cleanText(f['Finales que adeuda']),
    otra_situacion_academica: cleanText(f['Otra situación académica']),
    // Nuevos campos detectados en log:
    // "Puntaje Total", "Puntaje Estado Curso", etc. (Se calculan en frontend, no es crítico migrarlos si no hay columna)
});

const mapPractica = (f) => ({
    estudiante_id: idMap.get(cleanArray(f['Estudiante Inscripto'])),
    lanzamiento_id: idMap.get(cleanArray(f['Lanzamiento Vinculado'])),
    horas_realizadas: cleanNum(f['Horas Realizadas']),
    fecha_inicio: cleanDate(f['Fecha de Inicio']),
    fecha_finalizacion: cleanDate(f['Fecha de Finalización']),
    estado: cleanText(f['Estado']),
    especialidad: cleanText(f['Especialidad']),
    nota: cleanText(f['Nota']),
    // En el log vi "Nombre busqueda" (Array)
    nombre_institucion: cleanArray(f['Nombre busqueda']) // Guardamos el nombre plano como backup
});

const mapSolicitud = (f) => {
    // Log: "Nombre" es el vínculo al estudiante
    const estId = idMap.get(cleanArray(f['Nombre'])); 
    return {
        estudiante_id: estId,
        nombre_institucion: cleanText(f['Nombre de la Institución']),
        estado_seguimiento: cleanText(f['Estado de seguimiento']),
        actualizacion: cleanDate(f['Actualización'] || f['Última modificación']),
        // Campos exactos del log:
        orientacion_sugerida: cleanArray(f['Orientación Sugerida']),
        localidad: cleanText(f['Localidad']),
        direccion_completa: cleanText(f['Dirección completa']),
        email_institucion: cleanText(f['Correo electrónico de contacto de la institución']),
        telefono_institucion: cleanText(f['Teléfono de contacto de la institución']),
        referente_institucion: cleanText(f['Nombre del referente de la institución']),
        convenio_uflo: cleanText(f['¿La institución tiene convenio firmado con UFLO?']),
        tutor_disponible: cleanText(f['¿La institución cuenta con un psicólogo/a que pueda actuar como tutor/a de la práctica?']),
        contacto_tutor: cleanText(f['Contacto del tutor (Teléfono o Email)']),
        tipo_practica: cleanText(f['Práctica para uno o más estudiantes']),
        descripcion_institucion: cleanText(f['Breve descripción de la institución y de sus actividades principales']),
        // Snapshots
        email: cleanText(f['Email']),
        legajo: cleanText(f['Legajo']),
    };
};

const mapFinalizacion = (f) => ({
    estudiante_id: idMap.get(cleanArray(f['Nombre'])),
    estado: cleanText(f['Cargado']) ? 'Cargado' : 'Pendiente', 
    sugerencias_mejoras: cleanText(f['Sugerencia de mejoras para las PPS']),
    // Archivos detectados en log:
    informe_final_url: f['Informes'], 
    planilla_horas_url: f['Excel de Seguimiento'],
    planilla_asistencia_url: f['Planillas de asistencias '] // Nótese el espacio al final detectado en log
});

// --- Ejecución ---

async function migrateTable(tableName, sourceTable, mapper) {
    const records = await fetchAllAirtable(sourceTable);
    if (records.length === 0) return;

    console.log(`🚀 Procesando ${records.length} registros para '${tableName}'...`);
    const mapped = [];

    for (const rec of records) {
        try {
            const row = mapper(rec.fields);
            row.airtable_id = rec.id;
            row.created_at = rec.fields['Creada'] || rec.createdTime; // Fallback
            mapped.push(row);
        } catch (e) {
            console.warn(`Skipping ${rec.id}: ${e.message}`);
        }
    }

    // Usamos Upsert con la clave 'airtable_id'.
    // Esto significa:
    // 1. Si existe un registro con ese ID de Airtable, lo actualiza.
    // 2. Si no existe, lo crea.
    // 3. Si tienes registros creados a mano en Supabase (sin airtable_id o con uno diferente), NO LOS TOCA.
    
    const batchSize = 50;
    for (let i = 0; i < mapped.length; i += batchSize) {
        const batch = mapped.slice(i, i + batchSize);
        const { data, error } = await supabase.from(tableName).upsert(batch, { onConflict: 'airtable_id' }).select('id, airtable_id');
        
        if (error) console.error(`❌ Error batch ${i} en ${tableName}:`, error.message);
        else if (data) data.forEach(r => idMap.set(r.airtable_id, r.id));
    }
}

async function main() {
    console.log("=== INICIO MIGRACIÓN (MODO FUSIÓN) ===");
    console.log("ℹ️  Este script respeta los datos creados manualmente en Supabase.");
    
    // Primero cargamos el mapa de IDs existentes en Supabase para vincular correctamente
    // incluso si no actualizamos la tabla estudiantes.
    const { data: existingStudents } = await supabase.from('estudiantes').select('id, airtable_id');
    if(existingStudents) existingStudents.forEach(s => { if(s.airtable_id) idMap.set(s.airtable_id, s.id); });

    const { data: existingLaunches } = await supabase.from('lanzamientos_pps').select('id, airtable_id');
    if(existingLaunches) existingLaunches.forEach(l => { if(l.airtable_id) idMap.set(l.airtable_id, l.id); });

    // Orden de migración
    await migrateTable('estudiantes', 'Estudiantes', mapEstudiante);
    await migrateTable('instituciones', 'Instituciones', mapInstitucion);
    await migrateTable('lanzamientos_pps', 'Lanzamientos de PPS', mapLanzamiento);
    await migrateTable('convocatorias', 'Convocatorias', mapConvocatoria);
    await migrateTable('practicas', 'Prácticas', mapPractica);
    await migrateTable('solicitudes_pps', 'Solicitud de PPS', mapSolicitud);
    await migrateTable('finalizacion_pps', 'Finalización de PPS', mapFinalizacion);

    console.log("=== FIN ===");
}

main();
