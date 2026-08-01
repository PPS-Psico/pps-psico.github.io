/**
 * lanzadorState — Helpers puros del Lanzador (vista).
 *
 * Extraído de LanzadorView.tsx. Aquí vive la lógica de estado que NO depende
 * de React, para poder testearla de forma aislada. Los tipos (UIState,
 * SidebarBucket, STATE_META, etc.) viven en `aseguramientoService.ts` (la
 * fuente de verdad de las reglas de clasificación) y se re-exportan desde
 * aquí para conveniencia del consumidor de la vista.
 *
 * El recorrido visible (lo que muestra el sidebar):
 *   Abiertas → A seleccionar → A asegurar → En confirmación → Activas
 *
 * Una convocatoria entra al recorrido cuando se publica y sale cuando llega su
 * `fecha_finalizacion`. Los dos extremos —lo que todavía no está en el pipeline
 * y lo que ya terminó— no se muestran como grupo; el buscador sí los alcanza.
 *
 * Los tramos "Activas" y "Finalizadas" los decide el calendario, no el estado
 * de la DB: antes dependían de un click manual del admin y de una regla de
 * "archivada efectiva" que enterraba las PPS en curso.
 */
import {
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
} from "../../../constants";
import {
  BUCKET_META as _BUCKET_META,
  BUCKET_ORDER as _BUCKET_ORDER,
  HIDDEN_BUCKETS as _HIDDEN_BUCKETS,
  PIPELINE_STEPS as _PIPELINE_STEPS,
  STATE_META as _STATE_META,
  deriveBucket,
  deriveTimeline,
  type SidebarBucket,
  type UIState,
} from "../../../services/aseguramientoService";
import type { LanzamientoPPS } from "../../../types";
import {
  formatDate,
  normalizeStringForComparison,
  parseToUTCDate,
} from "../../../utils/formatters";

// Re-exports para que el consumidor de la vista (LanzadorView, etc.) no tenga
// que importar de dos archivos.
export const STATE_META = _STATE_META;
export const BUCKET_META = _BUCKET_META;
export const BUCKET_ORDER = _BUCKET_ORDER;
export const HIDDEN_BUCKETS = _HIDDEN_BUCKETS;
export const PIPELINE_STEPS = _PIPELINE_STEPS;
export { deriveTimeline };
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
  // "Programada" es prepublicación y vive fuera del pipeline visible.
  if (s === "programada" || s === "programado") return "borrador";
  if (s === "abierta" || s === "abierto") return "seleccion";
  if (s === "confirmacion") return "confirmacion";
  if (s === "activa" || s === "activo") return "activa";
  if (s === "archivado" || s === "archivada") return "archivada";
  if (s === "cerrado" || s === "cerrada") {
    return seguroGestionadoAt ? "confirmacion" : "seguro";
  }
  return "borrador";
}

/**
 * ¿La ventana de inscripción ya cerró? (fecha fin de inscripción < hoy)
 *
 * Compara por día vía `parseToUTCDate`. La versión anterior hacía
 * `new Date(str)` + `setHours(...)`: como las fechas vienen en formato
 * `YYYY-MM-DD` (que JS parsea como medianoche UTC), en Argentina (UTC-3) eso
 * caía en el día anterior y la inscripción se daba por vencida 24h antes.
 */
export function inscripcionVencida(fechaFinInsc: string | null): boolean {
  const fin = parseToUTCDate(fechaFinInsc);
  const hoy = parseToUTCDate(new Date().toISOString());
  if (!fin || !hoy) return false;
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

export type LaunchCountsMap = Record<string, { inscriptos: number; seleccionados: number }>;
export type LaunchConsentMap = Record<string, { aceptados: number; total: number }>;

/**
 * Construye las entradas del sidebar del Lanzador a partir de los lanzamientos y
 * sus conteos derivados (inscriptos/seleccionados y consentimientos por lanzamiento).
 *
 * Función pura: integra `mapDbToUiState` + `deriveTimeline` + `deriveBucket` y
 * deriva la `metaLine` y el flag `needsAction` de cada bucket. Vive acá (módulo
 * sin React) para poder testear la clasificación del sidebar de forma aislada.
 *
 * `estado_gestion` ya NO participa: es el eje de convenio/relanzamiento (lo usa
 * Gestión) y usarlo también como interruptor de visibilidad hacía que el cron de
 * auto-archivado escondiera PPS que estaban corriendo.
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
    const fechaFin = l[FIELD_FECHA_FIN_LANZAMIENTOS] as string | null;
    const fechaFinInsc = l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
    const totalInsc = countsByLaunch[l.id]?.inscriptos || 0;
    const totalSel = countsByLaunch[l.id]?.seleccionados || 0;
    const consent = consentByLaunch[l.id] || { aceptados: 0, total: 0 };
    const vencida = inscripcionVencida(fechaFinInsc);

    const bucket: SidebarBucket = deriveBucket({
      dbState,
      seguroGestionadoAt,
      totalSel,
      totalInsc,
      vencida,
      timeline: deriveTimeline(fechaInicio, fechaFin),
    });

    // El canvas sigue el estado real de la DB: así una PPS que ya arrancó pero
    // quedó en 'Cerrado' abre el generador de seguros, y una que quedó en
    // 'Confirmacion' abre la sala de firmas. El grupo dice DÓNDE está en el
    // tiempo; el canvas, QUÉ le falta.
    const uiState: UIState = bucket === "finalizada" ? "archivada" : dbState;
    const seguroGestionado = bucket !== "finalizada" && seguroGestionadoAt != null;

    let metaLine: string;
    switch (bucket) {
      case "oculta":
        metaLine = "Fuera del pipeline";
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
        // Una PPS corriendo sin seguro es lo más urgente que puede haber acá,
        // así que la meta lo dice en vez de mostrar la fecha de inicio.
        metaLine = !seguroGestionado
          ? "Seguro pendiente"
          : fechaFin
            ? `En curso · hasta ${formatDate(fechaFin)}`
            : "Prácticas en curso";
        break;
      default:
        metaLine = fechaFin ? `Finalizó el ${formatDate(fechaFin)}` : "Finalizada";
    }

    const needsAction =
      bucket === "seleccionar" ||
      (bucket === "asegurar" && consent.aceptados < consent.total) ||
      (bucket === "asegurar" && consent.total === 0) ||
      bucket === "confirmacion" ||
      (bucket === "activa" && !seguroGestionado);

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
