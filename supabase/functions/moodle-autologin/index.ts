import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -- CONFIGURATION --
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * moodle-autologin
 *
 * Recibe el email que el campus Moodle inyecta en el iframe (vía FilterCodes).
 * Si ese email corresponde a un estudiante registrado, devuelve un `token_hash`
 * de magic link que la app canjea con `verifyOtp` para iniciar sesión sin que el
 * alumno escriba nada.
 *
 * SEGURIDAD — leer antes de tocar:
 * - El email que llega NO está criptográficamente verificado (viaja por la URL).
 *   La protección real es del lado del cliente: la app solo llama a esta función
 *   cuando corre embebida en un iframe, y la CSP `frame-ancestors` de nginx solo
 *   permite que el campus la embeba. Eso bloquea el caso casual de copiar la URL
 *   con el email de otra persona en una pestaña nueva.
 * - Esto NO sustituye a un SSO/LTI real. Si algún día se habilita LTI (requiere
 *   admin de Moodle), migrar a identidad firmada y retirar este atajo.
 * - Solo se emite token para emails que ya existen como estudiante. Nunca se
 *   crean usuarios desde acá.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { email: rawEmail } = await req.json().catch(() => ({ email: "" }));
    const email = String(rawEmail ?? "")
      .trim()
      .toLowerCase();

    // Validación mínima de formato.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ matched: false, reason: "invalid_email" });
    }

    // 1. ¿Es un estudiante registrado? (match exacto, case-insensitive)
    const { data: estudiante, error: lookupError } = await admin
      .from("estudiantes")
      .select("id, correo, user_id")
      .ilike("correo", email)
      .maybeSingle();

    if (lookupError) {
      console.error("[moodle-autologin] Error buscando estudiante:", lookupError.message);
      return json({ matched: false, reason: "lookup_error" });
    }

    // No está registrado, o nunca creó su cuenta (sin user_id vinculado).
    if (!estudiante || !estudiante.user_id) {
      console.log("[moodle-autologin] Sin match para:", email);
      return json({ matched: false, reason: "not_registered" });
    }

    // 2. Generar magic link interno (no se envía por correo; lo canjea la app).
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error(
        "[moodle-autologin] Error generando link:",
        linkError?.message ?? "sin hashed_token"
      );
      return json({ matched: false, reason: "link_error" });
    }

    console.log("[moodle-autologin] Auto-login emitido para:", email);
    return json({
      matched: true,
      token_hash: linkData.properties.hashed_token,
    });
  } catch (error) {
    console.error("[moodle-autologin] Error global:", (error as Error).message);
    return json({ matched: false, reason: "server_error" }, 500);
  }
});
