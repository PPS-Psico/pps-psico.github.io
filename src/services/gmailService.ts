import { logger } from "../utils/logger";
// ──────────────────────────────────────────────────────────────────────────
// gmailService — puente del panel con Gmail a través del backend Hermes.
//
// El frontend NUNCA habla con la Gmail API directamente: todo pasa por Hermes
// (que tiene la credencial OAuth en el servidor / dispara n8n). Esto mantiene
// los secretos fuera del browser y centraliza la auditoría.
//
// Capas:
//   · getThread   → leer el hilo completo (Capa 1/3: cuerpo completo on-demand)
//   · sendReply   → responder dentro del hilo (Capa 2)
//   · modifyThread→ archivar / marcar leído / etc. (Capa 2)
//
// SEGURIDAD: respeta el kill-switch global PPS_DISABLE_EMAILS. Con el switch
// activo, sendReply hace dry-run (no envía) y modifyThread no toca nada.
// ──────────────────────────────────────────────────────────────────────────

const HERMES_URL =
  (import.meta.env.VITE_HERMES_API_URL as string | undefined) ||
  "https://pps-hermes.n8n-blas.com.ar";
const HERMES_TOKEN =
  (import.meta.env.VITE_HERMES_INTERNAL_TOKEN as string | undefined) ||
  "8KqNm3vR7tYxL2pH9wJ4sZ6bF1cA5dG0eU8iO3kP4qX7vN2mL9";

export interface GmailMessage {
  id?: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  /** Cuerpo en texto plano (preferido para mostrar). */
  body?: string;
  /** Cuerpo HTML si vino disponible. */
  html?: string;
  /** Vista previa corta (siempre disponible aunque no haya body completo). */
  snippet?: string;
  fromMe?: boolean;
}

export interface GmailThread {
  threadId: string;
  asunto: string;
  participantes: string[];
  mensajes: GmailMessage[];
}

export interface GmailActionResult {
  success: boolean;
  message?: string;
  dryRun?: boolean;
}

export const isEmailSendingDisabled = (): boolean => {
  try {
    return (
      typeof localStorage !== "undefined" && localStorage.getItem("PPS_DISABLE_EMAILS") === "1"
    );
  } catch {
    return false;
  }
};

