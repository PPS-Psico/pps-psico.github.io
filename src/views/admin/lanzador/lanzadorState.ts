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
 *   Abiertas → A seleccionar → En confirmación → A asegurar → Activas
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
  FIELD_FINALIZACION_POR_HORAS_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
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
 * Correspondencia con el pipeline (ver `aseguramientoService`):
 *   'Cerrado'      → step 3 "Confirmación" (sala de firmas, apenas cerró la mesa)
 *   'Seguro'       → step 4 "Seguro" (seguro + listado de convocados)
 *   'Confirmacion' → step 4, LEGACY. Así se llamaba el paso del seguro cuando iba
 *                    antes del consentimiento. No se migró: las convocatorias que
 *                    quedaron con ese valor drenan solas al avanzar. Solo se
 *                    escribe 'Seguro' de ahora en más.
 *
 * `seguro_gestionado_at` NO participa del paso. Cuando 'Seguro' no existía como
 * token, una fila en 'Cerrado' con esa marca era la única forma de reconocer el
 * paso 4, y el mapeo la usaba para desempatar. Con el token explícito esa regla
 * pasó a estorbar: se comía la vuelta atrás desde el seguro a la sala de firmas
 * —el estado se escribía pero la pantalla no se movía— porque la marca arrastra
 * de nuevo al paso 4. Hoy el paso lo dice `estado_convocatoria` y nada más; la
 * marca vuelve a ser lo que su nombre indica, auditoría de que el seguro se
 * gestionó.
 */
export function mapDbToUiState(dbStatus: string, seguroGestionadoAt?: string | null): UIState {
  void seguroGestionadoAt;
  const s = normalizeStringForComparison(dbStatus);
  if (s === "oculto") return "borrador";
  // "Programada" es prepublicación y vive fuera del pipeline visible.
  if (s === "programada" || s === "programado") return "borrador";
  if (s === "abierta" || s === "abierto") return "seleccion";
  if (s === "seguro") return "seguro";
  if (s === "confirmacion") return "seguro"; // legacy, ver el comentario de arriba
  if (s === "activa" || s === "activo") return "activa";
  if (s === "archivado" || s === "archivada") return "archivada";
  if (s === "cerrado" || s === "cerrada") return "confirmacion";
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
export interface LaunchConsentCounts {
  aceptados: number;
  total: number;
  pendientes?: number;
  bajas?: number;
  seleccionados_vigentes?: number;
  eximidos?: number;
  requerido?: boolean;
}
export type LaunchConsentMap = Record<string, LaunchConsentCounts>;

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
    const finalizacionPorHoras = Boolean(l[FIELD_FINALIZACION_POR_HORAS_LANZAMIENTOS]);
    const horasAcreditadas = l[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] as number | null;
    const fechaFinInsc = l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] as string | null;
    const totalInsc = countsByLaunch[l.id]?.inscriptos || 0;
    const totalSel = countsByLaunch[l.id]?.seleccionados || 0;
    const consent = consentByLaunch[l.id] || { aceptados: 0, total: 0 };
    const pendientesConsent = consent.pendientes ?? Math.max(0, consent.total - consent.aceptados);
    const bajasConsent = consent.bajas ?? 0;
    const vencida = inscripcionVencida(fechaFinInsc);

    const timeline = finalizacionPorHoras
      ? (() => {
          const hoy = parseToUTCDate(new Date().toISOString());
          const inicio = parseToUTCDate(fechaInicio);
          if (!hoy || !inicio) return "desconocida" as const;
          return inicio.getTime() > hoy.getTime() ? ("pendiente" as const) : ("en_curso" as const);
        })()
      : deriveTimeline(fechaInicio, fechaFin);

    const bucket: SidebarBucket = deriveBucket({
      dbState,
      seguroGestionadoAt,
      totalSel,
      totalInsc,
      vencida,
      timeline,
    });

    // El canvas sigue el estado real de la DB: así una PPS que ya arrancó pero
    // quedó en 'Cerrado' abre la sala de firmas, y una que quedó en
    // 'Confirmacion' abre el generador de seguros. El grupo dice DÓNDE está en
    // el tiempo; el canvas, QUÉ le falta.
    const uiState: UIState = bucket === "finalizada" ? "archivada" : dbState;
    const seguroGestionado = bucket !== "finalizada" && seguroGestionadoAt != null;

    let metaLine: string;
    switch (bucket) {
      case "oculta":
        metaLine = "Fuera del pipeline";
        break;
      case "borrador":
        metaLine = "Borrador · no visible para estudiantes";
        break;
      case "abierta":
        metaLine = `${totalInsc} inscripto${totalInsc !== 1 ? "s" : ""} · ${cupos ?? "?"} cupos`;
        break;
      case "seleccionar":
        metaLine = `${totalInsc} candidato${totalInsc !== 1 ? "s" : ""} · ${cupos ?? "?"} cupos`;
        break;
      case "confirmacion":
        metaLine =
          consent.requerido === false
            ? `Consentimiento omitido · ${totalSel} seleccionado${totalSel !== 1 ? "s" : ""}`
            : consent.total > 0
              ? `${consent.aceptados} firmaron · ${pendientesConsent} pendiente${
                  pendientesConsent !== 1 ? "s" : ""
                }${bajasConsent > 0 ? ` · ${bajasConsent} baja${bajasConsent !== 1 ? "s" : ""}` : ""}`
              : `${totalSel} seleccionado${totalSel !== 1 ? "s" : ""} · sala de consentimientos`;
        break;
      case "asegurar":
        // Paso 4: la nómina ya decantó, lo que falta es la planilla de seguro y
        // el listado para la institución.
        metaLine = seguroGestionadoAt
          ? `Seguro y listado listos · ${totalSel} seleccionado${totalSel !== 1 ? "s" : ""}`
          : `${totalSel} en la nómina · falta el seguro y el listado`;
        break;
      case "activa":
        // Una PPS corriendo sin seguro es lo más urgente que puede haber acá,
        // así que la meta lo dice en vez de mostrar la fecha de inicio.
        metaLine = !seguroGestionado
          ? "Seguro pendiente"
          : finalizacionPorHoras
            ? `En curso · hasta completar ${horasAcreditadas || 70} h`
            : fechaFin
              ? `En curso · hasta ${formatDate(fechaFin)}`
              : "Prácticas en curso";
        break;
      default:
        metaLine = fechaFin ? `Finalizó el ${formatDate(fechaFin)}` : "Finalizada";
    }

    const needsAction =
      bucket === "seleccionar" ||
      bucket === "confirmacion" ||
      (bucket === "asegurar" && !seguroGestionado) ||
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
