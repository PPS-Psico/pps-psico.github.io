/**
 * notify-selection-closed — Avisa a los seleccionados de una PPS.
 *
 * POR QUÉ EXISTE
 * Hasta septiembre de 2026 este envío lo hacía el navegador del admin: un
 * `Promise.all` sobre N estudiantes, soltado con `void ...catch()`. Sin registro
 * de a quién se le mandó, sin reintento y sin idempotencia. Cerrar la pestaña a
 * mitad de camino dejaba estudiantes sin avisar y sin forma de saber cuáles.
 *
 * Ahora el envío es reintentable: cada convocatoria se reserva bajo lock
 * (`claim_seleccion_notificacion_batch`), y solo al confirmar el envío se
 * persiste `seleccion_notificada_at` (`finish_seleccion_notificacion`). Llamar
 * dos veces no duplica correos: la segunda corrida ve la cola vacía.
 *
 * Mismo patrón que `send-consentimiento-final-reminders`, del que toma la
 * estructura de claim, el pool de concurrencia y el manejo del caso crítico
 * "el SMTP aceptó pero la marca no se pudo persistir".
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_ROLES } from "../_shared/roles.ts";
import { buildSelectionEmail } from "../_shared/selectionEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") || "https://pps-psico.github.io").replace(/\/$/, "");
const PANEL_URL = APP_URL + "/#/student";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });

const isReasonableEmail = (value: string): boolean =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const formatEncuentro = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${fecha} a las ${hora} hs`;
};

type Candidate = {
  convocatoria_id: string;
  estudiante_nombre: string | null;
  estudiante_correo: string | null;
  estudiante_user_id: string | null;
  pps_nombre: string | null;
  horario: string | null;
  encuentro_inicial: string | null;
};

const finishClaim = async (
  convocatoriaId: string,
  claimToken: string,
  sent: boolean
): Promise<boolean> => {
  const { data, error } = await admin.rpc("finish_seleccion_notificacion", {
    p_convocatoria_id: convocatoriaId,
    p_claim_token: claimToken,
    p_sent: sent,
  });
  if (error) throw error;
  return data === true;
};

/**
 * Los push son best-effort y NUNCA deciden si el aviso se da por hecho: lo que
 * cuenta es el correo. Un FCM caído no debe dejar al estudiante en la cola de
 * pendientes para siempre.
 */