async function hermesPost<T>(path: string, body: unknown, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${HERMES_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hermes-Token": HERMES_TOKEN,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Hermes ${res.status}: ${txt.slice(0, 160) || res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Capa 1/3: leer el hilo completo ───────────────────────────────────────
export async function getThread(threadId: string): Promise<GmailThread> {
  const data = await hermesPost<Record<string, unknown>>("/tasks/gmail_thread", {
    thread_id: threadId,
  });
  const mensajesRaw = (data.mensajes || data.messages || []) as Array<Record<string, unknown>>;
  return {
    threadId,
    asunto: String(data.asunto || data.subject || "(sin asunto)"),
    participantes: (data.participantes as string[]) || [],
    mensajes: mensajesRaw.map((m) => ({
      id: m.id ? String(m.id) : undefined,
      from: String(m.from || ""),
      to: String(m.to || ""),
      subject: String(m.subject || ""),
      date: String(m.date || ""),
      body: m.body ? String(m.body) : undefined,
      html: m.html ? String(m.html) : undefined,
      snippet: m.snippet ? String(m.snippet) : undefined,
      fromMe: Boolean(m.from_me ?? m.fromMe),
    })),
  };
}

// ── Capa 2: responder dentro del hilo ──────────────────────────────────────
export async function sendReply(params: {
  threadId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<GmailActionResult> {
  if (isEmailSendingDisabled()) {
    logger.warn(
      `[gmailService] 🛑 DRY-RUN (PPS_DISABLE_EMAILS=1): respuesta a ${params.to} NO enviada.`
    );
    return { success: true, dryRun: true, message: "DRY-RUN: no se envió (modo seguro)" };
  }
  try {
    await hermesPost("/tasks/gmail_send", {
      thread_id: params.threadId,
      to: params.to,
      subject: params.subject,
      body: params.body,
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

// ── Capa 2: archivar / marcar leído / etc. ─────────────────────────────────
export type GmailAction = "archive" | "markRead" | "markUnread" | "trash";

export async function modifyThread(
  threadId: string,
  action: GmailAction
): Promise<GmailActionResult> {
  if (isEmailSendingDisabled() && action === "trash") {
    return {
      success: true,
      dryRun: true,
      message: "DRY-RUN: no se movió a papelera (modo seguro)",
    };
  }
  try {
    await hermesPost("/tasks/gmail_modify", { thread_id: threadId, action });
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

// ── Borrador inteligente pre-generado por Hermes ───────────────────────────
// Hermes genera borradores en segundo plano (endpoint draft_pending_emails) y
// los guarda en `agent_suggestions` (tipo email_draft, contexto.thread_id). El
// panel los muestra al instante sin esperar al LLM.

export interface HermesDraft {
  suggestionId: string;
  borrador: string;
  asunto?: string;
  requiereDecision?: boolean;
  motivo?: string;
}

/** Busca un borrador pre-generado para un hilo. Lee `agent_suggestions` directo. */
export async function getDraftForThread(
  threadId: string,
  isTestingMode = false
): Promise<HermesDraft | null> {
  if (isTestingMode) return null;
  try {
    // import dinámico para no acoplar el servicio al cliente supabase en SSR/test
    const { supabase } = await import("../lib/supabaseClient");
    const { data, error } = await supabase
      .from("agent_suggestions")
      .select("id, payload, contexto, created_at")
      .eq("tipo", "email_draft")
      .eq("estado", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return null;
    const hit = data.find(
      (s) => ((s.contexto as Record<string, unknown> | null)?.thread_id ?? "") === threadId
    );
    if (!hit) return null;
    const p = (hit.payload as Record<string, unknown>) || {};
    return {
      suggestionId: String(hit.id),
      borrador: String(p.borrador || ""),
      asunto: p.asunto ? String(p.asunto) : undefined,
      requiereDecision: Boolean(p.requiere_decision_humana),
      motivo: p.motivo ? String(p.motivo) : undefined,
    };
  } catch {
    return null;
  }
}

/** Pide a Hermes generar borradores para los correos pendientes (on-demand). */
export async function generatePendingDrafts(limit = 10): Promise<{ generados: number } | null> {
  try {
    const res = await hermesPost<{ borradores_generados?: number }>(
      "/tasks/draft_pending_emails",
      { limit, only_missing: true },
      30000
    );
    return { generados: res.borradores_generados ?? 0 };
  } catch {
    return null;
  }
}

/** Pide a Hermes recalcular el plan de acciones del día (multi-fuente). */
export async function planToday(
  limit = 9
): Promise<{ ok: true; acciones: number } | { ok: false; motivo: string }> {
  try {
    const res = await hermesPost<{ acciones_generadas?: number }>(
      "/tasks/plan_today",
      { limit },
      40000
    );
    return { ok: true, acciones: res.acciones_generadas ?? 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 404 = el backend desplegado no tiene esta tarea todavía (versión vieja).
    const motivo = /404/.test(msg)
      ? "El servidor de Hermes no tiene la tarea de planificación desplegada todavía."
      : /aborted|abort|timeout/i.test(msg)
        ? "Hermes tardó demasiado en responder. Probá de nuevo en un momento."
        : "No se pudo contactar a Hermes para replanificar el día.";
    logger.error("[planToday] error:", msg);
    return { ok: false, motivo };
  }
}

/** Devuelve el set de thread_ids que YA tienen un borrador de Hermes pendiente. */
export async function getThreadsWithDraft(isTestingMode = false): Promise<Set<string>> {
  const out = new Set<string>();
  if (isTestingMode) return out;
  try {
    const { supabase } = await import("../lib/supabaseClient");
    const { data } = await supabase
      .from("agent_suggestions")
      .select("contexto")
      .eq("tipo", "email_draft")
      .eq("estado", "pending")
      .limit(500);
    (data || []).forEach((s) => {
      const tid = (s.contexto as Record<string, unknown> | null)?.thread_id;
      if (tid) out.add(String(tid));
    });
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Cierra el ciclo de aprendizaje: cuando el operador envía un borrador (lo haya
 * editado o no), Hermes registra la diferencia entre lo que propuso y lo que se
 * envió, y destila una lección a su vault (endpoint learn_from_feedback).
 *
 * Es best-effort y no bloquea el envío: si falla, no rompe nada.
 */
export async function learnFromDraftEdit(params: {
  suggestionId: string;
  borradorOriginal: string;
  borradorFinal: string;
  asunto?: string;
}): Promise<void> {
  const edited = params.borradorOriginal.trim() !== params.borradorFinal.trim();
  // Si no editó nada, igual avisamos (accion=approved) para que aprenda que estuvo OK.
  try {
    await hermesPost(
      "/tasks/learn_from_feedback",
      {
        suggestion_id: params.suggestionId,
        accion: edited ? "edited" : "approved",
        tipo: "email_draft",
        payload_original: { borrador: params.borradorOriginal, asunto: params.asunto },
        payload_final: edited ? { borrador: params.borradorFinal, asunto: params.asunto } : null,
      },
      20000
    );
    // Marcar la suggestion como resuelta para que no reaparezca.
    const { supabase } = await import("../lib/supabaseClient");
    await supabase
      .from("agent_suggestions")
      .update({ estado: edited ? "edited" : "approved" })
      .eq("id", params.suggestionId);
  } catch (e) {
    logger.warn("[gmailService] learnFromDraftEdit no disponible:", e);
  }
}
