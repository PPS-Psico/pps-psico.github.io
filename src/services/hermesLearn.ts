// Cierre best-effort del loop de aprendizaje de Hermes.
// El browser invoca exclusivamente hermes-proxy; las credenciales quedan server-side.
import { logger } from "../utils/logger";
import { invokeHermesTask } from "./hermesProxyService";

export type LearnAccion = "approved" | "edited" | "discarded";

export interface LearnFeedbackParams {
  suggestionId: string;
  accion: LearnAccion;
  tipo?: string;
  payloadOriginal: Record<string, unknown>;
  payloadFinal?: Record<string, unknown> | null;
  motivo?: string;
  validadoPor?: string | null;
}

/** Notifica una decisión humana sin bloquear la acción principal si Hermes falla. */
export async function learnFromFeedback(params: LearnFeedbackParams): Promise<boolean> {
  try {
    await invokeHermesTask(
      "learn_from_feedback",
      {
        suggestion_id: params.suggestionId,
        accion: params.accion,
        tipo: params.tipo,
        payload_original: params.payloadOriginal,
        payload_final: params.payloadFinal ?? null,
        motivo: params.motivo,
        validado_por: params.validadoPor ?? null,
      },
      20000
    );
    return true;
  } catch (error) {
    logger.warn("[hermesLearn] learn_from_feedback no disponible:", error);
    return false;
  }
}
