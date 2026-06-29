import { Attachment } from "../../../utils/attachmentUtils";
import { normalizeStringForComparison } from "../../../utils/formatters";
import type { SolicitudPPSWithStudent, FinalizacionWithStudent } from "./types";

// ─── Helpers puros del módulo de Solicitudes ────────────────────────

/** Forma laxa de un adjunto tal como puede venir de la base (Airtable/Supabase). */
type AttachmentLike = {
  url?: string;
  signedUrl?: string;
  filename?: string;
  name?: string;
  type?: string;
};

export const normalizeAttachments = (attachment: unknown): Attachment[] => {
  if (!attachment) return [];
  let data: unknown = attachment;
  if (typeof data === "string") {
    const raw = data;
    try {
      data = JSON.parse(data);
    } catch {
      return [{ url: raw, filename: "Archivo Adjunto", type: "unknown" }];
    }
  }
  const arr = Array.isArray(data) ? data : [data];
  return arr
    .map((a: unknown): Attachment => {
      if (typeof a === "string") return { url: a, filename: "Archivo Adjunto", type: "unknown" };
      const obj = (a ?? {}) as AttachmentLike;
      return {
        url: obj.url || obj.signedUrl || "",
        filename: obj.filename || obj.name || "Archivo",
        type: obj.type,
      };
    })
    .filter((a: Attachment) => !!a.url);
};

/** Campos posibles de los que se puede inferir el nombre de la institución. */
type InstitutionNameSource = {
  nombre_institucion?: unknown;
  nombre_institucion_manual?: unknown;
  institucion_nombre?: unknown;
  institucion?: unknown;
  empresa?: unknown;
};

export const getInstitutionNameFromRequest = (req: InstitutionNameSource): string => {
  const candidates = [
    req.nombre_institucion,
    req.nombre_institucion_manual,
    req.institucion_nombre,
    req.institucion,
    req.empresa,
  ];

  return (
    candidates
      .map((value) => String(value || "").trim())
      .find((value) => value && normalizeStringForComparison(value) !== "no especificado") || ""
  );
};

// Formato relativo de tiempo ("hace X min/h/d")
export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}

// ─── Filtrado del tab de Ingreso ────────────────────────────────────

/** Estados que mueven una solicitud de "pendiente" a "historial". */
export const SOLICITUD_HISTORY_STATES = ["Realizada", "No se pudo concretar", "Archivado"];

/** ¿La solicitud está cerrada/archivada (pertenece al historial)? */
export function isHistorySolicitud(
  s: Pick<SolicitudPPSWithStudent, "estado_seguimiento">
): boolean {
  return SOLICITUD_HISTORY_STATES.includes(s.estado_seguimiento || "");
}

/**
 * Filtra la lista de solicitudes de ingreso por término de búsqueda y filtro de
 * tab. Función pura extraída de `IngresoTab` para poder testear la lógica de
 * negocio (búsqueda por alumno/legajo/institución y filtros especiales) sin
 * renderizar el componente.
 *
 * Filtros soportados:
 *  - `"all"`: todas
 *  - `"priorizo"`: sin convenio UFLO confirmado
 *  - `"sin_mov"`: sin movimiento > 4 días y aún no cerradas
 *  - cualquier otro valor: coincidencia exacta con `estado_seguimiento`
 */
export function filterIngresoSolicitudes(
  list: SolicitudPPSWithStudent[],
  search: string,
  filter: string
): SolicitudPPSWithStudent[] {
  const norm = (s: string) => (s || "").toLowerCase();
  const q = norm(search);
  return list.filter((s) => {
    const matchesSearch =
      !q ||
      norm(s._studentName).includes(q) ||
      norm(s._studentLegajo).includes(q) ||
      norm(s.nombre_institucion || "").includes(q);

    if (!matchesSearch) return false;

    if (filter === "all") return true;
    if (filter === "priorizo") {
      return !s.convenio_uflo || s.convenio_uflo.toLowerCase() !== "sí";
    }
    if (filter === "sin_mov") {
      return s._daysSinceUpdate > 4 && !isHistorySolicitud(s);
    }
    return s.estado_seguimiento === filter;
  });
}

// ─── Filtrado del tab de Egreso (finalizaciones) ────────────────────

/** Estados de finalización que pasan al historial (ya resueltas). */
export const FINALIZACION_HISTORY_STATES = ["Cargado", "Finalizada"];

/** ¿La finalización ya fue resuelta (historial)? */
export function isHistoryFinalizacion(s: Pick<FinalizacionWithStudent, "estado">): boolean {
  return FINALIZACION_HISTORY_STATES.includes(s.estado || "");
}

/**
 * Filtra finalizaciones por término de búsqueda (nombre o legajo del
 * estudiante). Función pura extraída de `EgresoTab`.
 */
export function filterEgresoFinalizaciones(
  list: FinalizacionWithStudent[],
  search: string
): FinalizacionWithStudent[] {
  const norm = (s: string) => (s || "").toLowerCase();
  const q = norm(search);
  return list.filter(
    (s) => !q || norm(s.studentName).includes(q) || norm(s.studentLegajo).includes(q)
  );
}
