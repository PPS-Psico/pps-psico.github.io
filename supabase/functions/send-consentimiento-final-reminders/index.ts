import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_ROLES } from "../_shared/roles.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Mismo patron que `check-consentimiento-pendientes`: el dominio sale de una env
// var y el fallback es el que sirve GitHub Pages hoy. El valor anterior
// (pps.psico.uflo.edu.ar) dejo de resolver, asi que el boton "Ingresar y firmar"
// de este mail no llevaba a ningun lado.
const APP_URL = (Deno.env.get("APP_URL") || "https://pps-psico.github.io").replace(/\/$/, "");
const PANEL_URL = APP_URL + "/#/student";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isReasonableEmail = (value: string): boolean =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const formatDeadline = (iso: string): string =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

const buildEmailHtml = (name: string, ppsName: string, deadlineLabel: string): string => {
  const safeName = escapeHtml(name);
  const safePps = escapeHtml(ppsName);
  const safeDeadline = escapeHtml(deadlineLabel);

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f1ea;color:#191814;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #d8d2c7;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 22px;border-bottom:1px solid #e7e1d7;">
              <div style="font-size:12px;line-height:1.4;letter-spacing:.12em;text-transform:uppercase;color:#a7461c;font-weight:700;">Último recordatorio</div>
              <h1 style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.12;font-weight:400;color:#191814;">Confirmá tu participación en la PPS</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.65;">Hola ${safeName},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#49463f;">Todavía está pendiente tu aceptación del consentimiento informado y compromiso digital para <strong style="color:#191814;">${safePps}</strong>.</p>
              <div style="margin:0 0 22px;padding:18px 20px;border:1px solid #d65a28;border-radius:12px;background:#fff5ed;">
                <div style="font-size:13px;line-height:1.4;text-transform:uppercase;letter-spacing:.08em;color:#a7461c;font-weight:700;">Tenés 24 horas</div>
                <div style="margin-top:7px;font-size:18px;line-height:1.45;color:#191814;font-weight:700;">Confirmá antes del ${safeDeadline}</div>
                <div style="margin-top:7px;font-size:14px;line-height:1.55;color:#6b4a38;">Si no firmás antes de ese momento, el sistema dará de baja automáticamente tu selección y liberará la vacante.</div>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr><td style="border-radius:10px;background:#191814;">
                  <a href="${PANEL_URL}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;line-height:1;font-weight:700;">Ingresar y firmar</a>
                </td></tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#777168;">Este es el último recordatorio. Si ya confirmaste desde otro dispositivo, no necesitás hacer nada más.</p>
            </td>
          </tr>
          <tr><td style="padding:18px 32px;border-top:1px solid #e7e1d7;font-size:12px;line-height:1.5;color:#8b857b;">Coordinación de Prácticas Profesionales Supervisadas · UFLO</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

type ClaimedCandidate = {
  convocatoria_id: string;
  estudiante_nombre: string | null;
  estudiante_correo: string | null;
  pps_nombre: string | null;
  deadline_at: string;
};

const releaseOrFinishClaim = async (
  convocatoriaId: string,
  claimToken: string,
  sent: boolean
): Promise<boolean> => {
  const { data, error } = await admin.rpc("finish_consentimiento_final_reminder", {
    p_convocatoria_id: convocatoriaId,
    p_claim_token: claimToken,
    p_sent: sent,
  });
  if (error) throw error;
  return data === true;
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
    return json({ success: false, error: "No tenés permisos para enviar recordatorios." }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as { launchId?: unknown };
  const launchId = String(body.launchId ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(launchId)
  ) {
    return json({ success: false, error: "El lanzamiento no es válido." }, 400);
  }

  const claimToken = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  const { data: claimedData, error: claimError } = await admin.rpc(
    "claim_consentimiento_final_reminder_batch",
    {
      p_lanzamiento_id: launchId,
      p_actor_user_id: user.id,
      p_claim_token: claimToken,
      p_requested_at: requestedAt,
    }
  );

  if (claimError) {
    console.error("[final-consent-reminder] Claim failed:", claimError.message);
    return json({ success: false, error: claimError.message });
  }

  const candidates = (claimedData || []) as ClaimedCandidate[];
  if (candidates.length === 0) {
    return json({
      success: true,
      requested: 0,
      sent: 0,
      failed: 0,
      deadline_at: null,
      failures: [],
      message: "No hay recordatorios pendientes de envío.",
    });
  }

  const failures: Array<{ convocatoriaId: string; name: string; reason: string }> = [];
  let sent = 0;
  let cursor = 0;

  const processNext = async (): Promise<void> => {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      const candidate = candidates[index];
      const name = candidate.estudiante_nombre?.trim() || "Estudiante";
      const recipient = candidate.estudiante_correo?.trim().toLowerCase() || "";
      const ppsName = candidate.pps_nombre?.trim() || "PPS";
      const deadlineLabel = formatDeadline(candidate.deadline_at);

      if (!isReasonableEmail(recipient)) {
        failures.push({
          convocatoriaId: candidate.convocatoria_id,
          name,
          reason: "No tiene un correo válido.",
        });
        await releaseOrFinishClaim(candidate.convocatoria_id, claimToken, false).catch((error) =>
          console.error("[final-consent-reminder] Could not release invalid-email claim:", error)
        );
        continue;
      }

      const subject = `Último recordatorio: confirmá tu participación en ${ppsName}`;
      const text =
        `Hola ${name}, este es el último recordatorio para aceptar el consentimiento informado ` +
        `y compromiso digital de la PPS ${ppsName}. Tenés 24 horas desde este envío, hasta el ` +
        `${deadlineLabel}, para confirmarlo. Si no firmás antes de ese momento, el sistema dará ` +
        `de baja automáticamente tu selección y liberará la vacante. Ingresá a ${PANEL_URL}`;

      let emailAccepted = false;
      try {
        const { data: emailResult, error: emailError } = await admin.functions.invoke(
          "send-email",
          {
            body: {
              to: recipient,
              name,
              subject,
              text,
              html: buildEmailHtml(name, ppsName, deadlineLabel),
            },
          }
        );
        if (emailError || !emailResult?.success) {
          throw emailError || new Error(String(emailResult?.error || "El correo no fue aceptado."));
        }
        emailAccepted = true;

        let finalized = false;
        try {
          finalized = await releaseOrFinishClaim(candidate.convocatoria_id, claimToken, true);
        } catch (finalizeError) {
          console.error(
            "[final-consent-reminder] RPC finalization failed; trying guarded fallback:",
            finalizeError
          );
        }

        if (!finalized) {
          // El SMTP ya aceptó el mensaje: nunca liberamos la reserva como si el
          // correo hubiera fallado. Este update condicionado preserva las 24 h
          // prometidas aun si la RPC tuvo un error transitorio.
          const { data: reconciled, error: reconcileError } = await admin
            .from("convocatorias")
            .update({
              final_reminder_sent_at: requestedAt,
              final_reminder_sent_by: user.id,
              reminder_sent_at: requestedAt,
              final_reminder_claimed_at: null,
              final_reminder_claim_token: null,
              final_reminder_claimed_by: null,
            })
            .eq("id", candidate.convocatoria_id)
            .eq("final_reminder_claim_token", claimToken)
            .select("id")
            .maybeSingle();
          if (reconcileError || !reconciled) {
            throw reconcileError || new Error("El envío no pudo quedar registrado.");
          }
        }
        sent += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Error desconocido de envío.";
        failures.push({ convocatoriaId: candidate.convocatoria_id, name, reason });
        if (!emailAccepted) {
          await releaseOrFinishClaim(candidate.convocatoria_id, claimToken, false).catch(
            (releaseError) =>
              console.error(
                "[final-consent-reminder] Could not release failed claim:",
                releaseError
              )
          );
        } else {
          console.error(
            `[final-consent-reminder] CRITICAL: email accepted but deadline not persisted for ${candidate.convocatoria_id}`
          );
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, () => processNext()));

  const deadlineAt = candidates[0]?.deadline_at ?? null;
  console.log(
    `[final-consent-reminder] launch=${launchId} requested=${candidates.length} sent=${sent} failed=${failures.length}`
  );

  return json({
    success: failures.length === 0,
    requested: candidates.length,
    sent,
    failed: failures.length,
    deadline_at: deadlineAt,
    failures,
  });
});
