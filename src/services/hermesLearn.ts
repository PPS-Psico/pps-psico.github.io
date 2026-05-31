// ──────────────────────────────────────────────────────────────────────────
// hermesLearn — cierre del loop de aprendizaje del agente.
//
// Cuando el operador resuelve una suggestion en el panel (aprueba / edita /
// descarta), además del UPDATE en agent_suggestions, avisamos a Hermes vía
// POST /tasks/learn_from_feedback para que destile una lección. Hermes:
//   1. La escribe en su vault (agent/aprendizajes.md).
//   2. La espeja en agent_audit_log (tool=learn.done, output.aprendizaje) para
//      que el panel pueda mostrarla en el Dashboard de Inteligencia Hermes.
//   3. Para tipo=clasificacion aprobada/editada, materializa whatsapp_contactos.
//
// Es best-effort: si Hermes está caído o el endpoint no existe, NO rompe la
// acción del usuario (la suggestion ya quedó resuelta en Supabase). El token
// machine-to-machine ya está expuesto a propósito (mismo patrón que gmailService).
// ──────────────────────────────────────────────────────────────────────────
import { logger } from "../utils/logger";

const HERMES_URL =
  (import.meta.env.VITE_HERMES_API_URL as string | undefined) ||
  "https://pps-hermes.n8n-blas.com.ar";
const HERMES_TOKEN =
  (import.meta.env.VITE_HERMES_INTERNAL_TOKEN as string | undefined) ||
  "8KqNm3vR7tYxL2pH9wJ4sZ6bF1cA5dG0eU8iO3kP4qX7vN2mL9";

export type LearnAccion = "approved" | "edited" | "discarded";

export interface LearnFeedbackParams {
  suggestionId: string;
  /** approved | edited | discarded */
  accion: LearnAccion;
  /** tipo de la suggestion (daily_brief, email_draft, clasificacion, ...). */
  tipo?: string;
  /** Lo que Hermes propuso originalmente. */
  payloadOriginal: Record<string, unknown>;
  /** Lo que quedó tras la edición humana (null si no hubo edición). */
  payloadFinal?: Record<string, unknown> | null;
  /** Comentario libre del operador (sobre todo al descartar). */
  motivo?: string;
  /** auth.user.id de quien tomó la decisión. */
  validadoPor?: string | null;
}

/**
 * Notifica a Hermes para que aprenda de una decisión humana. Best-effort:
 * nunca lanza; loguea y sigue. Devuelve true si Hermes respondió OK.
 */
export async function learnFromFeedback(params: LearnFeedbackParams): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${HERMES_URL}/tasks/learn_from_feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hermes-Token": HERMES_TOKEN,
      },
      body: JSON.stringify({
        suggestion_id: params.suggestionId,
        accion: params.accion,
        tipo: params.tipo,
        payload_original: params.payloadOriginal,
        payload_final: params.payloadFinal ?? null,
        motivo: params.motivo,
        validado_por: params.validadoPor ?? null,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      logger.warn(`[hermesLearn] learn_from_feedback ${res.status}: ${txt.slice(0, 160)}`);
      return false;
    }
    return true;
  } catch (e) {
    // Endpoint ausente (backend viejo), timeout o red: no es crítico.
    logger.warn("[hermesLearn] learn_from_feedback no disponible:", e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
