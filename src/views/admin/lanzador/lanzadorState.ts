/**
 * lanzadorState — Tipos y helpers puros del Lanzador.
 *
 * Extraído de LanzadorView.tsx. Aquí vive la lógica de estado que NO depende
 * de React, para poder testearla de forma aislada:
 *   - el mapeo entre el estado crudo de la DB y el estado de UI,
 *   - los "buckets" operativos del sidebar (qué hacer ahora),
 *   - el cálculo de vencimiento de la ventana de inscripción.
 */
import { normalizeStringForComparison } from "../../../utils/formatters";

// ─── UI state ───────────────────────────────────────────────────────────────

export type UIState = "borrador" | "abierta" | "cerrada" | "seleccionada" | "activa" | "archivada";

export const STATE_META: Record<UIState, { label: string; step: number }> = {
  borrador: { label: "Borrador", step: 1 },
  abierta: { label: "Abierta", step: 2 },
  cerrada: { label: "Selección", step: 3 },
  seleccionada: { label: "Seleccionada", step: 4 },
  activa: { label: "Activa", step: 5 },
  archivada: { label: "Archivada", step: 6 },
};

export const PIPELINE_STEPS = ["Borrador", "Abierta", "Selección", "Seleccionada", "Activa"];

/**
 * Mapea el estado crudo de la columna `estado_convocatoria` de la DB al estado
 * de UI. La comparación es normalizada (case/acentos-insensitive) porque la DB
 * históricamente guardó variantes ("Cerrado"/"cerrada", "Abierta"/"abierto").
 */
export function mapDbToUiState(dbStatus: string): UIState {
  const s = normalizeStringForComparison(dbStatus);
  if (s === "oculto") return "borrador";
  if (s === "abierta" || s === "abierto") return "abierta";
  if (s === "cerrado" || s === "cerrada") return "cerrada";
  if (s === "activa" || s === "activo") return "activa";
  if (s === "archivado" || s === "archivada") return "archivada";
  return "borrador";
}

// ─── Sidebar buckets (categorías operativas) ─────────────────────────────────
// Las categorías del sidebar agrupan por "qué hacer ahora", no por el estado
// crudo de la DB. Esto las hace accionables para el coordinador.

export type SidebarBucket =
  | "borrador"
  | "abierta"
  | "seleccionar"
  | "asegurar"
  | "activa"
  | "archivada";

export const BUCKET_META: Record<
  SidebarBucket,
  { label: string; tone: UIState; collapsedByDefault: boolean }
> = {
  borrador: { label: "Borradores", tone: "borrador", collapsedByDefault: true },
  abierta: { label: "Abiertas", tone: "abierta", collapsedByDefault: false },
  seleccionar: { label: "A seleccionar", tone: "cerrada", collapsedByDefault: false },
  asegurar: { label: "A asegurar", tone: "seleccionada", collapsedByDefault: false },
  activa: { label: "Activas", tone: "activa", collapsedByDefault: false },
  archivada: { label: "Archivadas", tone: "archivada", collapsedByDefault: true },
};

export const BUCKET_ORDER: SidebarBucket[] = [
  "seleccionar",
  "asegurar",
  "abierta",
  "activa",
  "borrador",
  "archivada",
];

/** ¿La ventana de inscripción ya cerró? (fecha fin de inscripción < hoy) */
export function inscripcionVencida(fechaFinInsc: string | null): boolean {
  if (!fechaFinInsc) return false;
  const fin = new Date(fechaFinInsc);
  if (Number.isNaN(fin.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fin.setHours(23, 59, 59, 999);
  return fin.getTime() < hoy.getTime();
}
