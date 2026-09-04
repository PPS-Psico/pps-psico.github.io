import { reportCutoff } from "../../features/executive-report/executiveReport.service";
import { normalizeStringForComparison } from "../../utils/formatters";
import type { OrientKey } from "./types";

export const range = (year: number) => {
  const currentYear = new Date().getFullYear();
  const cutoff = reportCutoff(year, year < currentYear);
  const endDate = new Date(`${cutoff}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return {
    start: `${year}-01-01T00:00:00Z`,
    end: `${endDate.toISOString().slice(0, 10)}T00:00:00Z`,
  };
};

export const ORIENT_FROM_STRING = (raw: string | null | undefined): OrientKey => {
  const n = normalizeStringForComparison(raw || "");
  if (n.includes("clinica")) return "clinica";
  if (n.includes("educacional") || n.includes("educacion")) return "educacional";
  if (n.includes("laboral") || n.includes("trabajo")) return "laboral";
  if (n.includes("comunitaria") || n.includes("comunidad")) return "comunitaria";
  return "sindefinir";
};

export const dominantOrient = (orientations: Record<OrientKey, number>): OrientKey => {
  let best: OrientKey = "sindefinir";
  let max = -1;
  (Object.keys(orientations) as OrientKey[]).forEach((key) => {
    if (key !== "sindefinir" && orientations[key] > max) {
      max = orientations[key];
      best = key;
    }
  });
  return max <= 0 ? "sindefinir" : best;
};

// Estados de inscripción que cuentan como "ocupando" un cupo.
// estado_inscripcion canónico (CHECK constraint normalize_states):
// Inscripto · Seleccionado · No Seleccionado.
export const ESTADOS_SELECCIONADO = ["seleccionado"];

export const percentil = (sorted: number[], p: number): number | null => {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const v = sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  return Math.round(v * 10) / 10;
};
