import { createTransport } from "npm:nodemailer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/hash.ts";
import { escapeHtml } from "../_shared/html.ts";

declare const EdgeRuntime:
  | {
      waitUntil(promise: Promise<unknown>): void;
    }
  | undefined;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") || "https://pps-psico.github.io").replace(/\/$/, "");
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
const IP_HASH_SECRET = Deno.env.get("IP_HASH_SECRET") || SUPABASE_SERVICE_ROLE_KEY;

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
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const GENERIC_OK = {
  ok: true,
  message: "Si el legajo está registrado, enviamos un enlace al correo asociado.",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });

const randomHex = (byteLength: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(byteLength)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const maskEmail = (email: string): string => {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
};

const getCallerIp = (req: Request): string =>
  req.headers.get("cf-connecting-ip")?.trim() ||
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  req.headers.get("x-real-ip")?.trim() ||
  "unknown";

const enforceMinimumResponseTime = async (startedAt: number): Promise<void> => {
  const randomByte = crypto.getRandomValues(new Uint8Array(1))[0] ?? 0;
  const targetMs = 350 + (randomByte % 151);
  const remainingMs = targetMs - (Date.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
};

const verifyTurnstile = async (token: unknown, callerIp: string): Promise<boolean> => {
  if (!TURNSTILE_SECRET_KEY) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) return false;

  const formData = new FormData();
  formData.append("secret", TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  if (callerIp !== "unknown") formData.append("remoteip", callerIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("[password-reset] Turnstile unavailable:", (error as Error).message);
    return false;
  }
};

const buildHtml = (nombre: string, link: string): string => {
  const safeName = escapeHtml(nombre);
  const safeLink = escapeHtml(link);

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;color:#1a1a1a;">
      <h2 style="margin:0 0 12px;">Recuperar tu contraseña</h2>
      <p style="font-size:15px;line-height:1.6;">
        Hola ${safeName}, recibimos un pedido para restablecer la contraseña de tu panel de PPS.
      </p>
      <p style="margin:24px 0;">
        <a href="${safeLink}"
           rel="noreferrer"
           style="background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:8px;
                  text-decoration:none;font-weight:600;display:inline-block;">
          Elegir nueva contraseña
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.6;">
        El enlace vence en 1 hora. Si pedís otro, este dejará de funcionar.<br />
        Si no hiciste este pedido, ignorá el mensaje: tu contraseña sigue igual.
      </p>
      <hr style="border:0;border-top:1px solid #eee;margin:20px 0;" />
      <p style="font-size:12px;color:#888;">Mensaje automático del sistema de gestión de PPS.</p>
    </div>`;
};

type DeliveryTask = {
  requestId: string;
  email: string;
  nombre: string;
  rawToken: string;
};

const deliverResetEmail = async ({
  requestId,
  email,
  nombre,
  rawToken,
}: DeliveryTask): Promise<void> => {
  try {
    const smtpEmail = Deno.env.get("SMTP_EMAIL");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpEmail || !smtpPassword) {
      throw new Error("smtp_not_configured");
    }

    const link = `${APP_URL}/#/login?reset_token=${rawToken}`;
    const transporter = createTransport({
      service: "gmail",
      auth: { user: smtpEmail, pass: smtpPassword },
    });

    await transporter.sendMail({
      from: `"Mi Panel Académico" <${smtpEmail}>`,
      to: email,
      subject: "Recuperar tu contraseña · Panel de PPS",
      text:
        `Hola ${nombre}, para elegir una nueva contraseña entrá a este enlace:\n\n` +
        `${link}\n\nVence en 1 hora. Si pedís otro enlace, este dejará de funcionar.`,
      html: buildHtml(nombre, link),
    });

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "finalize_password_reset_delivery",
      {
        p_request_id: requestId,
        p_delivered: true,
        p_failure_code: null,
      }
    );

    if (finalizeError || finalized !== true) {
      console.error(
        "[password-reset] SMTP accepted but token finalization failed:",
        finalizeError?.message ?? "not finalized"
      );
      return;
    }

    console.log("[password-reset] Recovery email accepted for:", maskEmail(email));
  } catch (error) {
    const message = (error as Error).message || "delivery_failed";
    console.error("[password-reset] Delivery failed:", message);
    await admin.rpc("finalize_password_reset_delivery", {
      p_request_id: requestId,
      p_delivered: false,
      p_failure_code: message.slice(0, 80),
    });
  }
};

Deno.serve(async (req) => {
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const legajo = String((body as { legajo?: unknown }).legajo ?? "").trim();
    const captchaToken = (body as { captchaToken?: unknown }).captchaToken;
    const callerIp = getCallerIp(req);

    if (!/^\d{1,20}$/.test(legajo)) {
      await enforceMinimumResponseTime(startedAt);
      return json(GENERIC_OK);
    }

    if (!(await verifyTurnstile(captchaToken, callerIp))) {
      console.warn("[password-reset] CAPTCHA rejected");
      await enforceMinimumResponseTime(startedAt);
      return json(GENERIC_OK);
    }

    const { data: estudiante, error: studentError } = await admin
      .from("estudiantes")
      .select("id, nombre, user_id")
      .eq("legajo", legajo)
      .maybeSingle();

    if (studentError || !estudiante?.user_id) {
      await enforceMinimumResponseTime(startedAt);
      return json(GENERIC_OK);
    }

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(
      estudiante.user_id
    );
    const authUser = authData?.user;
    const email = normalizeEmail(authUser?.email ?? "");

    if (authError || !email || !authUser?.email_confirmed_at) {
      console.warn("[password-reset] Account has no confirmed Auth recovery channel");
      await enforceMinimumResponseTime(startedAt);
      return json(GENERIC_OK);
    }

    const rawToken = randomHex(32);
    const [tokenHash, emailHash, ipHash] = await Promise.all([
      sha256Hex(rawToken),
      sha256Hex(email),
      sha256Hex(`${IP_HASH_SECRET}:${callerIp}`),
    ]);

    const { data: requestId, error: reserveError } = await admin.rpc(
      "create_password_reset_request",
      {
        p_estudiante_id: estudiante.id,
        p_user_id: estudiante.user_id,
        p_token_hash: tokenHash,
        p_delivery_email_hash: emailHash,
        p_requested_ip_hash: ipHash,
        p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }
    );

    if (reserveError || typeof requestId !== "string") {
      if (reserveError) {
        console.error("[password-reset] Reservation failed:", reserveError.message);
      }
      await enforceMinimumResponseTime(startedAt);
      return json(GENERIC_OK);
    }

    const deliveryTask = deliverResetEmail({
      requestId,
      email,
      nombre: String(estudiante.nombre || "estudiante"),
      rawToken,
    });

    if (typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(deliveryTask);
    } else {
      await deliveryTask;
    }

    await enforceMinimumResponseTime(startedAt);
    return json(GENERIC_OK);
  } catch (error) {
    console.error("[password-reset] Unexpected error:", (error as Error).message);
    await enforceMinimumResponseTime(startedAt);
    return json(GENERIC_OK);
  }
});
