import { getErrorMessage } from "./getErrorMessage";

const SAFE_SERVER_MESSAGES = [
  "Tenés que iniciar sesión",
  "No encontramos tu perfil de estudiante",
  "La convocatoria no pertenece a tu cuenta",
  "Tu selección ya no está vigente",
  "Esta PPS tiene un cierre académico",
  "La PPS todavía no tiene un plazo de confirmación válido",
  "El plazo para confirmar esta PPS ya finalizó",
  "Tenés que aceptar ambas declaraciones",
  "Completá todos los datos de la firma",
  "El DNI no coincide con tu registro",
  "El legajo no coincide con tu registro",
] as const;

/**
 * Convierte errores técnicos de PostgREST/Supabase en instrucciones seguras y
 * accionables. Los mensajes de negocio emitidos por el RPC sí pueden mostrarse;
 * detalles de RLS, tablas, SQL o schema cache nunca llegan al estudiante.
 */
export function getCompromisoSubmitErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "").trim();
  const normalized = message.toLocaleLowerCase("es-AR");

  const safeMessage = SAFE_SERVER_MESSAGES.find((candidate) => message.startsWith(candidate));
  if (safeMessage) return message;

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  ) {
    return "No pudimos conectarnos para registrar tu compromiso. Revisá tu conexión e intentá nuevamente; los datos que completaste siguen acá.";
  }

  if (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("not authorized") ||
    normalized.includes("unauthorized") ||
    normalized.includes("42501")
  ) {
    return "No pudimos validar tu sesión. Actualizá la página, volvé a ingresar e intentá nuevamente. Si el problema continúa, contactá a Coordinación.";
  }

  if (
    normalized.includes("submit_compromiso_pps") ||
    normalized.includes("schema cache") ||
    normalized.includes("pgrst202")
  ) {
    return "La aplicación necesita actualizarse antes de registrar tu compromiso. Recargá la página e intentá nuevamente.";
  }

  return "No pudimos registrar tu compromiso. Intentá nuevamente y, si el problema continúa, contactá a Coordinación.";
}
