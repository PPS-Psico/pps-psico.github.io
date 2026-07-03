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
export type SolicitudModificacionPPS = Tables["solicitudes_modificacion_pps"]["Row"];
export type SolicitudNuevaPPS = Tables["solicitudes_nueva_pps"]["Row"];
export type CompromisoPPS = Tables["compromisos_pps"]["Row"];
export type Convenio = Tables["convenios"]["Row"];

// Helper aliases for components that expect "Fields" suffix
export type EstudianteFields = Estudiante;
export type PracticaFields = Practica;
export type SolicitudPPSFields = SolicitudPPS;
export type LanzamientoPPSFields = LanzamientoPPS;
export type ConvocatoriaFields = Convocatoria;
export type InstitucionFields = Institucion;
export type FinalizacionPPSFields = FinalizacionPPS;
export type PenalizacionFields = Penalizacion;
export type SolicitudModificacionPPSFields = SolicitudModificacionPPS;
export type SolicitudNuevaPPSFields = SolicitudNuevaPPS;
export type CompromisoPPSFields = CompromisoPPS;
export type ConvenioFields = Convenio;

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

export type EntityRecord<T> = AppRecord<T>;
// Legacy alias kept temporarily for compatibility during the naming cleanup.
export type AirtableRecord<T> = AppRecord<T>;

export interface AppError {
  type: string;
  message: string;
}

export interface AppErrorResponse {
  error: AppError | string;
}

export const ALL_ORIENTACIONES = ["Clínica", "Educacional", "Laboral", "Comunitaria"] as const;
export type Orientacion = (typeof ALL_ORIENTACIONES)[number];

export type TabId =
  | "inicio"
  | "convocatorias"
  | "aula"
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

export type SelectedStudent = {
  nombre: string;
  legajo: string;
  compromisoEstado?: string | null;
  compromisoFecha?: string | null;
};
export type GroupedSeleccionados = { [key: string]: SelectedStudent[] };

export interface EnrichedStudent {
  enrollmentId: string;
  studentId: string;
  userId?: string; // Add this to link with FCM tokens
  nombre: string;
  legajo: string;
  correo: string;
  telefono?: string; // Campo opcional para contacto WhatsApp
  status: string;
  terminoCursar: boolean;
  cursandoElectivas: boolean;
  finalesAdeuda: string;
  notasEstudiante: string;
  totalHoras: number;
  cantPracticas: number; // Nuevo campo para detectar ingresantes absolutos
  penalizacionAcumulada: number;
  puntajeTotal: number;
  horarioSeleccionado: string; // Horarios solicitados (originales separados por ;)
  horarioAsignado?: string; // Horario final asignado por el admin
  trabaja: boolean;
  certificadoTrabajo: string | null;
  cvUrl: string | null;
  compromisoEstado?: string | null;
  compromisoFecha?: string | null;
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

/**
 * Selección del reporte ejecutivo clásico (estadísticas duras).
 * Reemplaza al viejo `ReportType` hardcodeado a 2024/2025: ahora cualquier año
 * es válido y el comparativo acepta dos años arbitrarios.
 */
export type ReportMode = "single" | "comparative";

export interface ReportSelection {
  mode: ReportMode;
  /** Año principal del balance. */
  year: number;
  /** Año contra el cual comparar (solo en modo "comparative"). Por defecto year - 1. */
  compareYear?: number;
}

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

/**
 * Ficha de un convenio nuevo del año para el reporte ejecutivo: institución,
 * orientación, y la rotación histórica (cuántas PPS y cuántos cupos por año).
 */
export interface NewAgreementYearStat {
  year: number;
  rotaciones: number; // cantidad de lanzamientos ese año
  cupos: number; // cupos ofertados ese año
}
export interface NewAgreementDetail {
  institucion: string;
  anioConvenio: number | null;
  orientaciones: string[];
  totalRotaciones: number;
  totalCupos: number;
  totalEstudiantes: number;
  porAnio: NewAgreementYearStat[];
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
  newAgreementsDetail: NewAgreementDetail[];
  ppsRequests: PPSRequestSummary[];
}

interface KPIComparison {
  /** Valor del año base (yearA, el más antiguo de los dos). */
  yearA: number;
  /** Valor del año comparado (yearB, el más reciente). */
  yearB: number;
}
export interface ComparativeExecutiveReportData {
  reportType: "comparative";
  /** Año base de la comparación (el más antiguo). */
  yearA: number;
  /** Año comparado (el más reciente). */
  yearB: number;
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
  launchesByMonth: { yearA: TimelineMonthData[]; yearB: TimelineMonthData[] };
  newAgreements: { yearA: string[]; yearB: string[] };
  ppsRequests: { yearA: PPSRequestSummary[]; yearB: PPSRequestSummary[] };
}

export type AnyReportData = ExecutiveReportData | ComparativeExecutiveReportData;

export interface StudentInfo {
  legajo: string;
  nombre: string;
  institucion?: string;
  fechaFin?: string;
  ppsId?: string;
  [key: string]: unknown;
}

/**
 * Datos que el formulario de inscripción (`EnrollmentForm`) entrega al
 * handler de inscripción. Es el resultado del schema zod del formulario más
 * las URLs ya subidas del certificado laboral y el CV.
 */
export interface EnrollmentFormData {
  terminoDeCursar: boolean | null;
  cursandoElectivas: boolean | null;
  finalesAdeudados: string;
  otraSituacionAcademica: string;
  horarios: string[];
  trabaja: boolean;
  certificadoLink?: string;
  certificadoTrabajoUrl?: string;
  cvUrl?: string;
  /** Campos auxiliares del formulario que el handler ignora. */
  [key: string]: unknown;
}
