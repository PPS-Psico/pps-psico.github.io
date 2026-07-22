import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createTransport } from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SMTP_EMAIL = Deno.env.get("SMTP_EMAIL");
    const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");

    if (!SMTP_EMAIL || !SMTP_PASSWORD) {
      throw new Error(
        "Faltan las credenciales SMTP (SMTP_EMAIL o SMTP_PASSWORD) en las variables de entorno."
      );
    }

    const { to, cc, subject, text, name, html } = await req.json();

    if (!to || !subject) {
      throw new Error("Faltan campos obligatorios (to, subject).");
    }

    const transporter = createTransport({
      service: "gmail",
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASSWORD,
      },
    });

    const htmlContent =
      html ||
      `<div style="font-family: sans-serif; padding: 20px;">
        <h2>Hola ${name || ""},</h2>
        <p style="white-space: pre-line; font-size: 16px; color: #333;">${text}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">Este es un mensaje automático del sistema de gestión de PPS.</p>
      </div>`;

    const info = await transporter.sendMail({
      from: `"Mi Panel Académico" <${SMTP_EMAIL}>`,
      to,
      cc: cc || undefined,
      subject,
      text,
      html: htmlContent,
    });

    console.log("Email enviado exitosamente: %s", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error enviando email:", error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
