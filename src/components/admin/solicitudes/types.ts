import type { SolicitudPPSFields, FinalizacionPPSFields } from "../../../types";

// ─── Tipos y relaciones del módulo de Solicitudes ───────────────────

export interface StudentRelation {
  nombre: string | null;
  legajo: string | null;
  correo: string | null;
}

export interface SolicitudPPSWithStudent extends SolicitudPPSFields {
  id: string;
  _studentName: string;
  _studentLegajo: string;
  _studentEmail: string;
  _daysSinceUpdate: number;
  estudiantes?: StudentRelation | null;
}

export interface FinalizacionWithStudent extends FinalizacionPPSFields {
  id: string;
  studentName: string;
  studentLegajo: string;
  studentEmail: string;
  createdTime: string;
}

export interface SolicitudModificacion {
  id: string;
  estudiante_id: string;
  practica_id: string;
  tipo_modificacion: string;
  horas_nuevas: number | null;
  planilla_asistencia_url: string | null;
  estado: string;
  comentario_rechazo: string | null;
  notas_admin: string | null;
  created_at: string;
  estudiante: {
    id: string;
    nombre: string;
    legajo: string;
    correo: string;
  } | null;
  practica: {
    id: string;
    nombre_institucion: string | null;
    horas_realizadas: number | null;
    especialidad: string | null;
  } | null;
}

export interface SolicitudNueva {
  id: string;
  estudiante_id: string;
  institucion_id: string | null;
  nombre_institucion_manual: string | null;
  orientacion: string;
  fecha_inicio: string;
  fecha_finalizacion: string;
  horas_estimadas: number;
  planilla_asistencia_url: string | null;
  informe_final_url: string;
  es_online: boolean;
  estado: string;
  comentario_rechazo: string | null;
  notas_admin: string | null;
  created_at: string;
  estudiante: {
    id: string;
    nombre: string;
    legajo: string;
    correo: string;
  } | null;
  institucion: {
    id: string;
    nombre: string;
  } | null;
}

export type TabType = "ingreso" | "egreso" | "correcciones";
