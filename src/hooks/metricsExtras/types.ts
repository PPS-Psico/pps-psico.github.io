import type { StudentInfo } from "../../types";

export type Tone = "accent" | "warn" | "ok" | "ai" | "ink";
export type OrientKey = "clinica" | "educacional" | "laboral" | "comunitaria" | "sindefinir";

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  note: string;
  tone: Tone;
  /**
   * Cómo nombrar a los que no llegaron a esta etapa desde la anterior.
   * Por defecto "quedaron en el camino" (implica que el proceso no avanzó). Para
   * etapas donde los que faltan en realidad SIGUEN en curso (ej. Finalizados en
   * un año abierto), se usa "siguen en curso" para no implicar abandono.
   */
  dropLabel?: string;
}

export interface TopInstitucion {
  nombre: string;
  orient: OrientKey;
  ofrecidos: number;
  ocupados: number;
  list: StudentInfo[];
}

export interface HeroSeries {
  matriculaGenerada: { year: number; value: number }[];
  finalizados: { year: number; value: number }[];
  matriculaActiva: { year: number; value: number }[];
  years: number[];
}

export interface TimelineEvent {
  fecha: string;
  orden: number;
  tipo: "lanzamiento" | "inscripcion" | "seleccion" | "inicio" | "cierre" | "convenio";
  titulo: string;
  detalle: string;
  tone: Tone;
  /** Listado completo de ítems del hito (p. ej. todas las PPS lanzadas en el mes). */
  items?: string[];
}
