
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

type Tables = Database['public']['Tables'];

/**
 * Generic helper to add AppRecord specific fields
 */
const toAppRecord = <T extends { id: string; created_at: string }>(row: T): T & { createdTime: string } => {
    return {
        ...row,
        createdTime: row.created_at,
        // Ensure id is string (Supabase IDs are strings/UUIDs, but just in case)
        id: String(row.id)
    };
};

export const mapEstudiante = (row: Tables['estudiantes']['Row']): AppRecord<EstudianteFields> => {
    return toAppRecord(row) as unknown as AppRecord<EstudianteFields>;
};

export const mapPractica = (row: Tables['practicas']['Row']): AppRecord<PracticaFields> => {
    return toAppRecord(row) as unknown as AppRecord<PracticaFields>;
};

export const mapSolicitud = (row: Tables['solicitudes_pps']['Row']): AppRecord<SolicitudPPSFields> => {
    return toAppRecord(row) as unknown as AppRecord<SolicitudPPSFields>;
};

export const mapLanzamiento = (row: Tables['lanzamientos_pps']['Row']): AppRecord<LanzamientoPPSFields> => {
    return toAppRecord(row) as unknown as AppRecord<LanzamientoPPSFields>;
};

export const mapConvocatoria = (row: Tables['convocatorias']['Row']): AppRecord<ConvocatoriaFields> => {
    return toAppRecord(row) as unknown as AppRecord<ConvocatoriaFields>;
};

export const mapInstitucion = (row: Tables['instituciones']['Row']): AppRecord<InstitucionFields> => {
    return toAppRecord(row) as unknown as AppRecord<InstitucionFields>;
};

export const mapPenalizacion = (row: Tables['penalizaciones']['Row']): AppRecord<PenalizacionFields> => {
    return toAppRecord(row) as unknown as AppRecord<PenalizacionFields>;
};

export const mapFinalizacion = (row: Tables['finalizacion_pps']['Row']): AppRecord<FinalizacionPPSFields> => {
    return toAppRecord(row) as unknown as AppRecord<FinalizacionPPSFields>;
};
