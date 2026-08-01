// ──────────────────────────────────────────────────────────────────────────
// hermesLearn — cierre del loop de aprendizaje del agente.
//
// Cuando el operador resuelve una suggestion en el panel (aprueba / edita /
// descarta), además del UPDATE en agent_suggestions, avisamos a Hermes vía
// learn_from_feedback para que destile una lección. Hermes:
//   1. La escribe en su vault (agent/aprendizajes.md).
//   2. La espeja en agent_audit_log (tool=learn.done, output.aprendizaje) para
//      que el panel pueda mostrarla en el Dashboard de Inteligencia Hermes.
//   3. Para tipo=clasificacion aprobada/editada, materializa whatsapp_contactos.
//
// Es best-effort: si Hermes está caído o el endpoint no existe, NO rompe la
// acción del usuario (la suggestion ya quedó resuelta en Supabase). La llamada
// sale por la Edge Function `hermes-proxy`, que guarda el token en el servidor.
// ──────────────────────────────────────────────────────────────────────────
import { callHermesSafe } from "./hermesClient";

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
  const res = await callHermesSafe(
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
  return res !== null;
}
