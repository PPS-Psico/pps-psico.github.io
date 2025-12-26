
import { z } from 'zod';
import { Database } from './types/supabase';
import { 
    ALL_ORIENTACIONES,
    estudianteFieldsSchema,
    practicaFieldsSchema,
    solicitudPPSFieldsSchema,
    lanzamientoPPSFieldsSchema,
    convocatoriaFieldsSchema,
    institucionFieldsSchema,
    finalizacionPPSFieldsSchema,
    penalizacionFieldsSchema,
    authUserFieldsSchema
} from './schemas';

// --- Supabase Helpers ---
type Tables = Database['public']['Tables'];
export type TableRow<T extends keyof Tables> = Tables[T]['Row'];
export type TableInsert<T extends keyof Tables> = Tables[T]['Insert'];
export type TableUpdate<T extends keyof Tables> = Tables[T]['Update'];

export type { Database };

// --- Base Record Type ---
export type AppRecord<T> = T & {
  id: string;
  createdTime?: string; // Legacy alias for created_at
  [key: string]: any; 
};

export type AirtableRecord<T> = AppRecord<T>; 

export interface AppError {
  type: string;
  message: string;
}

export interface AppErrorResponse {
  error: AppError | string;
}

export type Orientacion = typeof ALL_ORIENTACIONES[number];
export { ALL_ORIENTACIONES };

// REMOVED 'informes' from TabId
export type TabId = 'inicio' | 'solicitudes' | 'practicas' | 'profile' | 'calendario' | 'finalizacion' | 'informes';

export interface CriteriosCalculados {
  horasTotales: number;
  horasFaltantes250: number;
  cumpleHorasTotales: boolean;
  horasOrientacionElegida: number;
  horasFaltantesOrientacion: number;
  cumpleHorasOrientacion: boolean;
  orientacionesCursadasCount: number;
  orientacionesUnicas: string[];
  cumpleRotacion: boolean;
  tienePracticasPendientes: boolean;
}

// --- Table Fields Interfaces (Inferred from Zod Schemas) ---
export type EstudianteFields = z.infer<typeof estudianteFieldsSchema>;
export type PracticaFields = z.infer<typeof practicaFieldsSchema>;
export type SolicitudPPSFields = z.infer<typeof solicitudPPSFieldsSchema>;
export type LanzamientoPPSFields = z.infer<typeof lanzamientoPPSFieldsSchema>;
export type ConvocatoriaFields = z.infer<typeof convocatoriaFieldsSchema>;
export type InstitucionFields = z.infer<typeof institucionFieldsSchema>;
export type FinalizacionPPSFields = z.infer<typeof finalizacionPPSFieldsSchema>;
export type PenalizacionFields = z.infer<typeof penalizacionFieldsSchema>;
export type AuthUserFields = z.infer<typeof authUserFieldsSchema>;

// --- Extended Types with ID ---
export type Penalizacion = AppRecord<PenalizacionFields>;
export type FinalizacionPPS = AppRecord<FinalizacionPPSFields>;
export type Practica = AppRecord<PracticaFields>;
export type SolicitudPPS = AppRecord<SolicitudPPSFields>;
export type LanzamientoPPS = AppRecord<LanzamientoPPSFields>;
export type Convocatoria = AppRecord<ConvocatoriaFields>;
export type Institucion = AppRecord<InstitucionFields>;
export type Estudiante = AppRecord<EstudianteFields>;


// --- Component-specific Types ---
export interface InformeTask {
  convocatoriaId: string;
  practicaId?: string;
  ppsName: string;
  informeLink?: string;
  fechaFinalizacion: string;
  informeSubido: boolean;
  nota?: string | null;
  fechaEntregaInforme?: string | null;
}

export type SelectedStudent = { nombre: string; legajo: string };
export type GroupedSeleccionados = { [key: string]: SelectedStudent[] };

export interface EnrichedStudent {
    enrollmentId: string;
    studentId: string;
    nombre: string;
    legajo: string;
    correo: string;
    status: string;
    terminoCursar: boolean;
    cursandoElectivas: boolean;
    finalesAdeuda: string;
    notasEstudiante: string;
    totalHoras: number;
    penalizacionAcumulada: number;
    puntajeTotal: number;
    horarioSeleccionado: string;
    trabaja: boolean;
    certificadoTrabajo: string | null;
    cvUrl: string | null;
}

export interface InformeCorreccionStudent {
  studentId: string;
  studentName: string;
  convocatoriaId: string;
  practicaId?: string | null;
  informeSubido: boolean | null;
  nota: string;
  lanzamientoId: string;
  orientacion?: string | null;
  fechaInicio?: string | null;
  fechaFinalizacionPPS?: string | null;
  fechaEntregaInforme?: string | null;
}

export interface InformeCorreccionPPS {
  lanzamientoId: string;
  ppsName: string | null;
  orientacion: string | null;
  informeLink?: string | null;
  fechaFinalizacion?: string | null;
  students: InformeCorreccionStudent[];
}

export interface FlatCorreccionStudent extends InformeCorreccionStudent {
    ppsName: string | null;
    informeLink?: string | null;
    correctionDeadline?: string;
}

export interface CalendarEvent {
    id: string;
    name: string;
    schedule: string;
    orientation: string;
    location: string;
    colorClasses: { tag: string; dot: string; };
    startDate?: string | null;
    endDate?: string | null;
}

export interface Attachment {
  url: string;
  filename?: string;
}

export type ReportType = '2024' | '2025' | 'comparative';

export interface TimelineMonthData {
    monthName: string;
    ppsCount: number;
    cuposTotal: number;
    institutions: { name: string; cupos: number; variants: string[] }[];
}

interface KPISnapshot {
    current: number;
    previous: number;
}

export interface PPSRequestSummary {
    id: string;
    studentName: string;
    studentLegajo: string;
    institutionName: string;
    requestDate: string;
    status: string;
}

export interface ExecutiveReportData {
    reportType: 'singleYear';
    year: number;
    period: { current: { start: string; end: string }; previous: { start: string; end: string }; };
    summary: string;
    kpis: {
        activeStudents: KPISnapshot;
        studentsWithoutAnyPps: KPISnapshot;
        newStudents: KPISnapshot;
        finishedStudents: KPISnapshot;
        newPpsLaunches: KPISnapshot;
        totalOfferedSpots: KPISnapshot;
        newAgreements: KPISnapshot;
    };
    launchesByMonth: TimelineMonthData[];
    newAgreementsList: string[];
    ppsRequests: PPSRequestSummary[];
}

interface KPIComparison {
    year2024: number;
    year2025: number;
}
export interface ComparativeExecutiveReportData {
    reportType: 'comparative';
    summary: string;
    kpis: {
        activeStudents: KPIComparison;
        studentsWithoutAnyPps: KPIComparison;
        finishedStudents: KPIComparison;
        newStudents: KPIComparison;
        newPpsLaunches: KPIComparison;
        totalOfferedSpots: KPIComparison;
        newAgreements: KPIComparison;
    };
    launchesByMonth: { year2024: TimelineMonthData[]; year2025: TimelineMonthData[]; };
    newAgreements: { year2024: string[]; year2025: string[]; };
    ppsRequests: { year2024: PPSRequestSummary[]; year2025: PPSRequestSummary[]; };
}

export type AnyReportData = ExecutiveReportData | ComparativeExecutiveReportData;

export interface StudentInfo {
  legajo: string;
  nombre: string;
  institucion?: string;
  fechaFin?: string;
  ppsId?: string;
  [key: string]: any;
}
