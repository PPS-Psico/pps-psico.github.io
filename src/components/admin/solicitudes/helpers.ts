import { Attachment } from "../../../utils/attachmentUtils";
import { normalizeStringForComparison } from "../../../utils/formatters";

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
