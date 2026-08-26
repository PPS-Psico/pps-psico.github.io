import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
} from "../constants";
import type { Practica } from "../types";
import { normalizeStringForComparison, parseToUTCDate } from "../utils/formatters";

/**
 * Business Logic Layer for Student Rules
 * Contains pure functions determining student status, accreditation eligibility, and practice validity.
 */

// --- Constants ---
export const ACADEMIC_CONFIG = {
  HOURS_TOTAL_REQUIRED: 250,
  HOURS_SPECIALTY_REQUIRED: 70,
  ROTATION_AREAS_REQUIRED: 3,
  MAX_DAYS_INACTIVITY: 5, // For stagnant requests logic
};

// --- Practice Rules ---

/**
 * Determines if a practice is currently considered active/in-progress based on its status string.
 */
export const isPracticeActive = (status: string | null | undefined): boolean => {
  const s = normalizeStringForComparison(status);
  return s === "en curso" || s === "pendiente" || s === "en proceso";
};

/**
 * Determines if a practice is officially finished/approved.
 */
export const isPracticeFinished = (status: string | null | undefined): boolean => {
  const s = normalizeStringForComparison(status);
  return (
    s === "finalizada" || s === "pps realizada" || s === "convenio realizado" || s === "aprobada"
  );
};

export const isPracticeDisapproved = (status: string | null | undefined): boolean =>
  normalizeStringForComparison(status) === "desaprobada";

export type PracticePresentationTone = "active" | "complete" | "danger" | "neutral";

export interface PracticePresentationStatus {
  label: "En curso" | "Finalizada" | "Desaprobada" | "No concretada" | "Por verificar";
  tone: PracticePresentationTone;
}

/**
 * Canonical student-facing status. Desktop and mobile must consume this helper
 * instead of deriving their own truth from dates or display copy.
 */
export const getPracticePresentationStatus = (practice: Practica): PracticePresentationStatus => {
  const rawStatus = practice[FIELD_ESTADO_PRACTICA];
  const normalizedStatus = normalizeStringForComparison(rawStatus);

  if (isPracticeDisapproved(rawStatus)) {
    return { label: "Desaprobada", tone: "danger" };
  }
  if (isPracticeActive(rawStatus)) {
    return { label: "En curso", tone: "active" };
  }
  if (isPracticeFinished(rawStatus)) {
    return { label: "Finalizada", tone: "complete" };
  }
  if (normalizedStatus === "no se pudo concretar" || normalizedStatus === "cancelada") {
    return { label: "No concretada", tone: "neutral" };
  }
  return { label: "Por verificar", tone: "neutral" };
};

export const isPracticeStatusComputable = (status: string | null | undefined): boolean => {
  const normalizedStatus = normalizeStringForComparison(status);
  return normalizedStatus !== "desaprobada" && normalizedStatus !== "no se pudo concretar";
};

/** Una PPS desaprobada queda en el historial, pero no aporta ningún requisito. */
export const isPracticeComputable = (practice: Practica): boolean => {
  return isPracticeStatusComputable(practice[FIELD_ESTADO_PRACTICA]);
};

/**
 * Horas que aporta una práctica a los totales del estudiante.
 *
 * Mientras está "En curso" cuenta el objetivo del lanzamiento (no las horas ya
 * cargadas): es la misma cifra que ya se le muestra en la fila de la práctica, y
 * mostrar un total distinto ahí confunde más de lo que cuida. No relaja el trámite
 * de acreditación: ese exige además cero prácticas activas (`hasBlockingActivePractices`),
 * así que mientras haya una "En curso" el estudiante no puede iniciarlo igual — y una vez
 * finalizada, esta función ya usa las horas reales.
 */
export const getEffectiveHours = (
  practice: Practica & { horasObjetivo?: number | null }
): number => {
  const horasReales = Number(practice[FIELD_HORAS_PRACTICAS] || 0);
  if (!isPracticeActive(practice[FIELD_ESTADO_PRACTICA])) return horasReales;
  return Math.max(horasReales, Number(practice.horasObjetivo || 0));
};

/**
 * Checks if an active practice has exceeded its end date.
 */
