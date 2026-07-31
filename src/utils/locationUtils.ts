import { normalizeStringForComparison } from "./formatters";

export type LocationModalityLabel = "Online" | "Híbrida" | "Pres." | "—";

const NON_PHYSICAL_LOCATIONS = new Set([
  "virtual",
  "modalidad virtual",
  "online",
  "modalidad online",
  "remoto",
  "remota",
  "modalidad remota",
  "a distancia",
  "no presencial",
  "presencial",
  "modalidad presencial",
  "hibrida",
  "modalidad hibrida",
  "a confirmar",
  "por confirmar",
  "por definir",
  "sin definir",
]);

/** Indica si el valor puede representar un domicilio buscable en un mapa. */
export function hasPhysicalAddress(value: unknown): boolean {
  const normalized = normalizeStringForComparison(String(value ?? ""));
  return normalized.length > 0 && !NON_PHYSICAL_LOCATIONS.has(normalized);
}

/** Traduce el valor de ubicación guardado en la convocatoria a una modalidad breve. */
export function getLocationModalityLabel(value: unknown): LocationModalityLabel {
  const normalized = normalizeStringForComparison(String(value ?? ""));

  if (!normalized) return "—";
  if (normalized.includes("hibrid") || normalized.includes("mixta")) return "Híbrida";
  if (
    normalized.includes("virtual") ||
    normalized.includes("online") ||
    normalized.includes("remot") ||
    normalized.includes("a distancia") ||
    normalized.includes("no presencial")
  ) {
    return "Online";
  }

  return "Pres.";
}
