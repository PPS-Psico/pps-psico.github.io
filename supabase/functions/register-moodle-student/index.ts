import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/hash.ts";

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

type SignupTicket = {
  id: string;
  course_id: number;
  moodle_username: string;
  email: string;
  expires_at: string;
  used_at: string | null;
};

/**
 * Traducción de cada excepción del RPC a un código estable y a un texto que le
 * dice al alumno qué hacer. Antes todo lo que no mencionara "ticket" caía en
 * `academic_record_mismatch`: "ese legajo ya tiene cuenta" y "los datos no
 * coinciden" llegaban con el mismo cartel, y distinguirlos exigía leer los logs
 * de la función. El orden importa — se aplica la primera coincidencia.
 */
const SIGNUP_FAILURES: ReadonlyArray<{
  match: RegExp;
  code: string;
  status: number;
  message: string;
}> = [
  {
    match: /ticket|expired|consumed/i,
    code: "invalid_or_expired_ticket",
    status: 403,
    message: "La autorización del Aula PPS venció. Recargá el aula y volvé a intentarlo.",
  },
  {
    match: /legajo already has an account/i,
    code: "legajo_already_registered",
    status: 409,
    message: "Ese legajo ya tiene una cuenta. Iniciá sesión o usá Recuperar acceso.",
  },
  {
    match: /student account already linked/i,
    code: "account_already_linked",
    status: 409,
    message: "Tu usuario del campus ya está vinculado a otro legajo. Escribinos para revisarlo.",
  },
  {
    match: /identity already exists/i,
    code: "duplicate_identity",
    status: 409,
    message:
      "Ya existe una ficha con tu DNI o correo bajo otro legajo. Escribinos para unificarla.",
  },
  {
    match: /signup identity/i,
    code: "identity_mismatch",
    status: 403,
    message:
      "El correo de tu cuenta no coincide con el del Aula PPS. Volvé a entrar desde el aula.",
  },
  {
    match: /signup data/i,
    code: "invalid_signup_data",
    status: 400,
    message: "Revisá los datos: el legajo y el teléfono no pueden quedar vacíos.",
  },
  {
    match: /could not be linked/i,
    code: "link_conflict",
    status: 409,
    message: "Otro intento de alta se adelantó. Esperá unos segundos y probá de nuevo.",
  },
];

const FALLBACK_FAILURE = {
  code: "signup_failed",
  status: 400,
  message: "No pudimos completar el alta. Volvé a intentarlo en unos minutos.",
};

const resolveSignupFailure = (rpcMessage: string) =>
  SIGNUP_FAILURES.find((failure) => failure.match.test(rpcMessage)) ?? FALLBACK_FAILURE;

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
      const failure = resolveSignupFailure(linkError.message);
      // El mensaje crudo del RPC sólo va al log: es lo que permite reconstruir
      // un caso concreto sin tener que reproducirlo con la alumna en línea.
      console.error(
        `[register-moodle-student] Student link failed (legajo=${legajo}, code=${failure.code}): ${linkError.message}`
      );
      await admin.auth.admin.deleteUser(createdUserId);
      createdUserId = null;

      return json(origin, { code: failure.code, message: failure.message }, failure.status);
    }

    return json(origin, { ok: true });
  } catch (error) {
    console.error("[register-moodle-student] Unexpected error", (error as Error).message);
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    return json(origin, { code: "server_error", message: "No pudimos completar el alta." }, 500);
  }
});
