import { createTransport } from "npm:nodemailer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_ROLES } from "../_shared/roles.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });

type Principal =
  | { kind: "service" }
  | { kind: "admin"; userId: string }
  | { kind: "student"; userId: string; verifiedEmail: string };

const authenticate = async (req: Request): Promise<Principal | null> => {
  const token = req.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;

  if (SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY) {
    return { kind: "service" };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await admin
    .from("estudiantes")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError || !profile) return null;

  if (profile.role && ADMIN_ROLES.has(profile.role)) {
    return { kind: "admin", userId: user.id };
  }

  const verifiedEmail = user.email_confirmed_at ? user.email?.trim().toLowerCase() : "";
  if (!verifiedEmail) return null;

  return {
    kind: "student",
    userId: user.id,
    verifiedEmail,
  };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isReasonableEmail = (value: string): boolean =>
  value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const principal = await authenticate(req);
  if (!principal) return json({ error: "No autorizado." }, 401);

  let studentReservationId: string | null = null;

  try {
    const smtpEmail = Deno.env.get("SMTP_EMAIL");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpEmail || !smtpPassword) {
      throw new Error("El servicio de correo no está configurado.");
    }

    const body = (await req.json().catch(() => ({}))) as {
      to?: unknown;
      cc?: unknown;
      subject?: unknown;
      text?: unknown;
      name?: unknown;
      html?: unknown;
    };

    const submittedTo = String(body.to ?? "")
      .trim()
      .toLowerCase();
    const subject = String(body.subject ?? "").trim();
    const text = String(body.text ?? "");
    const name = String(body.name ?? "").slice(0, 200);
    const submittedHtml = body.html == null ? "" : String(body.html);
    const submittedCc = body.cc == null ? "" : String(body.cc).trim().toLowerCase();

    if (!subject || subject.length > 180) {
      return json({ error: "El asunto es obligatorio y no puede superar 180 caracteres." }, 400);
    }
    if (text.length > 20_000 || submittedHtml.length > 100_000) {
      return json({ error: "El contenido del correo supera el límite permitido." }, 413);
    }

    let recipient = submittedTo;
    let cc: string | undefined = submittedCc || undefined;

    if (principal.kind === "student") {
      // Un alumno puede disparar sus constancias, pero jamás elegir a quién se
      // envían. El destino real es exclusivamente su correo confirmado de Auth.
      recipient = principal.verifiedEmail;
      cc = undefined;

      const { data: reservationId, error: reservationError } = await admin.rpc(
        "reserve_student_email_send",
        { p_user_id: principal.userId }
      );

      if (reservationError) {
        console.error(
          "[send-email] Student rate-limit reservation failed:",
          reservationError.message
        );
        return json({ error: "No pudimos procesar el correo en este momento." }, 503);
      }
      if (typeof reservationId !== "string") {
        return json(
          { error: "Se alcanzó el límite de correos. Intentá nuevamente más tarde." },
          429
        );
      }
      studentReservationId = reservationId;
    } else {
      if (!recipient || !isReasonableEmail(recipient)) {
        return json({ error: "El destinatario no es válido." }, 400);
      }
      if (cc && !isReasonableEmail(cc)) {
        return json({ error: "La dirección de copia no es válida." }, 400);
      }
    }

    const html =
      submittedHtml ||
      `<div style="font-family:sans-serif;padding:20px;">
        <h2>Hola ${escapeHtml(name)},</h2>
        <p style="white-space:pre-line;font-size:16px;color:#333;">${escapeHtml(text)}</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;" />
        <p style="font-size:12px;color:#888;">Mensaje automático del sistema de gestión de PPS.</p>
      </div>`;

    const transporter = createTransport({
      service: "gmail",
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"Mi Panel Académico" <${smtpEmail}>`,
      to: recipient,
      cc,
      subject,
      text,
      html,
    });

    if (studentReservationId) {
      await admin.rpc("finish_student_email_send", {
        p_event_id: studentReservationId,
        p_sent: true,
      });
    }

    console.log("[send-email] Email accepted by SMTP");
    return json(
      principal.kind === "student"
        ? { success: true }
        : { success: true, messageId: info.messageId }
    );
  } catch (error) {
    if (studentReservationId) {
      await admin.rpc("finish_student_email_send", {
        p_event_id: studentReservationId,
        p_sent: false,
      });
    }

    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[send-email] Delivery error:", message);
    return json({ error: "No se pudo enviar el correo." }, 502);
  }
});