const sendPush = async (
  templateId: string,
  fallback: { title: string; body: string },
  userId: string,
  vars: Record<string, string>,
  extra: Record<string, unknown> = {}
): Promise<void> => {
  try {
    const { data: template } = await admin
      .from("email_templates")
      .select("subject, body, is_active")
      .eq("id", templateId)
      .maybeSingle();

    if (template?.is_active === false) return;

    const fill = (value: string) =>
      Object.entries(vars).reduce((acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val), value);

    await admin.functions.invoke("send-fcm-notification", {
      body: {
        title: fill(template?.subject || fallback.title),
        body: fill(template?.body || fallback.body),
        user_ids: [userId],
        ...extra,
      },
    });
  } catch (error) {
    console.error(`[notify-selection] push ${templateId} falló:`, error);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const token = req.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return json({ success: false, error: "No autorizado." }, 401);

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user) return json({ success: false, error: "No autorizado." }, 401);

  const { data: profile, error: profileError } = await admin
    .from("estudiantes")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError || !profile?.role || !ADMIN_ROLES.has(profile.role)) {
    return json({ success: false, error: "No tenés permisos para avisar seleccionados." }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as { launchId?: unknown };
  const launchId = String(body.launchId ?? "").trim();
  if (!UUID_RE.test(launchId)) {
    return json({ success: false, error: "El lanzamiento no es válido." }, 400);
  }

  const claimToken = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  const { data: claimedData, error: claimError } = await admin.rpc(
    "claim_seleccion_notificacion_batch",
    {
      p_lanzamiento_id: launchId,
      p_actor_user_id: user.id,
      p_claim_token: claimToken,
      p_requested_at: requestedAt,
    }
  );

  if (claimError) {
    console.error("[notify-selection] Claim failed:", claimError.message);
    return json({ success: false, error: claimError.message });
  }

  const candidates = (claimedData || []) as Candidate[];
  if (candidates.length === 0) {
    return json({
      success: true,
      requested: 0,
      sent: 0,
      failed: 0,
      failures: [],
      message: "No quedan estudiantes por avisar.",
    });
  }

  // La plantilla se lee una sola vez para todo el lote: es la misma fila de
  // `email_templates` que edita Coordinación desde el panel.
  const { data: template } = await admin
    .from("email_templates")
    .select("subject, body, is_active")
    .eq("id", "seleccion")
    .maybeSingle();

  if (template?.is_active === false) {
    // La automatización está apagada a propósito. Se liberan las reservas para
    // no dejar filas trabadas 15 minutos.
    await Promise.all(
      candidates.map((c) =>
        finishClaim(c.convocatoria_id, claimToken, false).catch(() => undefined)
      )
    );
    return json({
      success: true,
      requested: 0,
      sent: 0,
      failed: 0,
      failures: [],
      message: "La automatización de correos de selección está desactivada.",
    });
  }

  const failures: Array<{ convocatoriaId: string; name: string; reason: string }> = [];
  let sent = 0;
  let cursor = 0;

  const processNext = async (): Promise<void> => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor];
      cursor += 1;

      const name = candidate.estudiante_nombre?.trim() || "Estudiante";
      const recipient = candidate.estudiante_correo?.trim().toLowerCase() || "";
      const ppsName = candidate.pps_nombre?.trim() || "PPS";

      if (!isReasonableEmail(recipient)) {
        failures.push({
          convocatoriaId: candidate.convocatoria_id,
          name,
          reason: "No tiene un correo válido.",
        });
        await finishClaim(candidate.convocatoria_id, claimToken, false).catch((error) =>
          console.error("[notify-selection] No se pudo liberar la reserva:", error)
        );
        continue;
      }

      const { subject, text, html } = buildSelectionEmail({
        studentName: name,
        ppsName,
        schedule: candidate.horario,
        encuentroInicial: formatEncuentro(candidate.encuentro_inicial),
        panelUrl: PANEL_URL,
        templateSubject: template?.subject,
        templateBody: template?.body,
      });

      let emailAccepted = false;
      try {
        const { data: emailResult, error: emailError } = await admin.functions.invoke(
          "send-email",
          { body: { to: recipient, name, subject, text, html } }
        );
        if (emailError || !emailResult?.success) {
          throw emailError || new Error(String(emailResult?.error || "El correo no fue aceptado."));
        }
        emailAccepted = true;

        const finalized = await finishClaim(candidate.convocatoria_id, claimToken, true).catch(
          (error) => {
            console.error("[notify-selection] RPC de cierre falló:", error);
            return false;
          }
        );

        if (!finalized) {
          // El SMTP ya aceptó: nunca liberamos la reserva como si hubiera
          // fallado, porque el próximo intento le escribiría de nuevo.
          const { data: reconciled, error: reconcileError } = await admin
            .from("convocatorias")
            .update({
              seleccion_notificada_at: requestedAt,
              seleccion_notificada_por: user.id,
              seleccion_notificacion_claimed_at: null,
              seleccion_notificacion_claim_token: null,
              seleccion_notificacion_claimed_by: null,
            })
            .eq("id", candidate.convocatoria_id)
            .eq("seleccion_notificacion_claim_token", claimToken)
            .select("id")
            .maybeSingle();
          if (reconcileError || !reconciled) {
            throw reconcileError || new Error("El envío no pudo quedar registrado.");
          }
        }

        sent += 1;

        // Los dos push del flujo viejo, en el mismo orden: primero el aviso de
        // selección y después el recordatorio del consentimiento, con tag propio
        // para que no se reemplacen entre sí en el dispositivo.
        if (candidate.estudiante_user_id) {
          const vars = { nombre_alumno: name, nombre_pps: ppsName };
          await sendPush(
            "seleccion_push",
            { title: "¡Fuiste seleccionado! 🎉", body: "Revisá tu correo para más detalles." },
            candidate.estudiante_user_id,
            vars,
            { type: "selection" }
          );
          await sendPush(
            "compromiso_push",
            {
              title: "Falta tu consentimiento digital ✍️",
              body: "Para confirmar tu lugar tenés que aceptar el compromiso desde Mi Panel.",
            },
            candidate.estudiante_user_id,
            vars,
            { type: "compromiso", data: { tag: "pps-consent", url: PANEL_URL } }
          );
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Error desconocido de envío.";
        failures.push({ convocatoriaId: candidate.convocatoria_id, name, reason });
        if (!emailAccepted) {
          await finishClaim(candidate.convocatoria_id, claimToken, false).catch((releaseError) =>
            console.error("[notify-selection] No se pudo liberar la reserva:", releaseError)
          );
        } else {
          console.error(
            `[notify-selection] CRÍTICO: correo aceptado pero sin registrar para ${candidate.convocatoria_id}`
          );
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, () => processNext()));

  console.log(
    `[notify-selection] launch=${launchId} requested=${candidates.length} sent=${sent} failed=${failures.length}`
  );

  return json({
    success: failures.length === 0,
    requested: candidates.length,
    sent,
    failed: failures.length,
    failures,
  });
});
