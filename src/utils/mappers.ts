import type { Database } from '../types/supabase';
import type {
    AppRecord,
    EstudianteFields,
    PracticaFields,
    SolicitudPPSFields,
    LanzamientoPPSFields,
    ConvocatoriaFields,
    InstitucionFields,
    PenalizacionFields,
    FinalizacionPPSFields
} from '../types';
import { cleanDbValue } from './formatters'; // Import cleanDbValue

type Tables = Database['public']['Tables'];

/**
 * Generic helper to add AppRecord specific fields
 */
const toAppRecord = <T extends { id: string; created_at: string }>(row: T): T & { createdTime: string } => {
    return {
        ...row,
        createdTime: row.created_at,
        id: String(row.id)
    };
};

export const mapEstudiante = (row: Tables['estudiantes']['Row']): AppRecord<EstudianteFields> => {
    const cleanRow = { ...row };
    // Asegurar campos críticos
    if (row.legajo) cleanRow.legajo = cleanDbValue(row.legajo);
    if (row.nombre) cleanRow.nombre = cleanDbValue(row.nombre);
    if (row.correo) cleanRow.correo = cleanDbValue(row.correo);

    // Explicitly cast to target intersection type which is safe here as we just decorated the row
    return toAppRecord(cleanRow) as AppRecord<EstudianteFields>;
};

export const mapPractica = (row: Tables['practicas']['Row']): AppRecord<PracticaFields> => {
    const cleanRow = { ...row };
    // Aplanar campos de texto que suelen venir como arrays de Airtable
    cleanRow.nombre_institucion = cleanDbValue(row.nombre_institucion);
    cleanRow.especialidad = cleanDbValue(row.especialidad);
    cleanRow.estado = cleanDbValue(row.estado);
    cleanRow.nota = cleanDbValue(row.nota);
    return toAppRecord(cleanRow) as AppRecord<PracticaFields>;
};

export const mapSolicitud = (row: Tables['solicitudes_pps']['Row']): AppRecord<SolicitudPPSFields> => {
    const cleanRow = { ...row };
    cleanRow.nombre_institucion = cleanDbValue(row.nombre_institucion);
    cleanRow.nombre_alumno = cleanDbValue(row.nombre_alumno);
    cleanRow.estado_seguimiento = cleanDbValue(row.estado_seguimiento);
    return toAppRecord(cleanRow) as AppRecord<SolicitudPPSFields>;
};

export const mapLanzamiento = (row: Tables['lanzamientos_pps']['Row']): AppRecord<LanzamientoPPSFields> => {
    const cleanRow = { ...row };
    cleanRow.nombre_pps = cleanDbValue(row.nombre_pps);
    cleanRow.orientacion = cleanDbValue(row.orientacion);
    cleanRow.estado_convocatoria = cleanDbValue(row.estado_convocatoria);
    return toAppRecord(cleanRow) as AppRecord<LanzamientoPPSFields>;
};

export const mapConvocatoria = (row: Tables['convocatorias']['Row']): AppRecord<ConvocatoriaFields> => {
    const cleanRow = { ...row };
    cleanRow.nombre_pps = cleanDbValue(row.nombre_pps);
    cleanRow.estado_inscripcion = cleanDbValue(row.estado_inscripcion);
    cleanRow.horario_seleccionado = cleanDbValue(row.horario_seleccionado);
    return toAppRecord(cleanRow) as AppRecord<ConvocatoriaFields>;
};

export const mapInstitucion = (row: Tables['instituciones']['Row']): AppRecord<InstitucionFields> => {
    const cleanRow = { ...row };
    cleanRow.nombre = cleanDbValue(row.nombre);
    cleanRow.direccion = cleanDbValue(row.direccion);
    cleanRow.tutor = cleanDbValue(row.tutor);
    return toAppRecord(cleanRow) as AppRecord<InstitucionFields>;
};

export const mapPenalizacion = (row: Tables['penalizaciones']['Row']): AppRecord<PenalizacionFields> => {
    return toAppRecord(row) as AppRecord<PenalizacionFields>;
};

export const mapFinalizacion = (row: Tables['finalizacion_pps']['Row']): AppRecord<FinalizacionPPSFields> => {
    const cleanRow = { ...row };
    cleanRow.estado = cleanDbValue(row.estado);
    return toAppRecord(cleanRow) as AppRecord<FinalizacionPPSFields>;
};

