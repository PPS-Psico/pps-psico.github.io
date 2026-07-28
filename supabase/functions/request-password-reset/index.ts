import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTransport } from "npm:nodemailer";

/**
 * request-password-reset
 *
 * Paso 1 de la recuperación: el alumno ingresa su legajo y, si existe, recibe
 * un enlace de un solo uso en el correo que tiene registrado.
 *
 * SEGURIDAD — leer antes de tocar:
 * - Responde SIEMPRE lo mismo, exista o no el legajo. Si distinguiera, sería un
 *   oráculo para enumerar quién está registrado.
 * - El token se genera acá (32 bytes de crypto.getRandomValues) y en base se
 *   guarda sólo su SHA-256. La versión en claro existe únicamente dentro del
 *   mail.
 * - Vence en 1 hora y es de un solo uso.
 * - Usa el SMTP propio (Gmail) que ya funciona en send-email, no el mailer de
 *   Supabase, que en este proyecto está limitado a 2 correos por hora.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") || "https://pps-psico.github.io").replace(/\/$/, "");

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

/** Respuesta única: nunca revela si el legajo existe. */
const GENERIC_OK = {
  ok: true,
  message: "Si el legajo está registrado, enviamos un enlace al correo asociado.",
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const maskEmail = (email: string): string => {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const shown = user.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
};

const buildHtml = (nombre: string, link: string): string => `
  <div style="font-family: -apple-system, Segoe UI, sans-serif; padding: 24px; color: #1a1a1a;">
    <h2 style="margin: 0 0 12px;">Recuperar tu contraseña</h2>
    <p style="font-size: 15px; line-height: 1.6;">
      Hola ${nombre || ""}, recibimos un pedido para restablecer la contraseña de tu panel de PPS.
    </p>
    <p style="margin: 24px 0;">
      <a href="${link}"
         style="background: #1a1a1a; color: #fff; padding: 12px 20px; border-radius: 8px;
                text-decoration: none; font-weight: 600; display: inline-block;">
        Elegir nueva contraseña
      </a>
    </p>
    <p style="font-size: 13px; color: #666; line-height: 1.6;">
      El enlace vence en 1 hora y se puede usar una sola vez.<br />
      Si no pediste esto, ignorá el mensaje: tu contraseña sigue igual.
    </p>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="font-size: 12px; color: #888;">Mensaje automático del sistema de gestión de PPS.</p>
  </div>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { legajo } = await req.json().catch(() => ({ legajo: "" }));
    const legajoClean = String(legajo ?? "").trim();

    if (!legajoClean) return json(GENERIC_OK);

    const callerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // Buscar al estudiante. Cualquier fallo desde acá devuelve GENERIC_OK.
    const { data: estudiante } = await admin
      .from("estudiantes")
      .select("id, nombre, correo, user_id")
      .eq("legajo", legajoClean)
      .maybeSingle();

    if (!estudiante?.correo || !estudiante.user_id) {
      console.log("[reset] Sin destino para legajo:", legajoClean);
      return json(GENERIC_OK);
    }

    // Tope de pedidos por estudiante: evita usar la función como ametralladora
    // de correos hacia la casilla de un tercero.
    const { count } = await admin
      .from("password_reset_tokens")
      .select("id", { count: "exact", head: true })
      .eq("estudiante_id", estudiante.id)
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if ((count ?? 0) >= 3) {
      console.log("[reset] Rate limit alcanzado para legajo:", legajoClean);
      return json(GENERIC_OK);
    }

    // Token en claro sólo vive en el mail; en base va el hash.
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const tokenHash = await sha256Hex(raw);

    const { error: insertError } = await admin.from("password_reset_tokens").insert({
      estudiante_id: estudiante.id,
      user_id: estudiante.user_id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      requested_ip: callerIp,
    });

    if (insertError) {
      console.error("[reset] Error guardando token:", insertError.message);
      return json(GENERIC_OK);
    }

    const SMTP_EMAIL = Deno.env.get("SMTP_EMAIL");
    const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
    if (!SMTP_EMAIL || !SMTP_PASSWORD) {
      console.error("[reset] Faltan credenciales SMTP");
      return json(GENERIC_OK);
    }

    const link = `${APP_URL}/#/login?reset_token=${raw}`;

    const transporter = createTransport({
      service: "gmail",
      auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"Mi Panel Académico" <${SMTP_EMAIL}>`,
      to: estudiante.correo,
      subject: "Recuperar tu contraseña · Panel de PPS",
      text:
        `Hola ${estudiante.nombre || ""}, para elegir una nueva contraseña entrá a este enlace:\n\n` +
        `${link}\n\nVence en 1 hora y se usa una sola vez. Si no lo pediste, ignorá el mensaje.`,
      html: buildHtml(estudiante.nombre ?? "", link),
    });

    console.log("[reset] Enlace enviado a:", maskEmail(estudiante.correo));
    return json(GENERIC_OK);
  } catch (error) {
    // Incluso ante un error inesperado se responde igual, para no filtrar nada.
    console.error("[reset] Error:", (error as Error).message);
    return json(GENERIC_OK);
  }
});
