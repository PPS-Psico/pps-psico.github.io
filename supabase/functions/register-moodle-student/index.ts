import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = "https://pps-psico.github.io";
const PPS_COURSE_ID = 3615;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const isAllowedOrigin = (origin: string): boolean => {
  if (origin === APP_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
};

const responseHeaders = (origin: string) => ({
  ...(isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
});

const json = (origin: string, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

type SignupTicket = {
  id: string;
  course_id: number;
  moodle_username: string;
  email: string;
  expires_at: string;
  used_at: string | null;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: isAllowedOrigin(origin) ? 204 : 403,
      headers: responseHeaders(origin),
    });
  }
  if (!isAllowedOrigin(origin)) return json(origin, { code: "forbidden" }, 403);
  if (req.method !== "POST") return json(origin, { code: "method_not_allowed" }, 405);

  let createdUserId: string | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const signupTicket = String(body.signupTicket ?? "")
      .trim()
      .toLowerCase();
    const legajo = String(body.legajo ?? "").replace(/\D/g, "");
    const dni = String(body.dni ?? "").replace(/\D/g, "");
    const telefono = String(body.telefono ?? "")
      .trim()
      .slice(0, 80);
    const password = String(body.password ?? "");

    if (
      !/^[0-9a-f]{64}$/.test(signupTicket) ||
      !/^\d{4,8}$/.test(legajo) ||
      !/^\d{6,9}$/.test(dni) ||
      telefono.length === 0 ||
      password.length < 10 ||
      password.length > 128
    ) {
      return json(
        origin,
        { code: "invalid_signup_data", message: "Revisá los datos ingresados." },
        400
      );
    }

    const tokenHash = await sha256Hex(signupTicket);
    const { data: ticketData, error: ticketError } = await admin
      .from("moodle_signup_tickets")
      .select("id, course_id, moodle_username, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    const ticket = ticketData as SignupTicket | null;

    if (
      ticketError ||
      !ticket ||
      ticket.course_id !== PPS_COURSE_ID ||
      ticket.used_at !== null ||
      new Date(ticket.expires_at).getTime() <= Date.now() ||
      ticket.moodle_username !== dni
    ) {
      return json(origin, { code: "invalid_or_expired_ticket" }, 403);
    }

    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email: ticket.email,
      password,
      email_confirm: true,
      user_metadata: {
        legajo,
        signup_source: "moodle_course_3615",
      },
    });

    if (createError || !authData.user) {
      const authMessage = createError?.message.toLowerCase() ?? "";
      if (
        authMessage.includes("already") ||
        authMessage.includes("exists") ||
        authMessage.includes("registered")
      ) {
        return json(origin, { code: "already_registered" }, 409);
      }
      if (authMessage.includes("rate") || authMessage.includes("seconds")) {
        return json(origin, { code: "rate_limited" }, 429);
      }
      console.error("[register-moodle-student] Auth creation failed", createError?.message);
      return json(origin, { code: "signup_failed", message: "No pudimos crear la cuenta." }, 400);
    }

    createdUserId = authData.user.id;
    const { error: linkError } = await admin.rpc("complete_moodle_student_signup", {
      token_hash_input: tokenHash,
      userid_input: createdUserId,
      legajo_input: legajo,
      dni_input: Number(dni),
      telefono_input: telefono,
    });

    if (linkError) {
      console.error("[register-moodle-student] Student link failed", linkError.message);
      await admin.auth.admin.deleteUser(createdUserId);
      createdUserId = null;

      if (/ticket|expired/i.test(linkError.message)) {
        return json(origin, { code: "invalid_or_expired_ticket" }, 403);
      }
      return json(
        origin,
        {
          code: "academic_record_mismatch",
          message: "Los datos no coinciden con el registro académico.",
        },
        409
      );
    }

    return json(origin, { ok: true });
  } catch (error) {
    console.error("[register-moodle-student] Unexpected error", (error as Error).message);
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    return json(origin, { code: "server_error", message: "No pudimos completar el alta." }, 500);
  }
});
