import { FIELD_ESTADO_FINALIZACION } from "../constants";
import { supabase } from "../lib/supabaseClient";
import { normalizeStringForComparison } from "./formatters";
import { logger } from "./logger";

export interface Attachment {
  url: string;
  filename: string;
  type?: string;
  signedUrl?: string;
}

export type StudentDocumentBucket = "documentos_finalizacion" | "documentos_estudiantes";
export type StorageObjectRef = { bucket: StudentDocumentBucket; path: string };

const STUDENT_DOCUMENT_BUCKETS = new Set<StudentDocumentBucket>([
  "documentos_finalizacion",
  "documentos_estudiantes",
]);
const STORAGE_URL_MARKERS = [
  "/storage/v1/object/public/",
  "/storage/v1/object/sign/",
  "/storage/v1/object/authenticated/",
];

export const getFileType = (filename: string) => {
  if (!filename) return "other";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext || "")) return "image";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext || "")) return "office";
  return "other";
};

/** Recupera bucket y path de URLs históricas generadas por Supabase Storage. */
export const getStorageObjectRef = (fullUrl: string): StorageObjectRef | null => {
  if (!fullUrl) return null;
  try {
    let source = fullUrl;
    try {
      source = new URL(fullUrl).pathname;
    } catch {
      source = fullUrl.split(/[?#]/, 1)[0];
    }

    const marker = STORAGE_URL_MARKERS.find((candidate) => source.includes(candidate));
    let objectRef: string;
    if (marker) {
      objectRef = source.slice(source.indexOf(marker) + marker.length);
    } else {
      const legacyBucket = [...STUDENT_DOCUMENT_BUCKETS].find((bucket) =>
        source.includes(`/${bucket}/`)
      );
      if (!legacyBucket) return null;
      objectRef = `${legacyBucket}/${source.slice(source.indexOf(`/${legacyBucket}/`) + legacyBucket.length + 2)}`;
    }

    const separatorIndex = objectRef.indexOf("/");
    if (separatorIndex <= 0) return null;

    const bucket = decodeURIComponent(objectRef.slice(0, separatorIndex));
    const path = decodeURIComponent(objectRef.slice(separatorIndex + 1));
    if (!STUDENT_DOCUMENT_BUCKETS.has(bucket as StudentDocumentBucket) || !path) return null;

    return { bucket: bucket as StudentDocumentBucket, path };
  } catch (error) {
    logger.error("Error parsing storage object reference:", error);
    return null;
  }
};

/** Compatibilidad para consumidores históricos del bucket de finalización. */
export const getStoragePath = (fullUrl: string): string | null => {
  const ref = getStorageObjectRef(fullUrl);
  return ref?.bucket === "documentos_finalizacion" ? ref.path : null;
};

/**
 * Convierte una URL persistida en una URL firmada de corta duración. Las URLs
 * externas se conservan sin cambios para soportar adjuntos legacy.
 */
export const getSignedStorageUrl = async (url: string, expiresIn = 3600): Promise<string> => {
  const ref = getStorageObjectRef(url);
  if (!ref) return url;

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, expiresIn);
  if (error || !data?.signedUrl) throw error ?? new Error("No se pudo firmar el documento");
  return data.signedUrl;
};

export const signStorageAttachment = async (attachment: Attachment): Promise<Attachment> => {
  try {
    const signedUrl = await getSignedStorageUrl(attachment.url);
    return signedUrl === attachment.url ? attachment : { ...attachment, signedUrl };
  } catch (error) {
    logger.warn("No se pudo generar la URL firmada del documento:", error);
    return attachment;
  }
};

export const getNormalizationState = (request: unknown): string => {
  if (!request || typeof request !== "object") return "";
  const rawState = (request as Record<string, unknown>)[FIELD_ESTADO_FINALIZACION];
  const stateStr = Array.isArray(rawState) ? rawState[0] : rawState;
  return normalizeStringForComparison(stateStr || "");
};
