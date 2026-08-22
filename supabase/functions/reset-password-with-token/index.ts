import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/hash.ts";

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
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });

const INVALID = {
  ok: false,
  error: "El enlace no es válido o ya venció. Pedí uno nuevo desde 'Recuperar acceso'.",
};

type ClaimedToken = {
  request_id: string;
  estudiante_id: string;
  user_id: string;
  delivery_email_hash: string;
};

const finishClaim = async (
  requestId: string,
  success: boolean,
  failureCode?: string
): Promise<boolean> => {
  const { data, error } = await admin.rpc("complete_password_reset", {
    p_request_id: requestId,
    p_success: success,
    p_failure_code: failureCode ?? null,
  });

  if (error || data !== true) {
    console.error(
      "[password-reset] Could not finalize claimed token:",
      error?.message ?? "not finalized"
    );
    return false;
  }
  return true;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawToken = String((body as { token?: unknown }).token ?? "")
      .trim()
      .toLowerCase();
    const newPassword = String((body as { password?: unknown }).password ?? "");

    if (!/^[0-9a-f]{64}$/.test(rawToken)) return json(INVALID, 400);
    if (newPassword.length < 10) {
      return json({ ok: false, error: "La contraseña debe tener al menos 10 caracteres." }, 400);
    }
    if (newPassword.length > 128) {
      return json({ ok: false, error: "La contraseña no puede superar los 128 caracteres." }, 400);
    }

    const tokenHash = await sha256Hex(rawToken);
    const { data: claimedRows, error: claimError } = await admin.rpc("claim_password_reset_token", {
      p_token_hash: tokenHash,
    });

    const claimed = Array.isArray(claimedRows)
      ? (claimedRows[0] as ClaimedToken | undefined)
      : undefined;

    if (claimError || !claimed) return json(INVALID, 400);

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(
      claimed.user_id
    );
    const authUser = authData?.user;
    const authEmail = authUser?.email?.trim().toLowerCase() ?? "";
    const currentEmailHash = authEmail ? await sha256Hex(authEmail) : "";

    if (
      authError ||
      !authEmail ||
      !authUser?.email_confirmed_at ||
      currentEmailHash !== claimed.delivery_email_hash
    ) {
      await finishClaim(claimed.request_id, false, "recovery_channel_changed");
      console.warn("[password-reset] Recovery channel changed after token issuance");
      return json(INVALID, 400);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(claimed.user_id, {
      password: newPassword,
    });

    if (updateError) {
      await finishClaim(claimed.request_id, false, "auth_password_update_failed");
      console.error("[password-reset] Auth password update failed:", updateError.message);
      return json(
        {
          ok: false,
          error: "No pudimos actualizar la contraseña. Pedí un enlace nuevo e intentá otra vez.",
        },
        500
      );
    }

    // El cambio de contraseña invalida las sesiones de refresh en Auth. Un JWT
    // de acceso ya emitido puede seguir vivo hasta su expiración configurada,
    // que es una propiedad general de las sesiones JWT de Supabase.
    const finalized = await finishClaim(claimed.request_id, true);
    if (!finalized) {
      // La contraseña ya cambió: responder error sería engañoso y llevaría al
      // alumno a repetir un proceso que sí se completó. El log permite reparar
      // must_change_password si la actualización auxiliar falló.
      console.error(
        "[password-reset] Password changed, but local completion metadata needs reconciliation"
      );
    }

    console.log("[password-reset] Password updated for student:", claimed.estudiante_id);
    return json({ ok: true });
  } catch (error) {
    console.error("[password-reset] Unexpected redemption error:", (error as Error).message);
    return json({ ok: false, error: "Error inesperado. Pedí un enlace nuevo." }, 500);
  }
});
