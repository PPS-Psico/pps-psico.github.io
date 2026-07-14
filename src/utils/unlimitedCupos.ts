import { normalizeStringForComparison } from "./formatters";

/**
 * PPS excepcionales con cupo (casi) ilimitado: aceptan a prácticamente todos
 * los postulantes, por lo que sus números de cupos rompen las estadísticas y
 * su falta de sobrecarga distorsiona la lectura de presión sobre el resto de
 * las convocatorias. En reportes se muestran como "Ilimitado" y se excluyen
 * de los totales de cupos y de la Dinámica del ciclo.
 *
 * El match es por substring del nombre normalizado (sin tildes, minúsculas),
 * así cubre variantes como "Fundación Tiempo - Clínica Adultos".
 */
const UNLIMITED_CUPO_PATTERNS = ["fundacion tiempo", "ulloa"];

export const UNLIMITED_CUPO_LABEL = "Ilimitado";

export const isUnlimitedCupoInstitution = (name: unknown): boolean => {
  if (!name) return false;
  const normalized = normalizeStringForComparison(String(name));
  if (!normalized) return false;
  return UNLIMITED_CUPO_PATTERNS.some((p) => normalized.includes(p));
};
