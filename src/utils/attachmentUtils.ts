import { normalizeStringForComparison } from "./formatters";
import { FIELD_ESTADO_FINALIZACION } from "../constants";
import { logger } from "./logger";

export interface Attachment {
  url: string;
  filename: string;
  type?: string;
  signedUrl?: string;
}

export const getFileType = (filename: string) => {
  if (!filename) return "other";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext || "")) return "image";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext || "")) return "office";
  return "other";
};

export const getStoragePath = (fullUrl: string): string | null => {
  if (!fullUrl) return null;
  try {
    // Intenta encontrar la parte después de 'documentos_finalizacion/'
    const parts = fullUrl.split("/documentos_finalizacion/");
    if (parts.length > 1) {
      // Decodifica por si hay espacios (%20) u otros caracteres
      return decodeURIComponent(parts[1]);
    }
    return null;
  } catch (e) {
    logger.error("Error parsing storage path:", e);
    return null;
  }
};

export const getNormalizationState = (request: unknown): string => {
  if (!request || typeof request !== "object") return "";
  const rawState = (request as Record<string, unknown>)[FIELD_ESTADO_FINALIZACION];
  const stateStr = Array.isArray(rawState) ? rawState[0] : rawState;
  return normalizeStringForComparison(stateStr || "");
};
