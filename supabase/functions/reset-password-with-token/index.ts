import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * reset-password-with-token
 *
 * Paso 2 de la recuperación: canjea el token del mail por un cambio de
 * contraseña efectivo.
 *
 * SEGURIDAD — leer antes de tocar:
 * - El token llega en claro y se compara contra el SHA-256 guardado.
 * - Un solo uso: se marca `used_at` en la misma operación. Un token reusado o
 *   vencido devuelve el mismo error genérico.
 * - La contraseña se aplica con admin.auth.admin.updateUserById, que pasa por
 *   Auth (hash correcto, invalidación de sesiones), en vez de escribir a mano
 *   en auth.users como hacía el flujo anterior.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

const INVALID = {
  ok: false,
  error: "El enlace no es válido o ya venció. Pedí uno nuevo desde 'Recuperar acceso'.",
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const { token, password } = await req.json().catch(() => ({}));

    const rawToken = String(token ?? "").trim();
    const newPassword = String(password ?? "");

    if (!rawToken) return json(INVALID, 400);
    if (newPassword.length < 6) {
      return json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    const tokenHash = await sha256Hex(rawToken);

    const { data: row } = await admin
      .from("password_reset_tokens")
      .select("id, user_id, estudiante_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return json(INVALID, 400);
    }

    // Se marca usado ANTES de aplicar el cambio, condicionando a que siga sin
    // usar: si dos pedidos llegan a la vez, sólo uno gana.
    const { data: claimed, error: claimError } = await admin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) return json(INVALID, 400);

    const { error: updateError } = await admin.auth.admin.updateUserById(row.user_id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("[reset-token] Error actualizando contraseña:", updateError.message);
      // Se libera el token para que el alumno pueda reintentar con el mismo mail.
      await admin.from("password_reset_tokens").update({ used_at: null }).eq("id", row.id);
      return json(
        { ok: false, error: "No pudimos actualizar la contraseña. Intentá de nuevo." },
        500
      );
    }

    // El alumno acaba de elegir su clave: ya no debe forzarse el cambio.
    await admin
      .from("estudiantes")
      .update({ must_change_password: false })
      .eq("id", row.estudiante_id);

    console.log("[reset-token] Contraseña actualizada para estudiante:", row.estudiante_id);
    return json({ ok: true });
  } catch (error) {
    console.error("[reset-token] Error:", (error as Error).message);
    return json({ ok: false, error: "Error inesperado." }, 500);
  }
});
