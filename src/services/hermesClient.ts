// ──────────────────────────────────────────────────────────────────────────
// hermesClient — único punto de salida del panel hacia Hermes.
//
// El frontend NO conoce el token de Hermes. Todas las llamadas pasan por la
// Edge Function `hermes-proxy`, que valida la sesión + el rol y guarda el
// secreto machine-to-machine en el servidor.
//
// `supabase.functions.invoke` adjunta solo el JWT de la sesión activa, así que
// la autorización queda del lado del servidor.
// ──────────────────────────────────────────────────────────────────────────
import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";

/** Tareas expuestas por la allowlist de `hermes-proxy`. */
export type HermesTask =
  | "gmail_thread"
  | "gmail_send"
  | "gmail_modify"
  | "draft_pending_emails"
  | "plan_today"
  | "learn_from_feedback"
  | "daily_brief_from_db"
  /** Sonda de disponibilidad (no es una tarea de Hermes). */
  | "__health";

/** Estado de disponibilidad reportado por la sonda del proxy. */
export interface HermesHealth {
  estado: "online" | "degradado" | "offline";
  httpStatus?: number;
  motivo?: "timeout" | "inalcanzable";
  latenciaMs: number;
  verificadoEn: string;
}

export class HermesError extends Error {
  /** Código HTTP con el que respondió el proxy (o Hermes detrás de él). */
  readonly status?: number;
  /** True si la llamada se cortó por timeout. */
  readonly timeout: boolean;

  constructor(message: string, opts: { status?: number; timeout?: boolean } = {}) {
    super(message);
    this.name = "HermesError";
    this.status = opts.status;
    this.timeout = opts.timeout ?? false;
  }
}

interface ProxyResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  detalle?: string;
  status?: number;
  timeout?: boolean;
}

/**
 * Invoca una tarea de Hermes a través del proxy autenticado.
 * Lanza `HermesError` si la tarea falla; devuelve el payload de Hermes si sale bien.
 */
export async function callHermes<T = unknown>(
  task: HermesTask,
  payload: Record<string, unknown> = {},
  timeoutMs?: number
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<ProxyResponse<T>>("hermes-proxy", {
    body: { task, payload, timeoutMs },
  });

  // Error de transporte / no-2xx: el body con el detalle viene en error.context.
  if (error) {
    let detail = error.message;
    let status: number | undefined;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = (await context.json()) as ProxyResponse<T>;
        detail = body.error || detail;
        status = body.status ?? context.status;
        if (body.timeout) throw new HermesError(detail, { status, timeout: true });
      } catch (e) {
        if (e instanceof HermesError) throw e;
        status = context.status;
      }
    }
    throw new HermesError(detail, { status });
  }

  if (!data?.ok) {
    throw new HermesError(data?.error || "Hermes no pudo procesar la solicitud.", {
      status: data?.status,
      timeout: data?.timeout,
    });
  }

  return data.data as T;
}

/**
 * Igual que `callHermes` pero best-effort: nunca lanza.
 * Para los caminos donde Hermes es un extra y su caída no debe romper la acción
 * del usuario (aprendizaje, borradores pre-generados).
 */
export async function callHermesSafe<T = unknown>(
  task: HermesTask,
  payload: Record<string, unknown> = {},
  timeoutMs?: number
): Promise<T | null> {
  try {
    return await callHermes<T>(task, payload, timeoutMs);
  } catch (e) {
    logger.warn(`[hermesClient] ${task} no disponible:`, e);
    return null;
  }
}
