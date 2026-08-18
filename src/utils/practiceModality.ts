import { normalizeStringForComparison } from "./formatters";

const ONLINE_PPS_DIRECTIONS = new Set(["online", "virtual", "modalidad virtual", "a distancia"]);

/**
 * Reconoce las etiquetas históricas y actuales usadas como dirección de una
 * PPS virtual. La comparación es intencionalmente exacta para no clasificar
 * como online una modalidad híbrida o una dirección física con texto libre.
 */
export const isOnlinePpsDirection = (direction: unknown): boolean =>
  ONLINE_PPS_DIRECTIONS.has(normalizeStringForComparison(direction));
