import { FIELD_ESPECIALIDAD_PRACTICAS, FIELD_LANZAMIENTO_VINCULADO_PRACTICAS } from "../constants";
import type { MoodleTaskLink } from "../hooks/useMoodleTaskLinks";
import type { Practica } from "../types";
import { cleanDbValue, normalizeStringForComparison } from "./formatters";

export function normalizeMoodleOrientationKey(value: unknown): string | null {
  const normalized = normalizeStringForComparison(cleanDbValue(value));
  if (!normalized) return null;
  if (normalized.includes("educ")) return "educacional";
  if (normalized.includes("clinic")) return "clinica";
  if (normalized.includes("comunit")) return "comunitaria";
  if (normalized.includes("labor") || normalized.includes("organiz")) return "laboral";
  return null;
}

/**
 * Única regla canónica práctica → tarea. No aproxima por nombre: sólo acepta
 * relaciones confirmadas del mismo lanzamiento y orientación.
 */
export function resolveExactMoodleTaskLink(
  practice: Practica,
  links: MoodleTaskLink[]
): MoodleTaskLink | null {
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
