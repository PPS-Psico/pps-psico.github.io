import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type MoodleProfile = {
  username?: unknown;
};

type CampusEntryReason =
  | "not_registered"
  | "no_account"
  | "manual_login"
  | "lookup_error"
  | "invalid_email"
  | "server_error";

type CampusEntryResult = {
  reason: CampusEntryReason;
};

/**
 * Resuelve únicamente qué pantalla debe mostrarse al entrar desde Moodle.
 *
 * Los parámetros FilterCodes no están firmados. Por eso esta función nunca:
 * - genera ni devuelve magic-links, OTP o sesiones;
 * - modifica user_id ni ninguna fila;
 * - devuelve datos personales del estudiante.
 *
 * `not_registered` y `no_account` habilitan el alta guiada. Una fila ya
 * vinculada devuelve `manual_login` y el estudiante inicia sesión normalmente.
 */
const resolveCampusEntry = async (
  email: string,
  profile: MoodleProfile
): Promise<CampusEntryResult> => {
  const byEmail = await admin
    .from("estudiantes")
    .select("user_id")
    .ilike("correo", email)
    .limit(1)
    .maybeSingle();

  if (byEmail.error) {
    console.error("[moodle-entry] Student lookup failed");
    return { reason: "lookup_error" };
  }

  let student = byEmail.data;

  if (!student) {
    const dni = String(profile.username ?? "").replace(/\D/g, "");
    if (dni.length >= 6 && dni.length <= 9) {
      const byDni = await admin
        .from("estudiantes")
        .select("user_id")
        .eq("dni", Number(dni))
        .limit(1)
        .maybeSingle();

      if (byDni.error) {
        console.error("[moodle-entry] Student lookup by DNI failed");
        return { reason: "lookup_error" };
      }
      student = byDni.data;
    }
  }

  if (!student) return { reason: "not_registered" };
  if (!student.user_id) return { reason: "no_account" };
  return { reason: "manual_login" };
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
    const email = String((body as { email?: unknown }).email ?? "")
      .trim()
      .toLowerCase();
    const rawProfile = (body as { profile?: unknown }).profile;
    const profile =
      rawProfile && typeof rawProfile === "object" ? (rawProfile as MoodleProfile) : {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ reason: "invalid_email" } satisfies CampusEntryResult);
    }

    return json(await resolveCampusEntry(email, profile));
  } catch (error) {
    console.error("[moodle-entry] Unexpected error:", (error as Error).message);
    return json({ reason: "server_error" } satisfies CampusEntryResult, 500);
  }
});
