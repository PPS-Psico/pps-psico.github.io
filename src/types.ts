import { Database } from "./types/supabase";

// --- Supabase Tables Shortcuts ---
type Tables = Database["public"]["Tables"];

// --- Base Record Type (Optional helper if you still use it) ---
export type AppRecord<T> = T & {
  id: string;
  createdTime?: string; // Legacy alias mapping to created_at
  [key: string]: any;
};

// Map strict Database types to App types
export type Estudiante = Tables["estudiantes"]["Row"];
export type Practica = Tables["practicas"]["Row"];
export type SolicitudPPS = Tables["solicitudes_pps"]["Row"];
export type LanzamientoPPS = Tables["lanzamientos_pps"]["Row"];
export type Convocatoria = Tables["convocatorias"]["Row"];
export type Institucion = Tables["instituciones"]["Row"] & {
  logo_url?: string | null;
  logo_invert_dark?: boolean | null;
};
export type FinalizacionPPS = Tables["finalizacion_pps"]["Row"];
export type Penalizacion = Tables["penalizaciones"]["Row"];

// Helper aliases for components that expect "Fields" suffix
export type EstudianteFields = Estudiante;
export type PracticaFields = Practica;
export type SolicitudPPSFields = SolicitudPPS;
export type LanzamientoPPSFields = LanzamientoPPS;
export type ConvocatoriaFields = Convocatoria;
export type InstitucionFields = Institucion;
export type FinalizacionPPSFields = FinalizacionPPS;
export type PenalizacionFields = Penalizacion;

// --- Strict Joined Types for Services ---
export type PracticaWithLanzamiento = Practica & {
  lanzamiento: Pick<
    LanzamientoPPS,
    "nombre_pps" | "orientacion" | "fecha_inicio" | "fecha_finalizacion"
  > | null;
};

export type SolicitudWithEstudiante = SolicitudPPS & {
  estudiante: Pick<Estudiante, "nombre" | "legajo" | "correo"> | null;
};

export type AirtableRecord<T> = AppRecord<T>;

export interface AppError {
  type: string;
  message: string;
}

export interface AppErrorResponse {
  error: AppError | string;
}

export const ALL_ORIENTACIONES = ["Clinica", "Educacional", "Laboral", "Comunitaria"] as const;
export type Orientacion = (typeof ALL_ORIENTACIONES)[number];

export type TabId =
  | "inicio"
  | "solicitudes"
  | "practicas"
  | "profile"
  | "calendario"
  | "finalizacion"
  | "informes";

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
  // TODO: Use `informeTask` property in components instead:
  // informeTask: string;
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
  cantPracticas: number; // Nuevo campo para detectar ingresantes absolutos
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
  colorClasses: { tag: string; dot: string };
  startDate?: string | null;
  endDate?: string | null;
}

export interface Attachment {
  url: string;
  filename?: string;
}

export type ReportType = "2024" | "2025" | "comparative";

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
  reportType: "singleYear";
  year: number;
  period: { current: { start: string; end: string }; previous: { start: string; end: string } };
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
  reportType: "comparative";
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
  launchesByMonth: { year2024: TimelineMonthData[]; year2025: TimelineMonthData[] };
  newAgreements: { year2024: string[]; year2025: string[] };
  ppsRequests: { year2024: PPSRequestSummary[]; year2025: PPSRequestSummary[] };
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
