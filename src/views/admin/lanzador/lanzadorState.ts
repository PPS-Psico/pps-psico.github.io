/**
 * lanzadorState — Helpers puros del Lanzador (vista).
 *
 * Extraído de LanzadorView.tsx. Aquí vive la lógica de estado que NO depende
 * de React, para poder testearla de forma aislada. Los tipos (UIState,
 * SidebarBucket, STATE_META, etc.) viven en `aseguramientoService.ts` (la
 * fuente de verdad de las reglas de clasificación) y se re-exportan desde
 * aquí para conveniencia del consumidor de la vista.
 *
 * Pipeline (5 pasos visibles):
 *   1. Borrador     DB 'Oculto'
 *   2. Selección    DB 'Abierta' (mesa abierta)
 *   3. Seguro       DB 'Cerrado' (mesa cerrada, sin seguro gestionado)
 *   4. Confirmación DB 'Confirmacion' (seguro listo, sala de consentimientos)
 *   5. Activa       DB 'Activa' (PPS corriendo, transición manual del admin)
 *   6. Archivada    DB 'Archivado' (referencia histórica, sin pipeline UI)
 */
import { normalizeStringForComparison } from "../../../utils/formatters";
import {
  STATE_META as _STATE_META,
  BUCKET_META as _BUCKET_META,
  BUCKET_ORDER as _BUCKET_ORDER,
  PIPELINE_STEPS as _PIPELINE_STEPS,
  type UIState,
  type SidebarBucket,
} from "../../../services/aseguramientoService";

// Re-exports para que el consumidor de la vista (LanzadorView, etc.) no tenga
// que importar de dos archivos.
export const STATE_META = _STATE_META;
export const BUCKET_META = _BUCKET_META;
export const BUCKET_ORDER = _BUCKET_ORDER;
export const PIPELINE_STEPS = _PIPELINE_STEPS;
export type { UIState, SidebarBucket };

/**
 * Mapea el estado crudo de la columna `estado_convocatoria` de la DB al estado
 * de UI. La comparación es normalizada (case/acentos-insensible) porque la DB
 * históricamente guardó variantes ("Cerrado"/"cerrada", "Abierta"/"abierto").
 *
 * El `seguroGestionadoAt` (opcional) desambigua el estado intermedio "Cerrado":
 *   - NULL  → step 3 "Seguro" (todavía hay que gestionar el seguro)
 *   - set   → step 4 "Confirmación" (legacy: seguro marcado pero DB quedó
 *             en "Cerrado"; el flujo nuevo persiste "Confirmacion" explícito)
 *
 * Si no se pasa `seguroGestionadoAt` y el DB es "Cerrado", cae a "seguro".
 */
export function mapDbToUiState(dbStatus: string, seguroGestionadoAt?: string | null): UIState {
  const s = normalizeStringForComparison(dbStatus);
  if (s === "oculto") return "borrador";
  if (s === "abierta" || s === "abierto") return "seleccion";
  if (s === "confirmacion") return "confirmacion";
  if (s === "activa" || s === "activo") return "activa";
  if (s === "archivado" || s === "archivada") return "archivada";
  if (s === "cerrado" || s === "cerrada") {
    return seguroGestionadoAt ? "confirmacion" : "seguro";
  }
  return "borrador";
}

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
