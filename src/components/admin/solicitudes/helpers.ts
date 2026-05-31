import { Attachment } from "../../../utils/attachmentUtils";
import { normalizeStringForComparison } from "../../../utils/formatters";

// ─── Helpers puros del módulo de Solicitudes ────────────────────────

export const normalizeAttachments = (attachment: any): Attachment[] => {
  if (!attachment) return [];
  let data = attachment;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return [{ url: data, filename: "Archivo Adjunto", type: "unknown" }];
    }
  }
  const arr = Array.isArray(data) ? data : [data];
  return arr
    .map((a: any) => {
      if (typeof a === "string") return { url: a, filename: "Archivo Adjunto", type: "unknown" };
      return {
        url: a.url || a.signedUrl || "",
        filename: a.filename || a.name || "Archivo",
        type: a.type,
      };
    })
    .filter((a: Attachment) => !!a.url);
};

export const getInstitutionNameFromRequest = (req: any): string => {
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