export const isPracticeOverdue = (practice: Practica): boolean => {
  if (!isPracticeActive(practice[FIELD_ESTADO_PRACTICA])) return false;

  const endDateStr = practice[FIELD_FECHA_FIN_PRACTICAS];
  if (!endDateStr) return false;

  const endDate = parseToUTCDate(endDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return !!endDate && endDate < now;
};

/**
 * Estado de la práctica para mostrar. El `estado` guardado puede quedar
 * desactualizado en "En curso": el auto-cierre por calendario solo corre cuando
 * el estudiante entra a su panel (ver `useStudentPracticas`), así que las vistas
 * de admin veían "En curso" en PPS ya terminadas. La nota del informe no cambia
 * esto: si la fecha de fin pasó, la PPS está finalizada.
 */
export const getEffectivePracticeStatus = (practice: Practica): string | null | undefined =>
  isPracticeOverdue(practice) ? "Finalizada" : practice[FIELD_ESTADO_PRACTICA];

// --- Aggregation Logic ---

/**
 * Calculates total hours from a list of practices.
 */
export const calculateTotalHours = (practices: Practica[]): number => {
  return practices.filter(isPracticeComputable).reduce((acc, p) => acc + getEffectiveHours(p), 0);
};

/**
 * Calculates hours specific to a target orientation (specialty).
 */
export const calculateSpecialtyHours = (
  practices: Practica[],
  targetOrientation: string
): number => {
  if (!targetOrientation) return 0;
  const normalizedTarget = normalizeStringForComparison(targetOrientation);

  return practices
    .filter(
      (p) =>
        isPracticeComputable(p) &&
        normalizeStringForComparison(p[FIELD_ESPECIALIDAD_PRACTICAS]) === normalizedTarget
    )
    .reduce((acc, p) => acc + getEffectiveHours(p), 0);
};

/**
 * Extracts unique orientations from a list of practices.
 */
export const getUniqueOrientations = (practices: Practica[]): string[] => {
  const normalizedMap = new Map<string, string>();

  practices.filter(isPracticeComputable).forEach((p) => {
    const raw = String(p[FIELD_ESPECIALIDAD_PRACTICAS] || "");
    if (!raw) return;

    const normalized = normalizeStringForComparison(raw);

    // Si ya existe y es la versión con acento, no hacemos nada.
    // Si no existe, o si es 'clinica' y queremos asegurar el acento:
    if (!normalizedMap.has(normalized) || (normalized === "clinica" && !raw.includes("í"))) {
      const valueToSet = normalized === "clinica" ? "Clínica" : raw;
      normalizedMap.set(normalized, valueToSet);
    }
  });

  return Array.from(normalizedMap.values());
};

/**
 * Check if the student has any active practice that prevents accreditation.
 */
export const hasBlockingActivePractices = (practices: Practica[]): boolean => {
  return practices.some((p) => isPracticeActive(p[FIELD_ESTADO_PRACTICA]));
};

// --- Graduation Rules ---

export interface GraduationStatus {
  canGraduate: boolean;
  requirements: {
    totalHours: boolean;
    specialtyHours: boolean;
    rotation: boolean;
    noActivePractices: boolean;
  };
}

/**
 * Comprehensive check to see if a student meets all criteria for accreditation.
 */
export const checkGraduationStatus = (
  practices: Practica[],
  selectedOrientation: string,
  config = ACADEMIC_CONFIG
): GraduationStatus => {
  const totalHours = calculateTotalHours(practices);
  const specialtyHours = calculateSpecialtyHours(practices, selectedOrientation);
  const uniqueOrientations = getUniqueOrientations(practices);
  const hasActive = hasBlockingActivePractices(practices);

  const reqs = {
    totalHours: totalHours >= config.HOURS_TOTAL_REQUIRED,
    specialtyHours: specialtyHours >= config.HOURS_SPECIALTY_REQUIRED,
    rotation: uniqueOrientations.length >= config.ROTATION_AREAS_REQUIRED,
    noActivePractices: !hasActive,
  };

  return {
    canGraduate: reqs.totalHours && reqs.specialtyHours && reqs.rotation && reqs.noActivePractices,
    requirements: reqs,
  };
};
