import { FIELD_ESPECIALIDAD_PRACTICAS, FIELD_LANZAMIENTO_VINCULADO_PRACTICAS } from "../constants";
import type { MoodleTaskLink } from "../hooks/useMoodleTaskLinks";
import type { Practica } from "../types";
import { cleanDbValue, normalizeStringForComparison } from "./formatters";

export function normalizeMoodleOrientationKey(value: unknown): string | null {
  const normalized = normalizeStringForComparison(cleanDbValue(value));
  if (!normalized) return null;

  const matches = new Set<string>();
  if (normalized.includes("educ")) matches.add("educacional");
  if (normalized.includes("clinic")) matches.add("clinica");
  if (normalized.includes("comunit")) matches.add("comunitaria");
  if (normalized.includes("labor") || normalized.includes("organiz")) matches.add("laboral");

  return matches.size === 1 ? [...matches][0] : null;
}

/**
 * Única regla canónica práctica → tarea. No aproxima por nombre: sólo acepta
 * relaciones confirmadas del mismo lanzamiento y orientación.
 */
export function resolveExactMoodleTaskLink(
  practice: Practica,
  links: MoodleTaskLink[]
): MoodleTaskLink | null {
  const practiceLinks = links.filter((link) => link.practiceId === practice.id);
  if (practiceLinks.length > 0) {
    return practiceLinks.length === 1 ? practiceLinks[0] : null;
  }

  const launchId = cleanDbValue(practice[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]);
  if (!launchId) return null;

  const launchLinks = links.filter((link) => link.launchId === launchId);
  if (launchLinks.length === 0) return null;

  const orientationKey = normalizeMoodleOrientationKey(practice[FIELD_ESPECIALIDAD_PRACTICAS]);
  if (orientationKey) {
    const exact = launchLinks.filter((link) => link.orientationKey === orientationKey);
    return exact.length === 1 ? exact[0] : null;
  }
  return launchLinks.length === 1 ? launchLinks[0] : null;
}
