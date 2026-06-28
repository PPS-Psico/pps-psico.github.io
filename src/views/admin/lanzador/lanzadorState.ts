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
import { normalizeStringForComparison, formatDate } from "../../../utils/formatters";
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
} from "../../../constants";
import type { LanzamientoPPS } from "../../../types";
import {
  STATE_META as _STATE_META,
  BUCKET_META as _BUCKET_META,
  BUCKET_ORDER as _BUCKET_ORDER,
  PIPELINE_STEPS as _PIPELINE_STEPS,
  deriveBucket,
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

// ─── Entrada del sidebar + clasificación ────────────────────────────────────

export interface SidebarEntry {
  id: string;
  nombre: string | null;
  uiState: UIState;
  bucket: SidebarBucket;
  orientacion: string | null;
  metaLine: string;
  needsAction: boolean;
  seguroGestionado: boolean;
}

/** Buckets "pre-inicio": tareas que solo tienen sentido ANTES de que arranque la PPS. */
const STALE_PRESTART_BUCKETS: SidebarBucket[] = ["seleccionar", "asegurar", "confirmacion"];

/**
 * ¿La convocatoria debería tratarse como archivada en el Lanzador, aunque su
 * `estado_convocatoria` siga en un paso del pipeline?
 *
 * Dos motivos:
 *  1. `estado_gestion` = 'Archivado' / 'No se Relanza' → el cron de auto-archivado
 *     (o el admin) ya la archivó.
 *  2. Está en un bucket pre-inicio (seleccionar/asegurar/confirmación) pero su
 *     `fecha_inicio` ya pasó (+gracia): el trabajo previo al inicio ya no aplica.
 */
export function isEffectivelyArchived(
  estadoGestion: string | null | undefined,
  bucket: SidebarBucket,
  fechaInicio: string | null | undefined,
  graceDays = 2
): boolean {
  const g = normalizeStringForComparison(estadoGestion || "");
  if (g === "archivado" || g === "no se relanza") return true;
  if (STALE_PRESTART_BUCKETS.includes(bucket) && fechaInicio) {
    const ini = new Date(fechaInicio);
    if (!Number.isNaN(ini.getTime())) {
      ini.setHours(0, 0, 0, 0);
      const limite = new Date();
      limite.setHours(0, 0, 0, 0);
      limite.setDate(limite.getDate() - graceDays);
      if (ini.getTime() <= limite.getTime()) return true;
    }
  }
  return false;
}

export type LaunchCountsMap = Record<string, { inscriptos: number; seleccionados: number }>;
export type LaunchConsentMap = Record<string, { aceptados: number; total: number }>;

/**
 * Construye las entradas del sidebar del Lanzador a partir de los lanzamientos y
 * sus conteos derivados (inscriptos/seleccionados y consentimientos por lanzamiento).
 *
 * Función pura: integra `mapDbToUiState` + `deriveBucket` + `isEffectivelyArchived`
 * y deriva la `metaLine` y el flag `needsAction` de cada bucket. Vive acá (módulo
 * sin React) para poder testear la clasificación del sidebar de forma aislada.
 */
export function buildSidebarEntries(
  launches: LanzamientoPPS[],
  countsByLaunch: LaunchCountsMap,
  consentByLaunch: LaunchConsentMap
): SidebarEntry[] {
  return launches.map((l) => {
    const dbStatus = (l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string) || "";
    const seguroGestionadoAt =
      (l[FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS] as string | null) ?? null;
    const dbState = mapDbToUiState(dbStatus, seguroGestionadoAt);
    const nombre = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string | null;
    const orientacion = l[FIELD_ORIENTACION_LANZAMIENTOS] as string | null;
    const cupos = l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number | null;
    const fechaInicio = l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string | null;
    const fechaFinInsc = l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
    const estadoGestion = l[FIELD_ESTADO_GESTION_LANZAMIENTOS] as string | null;
    const totalInsc = countsByLaunch[l.id]?.inscriptos || 0;
    const totalSel = countsByLaunch[l.id]?.seleccionados || 0;
    const consent = consentByLaunch[l.id] || { aceptados: 0, total: 0 };
    const vencida = inscripcionVencida(fechaFinInsc);

    const baseBucket: SidebarBucket = deriveBucket({
      dbState,
      seguroGestionadoAt,
      totalSel,
      totalInsc,
      vencida,
    });

    const archived = isEffectivelyArchived(estadoGestion, baseBucket, fechaInicio);
    const bucket: SidebarBucket = archived ? "archivada" : baseBucket;
    const uiState: UIState = archived ? "archivada" : dbState;
    const seguroGestionado = bucket !== "archivada" && seguroGestionadoAt != null;

    let metaLine: string;
    switch (bucket) {
      case "borrador":
        metaLine = "Sin publicar";
        break;
      case "abierta":
        metaLine = `${totalInsc} inscripto${totalInsc !== 1 ? "s" : ""} · ${cupos ?? "?"} cupos`;
        break;
      case "seleccionar":
        metaLine = `${totalInsc} candidato${totalInsc !== 1 ? "s" : ""} · ${cupos ?? "?"} cupos`;
        break;
      case "asegurar":
        metaLine =
          consent.total > 0
            ? `${consent.aceptados}/${consent.total} consintieron`
            : `${totalSel} seleccionado${totalSel !== 1 ? "s" : ""} · sin consentir`;
        break;
      case "confirmacion":
        metaLine =
          consent.total > 0
            ? `${consent.aceptados}/${consent.total} consintieron`
            : `${totalSel} seleccionado${totalSel !== 1 ? "s" : ""} · sala de consentimientos`;
        break;
      case "activa":
        metaLine = seguroGestionado
          ? `Seguro gestionado · ${formatDate(seguroGestionadoAt)}`
          : fechaInicio
            ? `Desde ${formatDate(fechaInicio)}`
            : "Prácticas en curso";
        break;
      default:
        metaLine = fechaInicio ? formatDate(fechaInicio) : "Archivada";
    }

    const needsAction =
      bucket === "seleccionar" ||
      (bucket === "asegurar" && consent.aceptados < consent.total) ||
      (bucket === "asegurar" && consent.total === 0) ||
      bucket === "confirmacion";

    return {
      id: l.id,
      nombre,
      uiState,
      bucket,
      orientacion,
      metaLine,
      needsAction,
      seguroGestionado,
    };
  });
}
