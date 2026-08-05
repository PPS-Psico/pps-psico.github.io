import {
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
} from "../constants";
import type { LanzamientoPPS, Practica } from "../types";
import { normalizeStringForComparison, parseOrientaciones } from "../utils/formatters";
import { isPracticeFinished } from "./studentRules";

/**
 * Historial de PPS ya realizadas por el estudiante.
 */
export interface CompletedHistory {
  /** IDs de lanzamiento + nombres de institución normalizados. */
  completedLanzamientoIds: Set<string>;
  /** Orientaciones ya cursadas, por nombre de institución normalizado. */
  completedOrientationsByInstitution: Map<string, Set<string>>;
}

/**
 * Arma el historial de PPS realizadas a partir de las prácticas del estudiante.
 * Es la fuente única que consumen `processAndLinkStudentData` (para el panel) y
 * la guarda de la mutación de inscripción.
 */
export const buildCompletedHistory = (practicas: Practica[]): CompletedHistory => {
  const completedLanzamientoIds = new Set<string>();
  const completedOrientationsByInstitution = new Map<string, Set<string>>();

  practicas.forEach((practica) => {
    if (!isPracticeFinished(practica[FIELD_ESTADO_PRACTICA])) return;

    const linkedId = practica[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] as string;
    if (linkedId) completedLanzamientoIds.add(linkedId);

    // También por nombre: cada relanzamiento anual es un lanzamiento nuevo, así
    // que el cruce por ID solo no alcanza para bloquear la repetición.
    const pName = String(practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] || "");
    if (!pName.trim()) return;

    const normalizedName = normalizeStringForComparison(pName);
    completedLanzamientoIds.add(normalizedName);

    const especialidad = String(practica[FIELD_ESPECIALIDAD_PRACTICAS] || "").trim();
    if (!especialidad) return;

    if (!completedOrientationsByInstitution.has(normalizedName)) {
      completedOrientationsByInstitution.set(normalizedName, new Set());
    }
    completedOrientationsByInstitution
      .get(normalizedName)!
      .add(normalizeStringForComparison(especialidad));
  });

  return { completedLanzamientoIds, completedOrientationsByInstitution };
};

export interface EnrollmentEligibility {
  /** true si el estudiante ya realizó esta PPS y no puede volver a anotarse. */
  isCompleted: boolean;
  /** Orientaciones del lanzamiento que el estudiante ya tiene hechas. */
  completedOrientaciones: string[];
  /** Cantidad de orientaciones que ofrece el lanzamiento. */
  launchOrientaciones: string[];
}

/**
 * Regla de reinscripción: un estudiante no puede volver a anotarse a una PPS
 * que ya realizó. La excepción es la institución multi-orientación: mientras
 * quede una orientación que no cursó, la convocatoria sigue disponible.
 *
 * El historial se cruza por ID de lanzamiento y por nombre de institución
 * normalizado, porque cada relanzamiento anual crea un lanzamiento nuevo: sin
 * el cruce por nombre, el bloqueo no atraparía nada.
 */
export const getEnrollmentEligibility = (
  lanzamiento: LanzamientoPPS,
  history: CompletedHistory
): EnrollmentEligibility => {
  const { completedLanzamientoIds, completedOrientationsByInstitution } = history;

  const ppsName = String(lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "");
  // El nombre suele venir como "Institución - Orientación"; el grupo es la
  // institución, que es la unidad por la que se bloquea.
  const groupName = ppsName.split(" - ")[0].trim();
  const normalizedGroupName = normalizeStringForComparison(groupName);
  const normalizedPpsName = normalizeStringForComparison(ppsName);

  const launchOrientaciones = parseOrientaciones(lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS]);

  const completedOrientations =
    completedOrientationsByInstitution.get(normalizedGroupName) ||
    completedOrientationsByInstitution.get(normalizedPpsName) ||
    new Set<string>();

  const allOrientationsCompleted =
    launchOrientaciones.length > 0 &&
    launchOrientaciones.every((o) => completedOrientations.has(normalizeStringForComparison(o)));

  const isFullyCompleted =
    completedLanzamientoIds.has(lanzamiento.id) || completedLanzamientoIds.has(normalizedPpsName);

  const isCompleted = launchOrientaciones.length > 1 ? allOrientationsCompleted : isFullyCompleted;

  const completedOrientaciones = allOrientationsCompleted
    ? launchOrientaciones
    : launchOrientaciones.filter((o) => completedOrientations.has(normalizeStringForComparison(o)));

  return { isCompleted, completedOrientaciones, launchOrientaciones };
};

/**
 * Copy del CTA bloqueado. Distingue el caso multi-orientación para que el
 * estudiante entienda por qué no puede anotarse.
 */
export const getCompletedEnrollmentLabel = (eligibility: EnrollmentEligibility): string =>
  eligibility.completedOrientaciones.length > 0 && eligibility.launchOrientaciones.length > 1
    ? "Ya cursaste estas orientaciones"
    : "Ya realizaste esta PPS";
