import { logger } from "../utils/logger";
/**
 * hermesDraft — puente opcional con n8n para redactar borradores de contacto.
 *
 * Contrato del webhook (lo implementás del lado n8n):
 *   POST  VITE_HERMES_WEBHOOK_URL
 *   body: HermesDraftRequest (JSON)
 *   resp: 200 { borrador: string }   (también acepta { draft } | { text } | { mensaje })
 *
 * Si la variable de entorno no está seteada, o el webhook falla / tarda, el
 * llamador usa su plantilla local como fallback. Shadow mode: Hermes solo
 * devuelve texto a una caja editable; nunca envía ni cambia estados.
 */

export interface HermesDraftRequest {
  institucionId: string;
  institucion: string;
  referente?: string | null;
  telefono?: string | null;
  canal: "whatsapp" | "mail";
  estilo: "formal" | "breve" | "calido" | "reinsistir";
  accion: "contactar" | "reinsistir";
}

export interface HermesDraftResult {
  texto: string;
  source: "n8n" | "local";
}

export const hermesWebhookConfigured = (): boolean =>
  !!(import.meta.env.VITE_HERMES_WEBHOOK_URL as string | undefined);

/**
 * Pide un borrador a n8n. Devuelve null si no hay webhook configurado, si la
 * respuesta no es válida, o si falla / supera el timeout — el llamador decide
 * el fallback local.
 */
export async function fetchHermesDraft(
  params: HermesDraftRequest,
  timeoutMs = 12000
): Promise<string | null> {
  const url = import.meta.env.VITE_HERMES_WEBHOOK_URL as string | undefined;
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const texto = (data.borrador || data.draft || data.text || data.mensaje) as string | undefined;
    return texto && texto.trim() ? texto : null;
  } catch (e) {
    logger.warn("[hermesDraft] webhook no disponible, usando plantilla local:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
