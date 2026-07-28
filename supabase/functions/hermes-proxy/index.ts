// hermes-proxy — puente servidor entre el panel y el backend Hermes.
// El token machine-to-machine vive sólo en los secretos de Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const HERMES_URL = Deno.env.get("HERMES_API_URL") ?? "https://pps-hermes.n8n-blas.com.ar";
const HERMES_TOKEN = Deno.env.get("HERMES_INTERNAL_TOKEN") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ALLOWED_TASKS: Record<string, { path: string; timeoutMs: number }> = {
  gmail_thread: { path: "/tasks/gmail_thread", timeoutMs: 20000 },
  gmail_send: { path: "/tasks/gmail_send", timeoutMs: 20000 },
  gmail_modify: { path: "/tasks/gmail_modify", timeoutMs: 20000 },
  draft_pending_emails: { path: "/tasks/draft_pending_emails", timeoutMs: 30000 },
  plan_today: { path: "/tasks/plan_today", timeoutMs: 40000 },
  learn_from_feedback: { path: "/tasks/learn_from_feedback", timeoutMs: 20000 },
  daily_brief_from_db: { path: "/tasks/daily_brief_from_db", timeoutMs: 60000 },
};

const ADMIN_ROLES = new Set(["admin", "SuperUser"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return json({ ok: false, error: "Falta el token de sesión." }, 401);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json({ ok: false, error: "Sesión inválida." }, 401);
  }

  const { data: userData, error: roleError } = await supabase
    .from("estudiantes")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    console.error("[hermes-proxy] No se pudo verificar el rol:", roleError.message);
    return json({ ok: false, error: "No se pudo verificar tu autorización." }, 500);
  }
  if (!userData?.role || !ADMIN_ROLES.has(userData.role)) {
    return json({ ok: false, error: "No tenés permisos para operar Hermes." }, 403);
  }
  if (!HERMES_TOKEN) {
    console.error("[hermes-proxy] Falta HERMES_INTERNAL_TOKEN.");
    return json({ ok: false, error: "Hermes no está configurado en el servidor." }, 500);
  }

  let body: { task?: string; payload?: unknown; timeoutMs?: number };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body inválido (se esperaba JSON)." }, 400);
  }

  if (body.task === "__health") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const startedAt = Date.now();
    try {
      const res = await fetch(HERMES_URL, {
        method: "GET",
        headers: { "X-Hermes-Token": HERMES_TOKEN },
        signal: controller.signal,
      });
      return json({
        ok: true,
        data: {
          estado: res.status >= 500 ? "degradado" : "online",
          httpStatus: res.status,
          latenciaMs: Date.now() - startedAt,
          verificadoEn: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({
        ok: true,
        data: {
          estado: "offline",
          motivo: /abort/i.test(message) ? "timeout" : "inalcanzable",
          latenciaMs: Date.now() - startedAt,
          verificadoEn: new Date().toISOString(),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const taskDef = body.task ? ALLOWED_TASKS[body.task] : undefined;
  if (!taskDef) {
    return json({ ok: false, error: `Tarea no permitida: ${body.task ?? "(vacía)"}` }, 400);
  }

  const requestedTimeout =
    typeof body.timeoutMs === "number" && Number.isFinite(body.timeoutMs)
      ? body.timeoutMs
      : taskDef.timeoutMs;
  const timeoutMs = Math.min(Math.max(Math.trunc(requestedTimeout), 1000), 60000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${HERMES_URL}${taskDef.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hermes-Token": HERMES_TOKEN,
      },
      body: JSON.stringify(body.payload ?? {}),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[hermes-proxy] ${body.task} → ${res.status}: ${text.slice(0, 300)}`);
      return json(
        {
          ok: false,
          error: `Hermes respondió ${res.status}`,
          detalle: text.slice(0, 300),
          status: res.status,
        },
        502
      );
    }

    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const aborted = /abort/i.test(message);
    console.error(`[hermes-proxy] ${body.task} falló:`, message);
    return json(
      {
        ok: false,
        error: aborted ? "Hermes tardó demasiado en responder." : "No se pudo contactar a Hermes.",
        timeout: aborted,
      },
      502
    );
  } finally {
    clearTimeout(timer);
  }
});
