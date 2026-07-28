import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const publicAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  error: "Legajo o contraseña incorrectos.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const legajo = String((body as { legajo?: unknown }).legajo ?? "").trim();
    const password = String((body as { password?: unknown }).password ?? "");

    if (!/^[a-zA-Z0-9._-]{1,32}$/.test(legajo) || !password || password.length > 256) {
      return json(INVALID, 401);
    }

    const { data: estudiante } = await admin
      .from("estudiantes")
      .select("user_id")
      .eq("legajo", legajo)
      .maybeSingle();

    let email = "";
    if (estudiante?.user_id) {
      const { data: authData } = await admin.auth.admin.getUserById(estudiante.user_id);
      if (authData?.user?.email_confirmed_at) {
        email = authData.user.email?.trim().toLowerCase() ?? "";
      }
    }

    // También consultamos Auth para legajos inexistentes. Así no queda un
    // atajo de tiempo evidente que permita enumerar quién tiene cuenta.
    const authEmail = email || `invalid-${crypto.randomUUID()}@invalid.local`;
    const { data: signInData, error: signInError } = await publicAuth.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInError || !email || !signInData.session) {
      return json(INVALID, 401);
    }

    return json({
      ok: true,
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
    });
  } catch (error) {
    console.error("[student-login] Unexpected error:", (error as Error).message);
    return json({ ok: false, error: "No pudimos iniciar sesión en este momento." }, 503);
  }
});
