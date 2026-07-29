import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = "https://pps-psico.github.io";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
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
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });

type MoodleProfile = {
  firstname?: unknown;
  lastname?: unknown;
  username?: unknown;
};
type CampusEntryReason =
  | "not_registered"
  | "no_account"
  | "manual_login"
  | "lookup_error"
  | "invalid_profile"
  | "server_error";

type CampusEntryResult = {
  matched?: boolean;
  reason: CampusEntryReason | "matched_strict";
  token_hash?: string;
};

type StudentMatch = {
  id: string;
  user_id: string | null;
  role: string | null;
  correo: string | null;
  nombre_separado: string | null;
  apellido_separado: string | null;
};

const normalizeName = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeEmail = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeDni = (value: unknown): string => String(value ?? "").replace(/\D/g, "");

const isValidProfile = (email: string, dni: string, firstname: string, lastname: string): boolean =>
  email.length <= 320 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
  /^\d{6,9}$/.test(dni) &&
  firstname.length >= 2 &&
  firstname.length <= 120 &&
  lastname.length >= 2 &&
  lastname.length <= 120;

/**
 * FilterCodes no constituye identidad firmada. Para reducir el riesgo sin
 * perder la entrada automática, solo aceptamos una coincidencia estricta de
 * correo, DNI, nombre y apellido contra una única fila ya vinculada. Nunca se
 * crean usuarios, se reparan vínculos ni se habilitan roles privilegiados.
 */
const resolveCampusEntry = async (
  email: string,
  profile: MoodleProfile
): Promise<CampusEntryResult> => {
  const dni = normalizeDni(profile.username);
  const firstname = normalizeName(profile.firstname);
  const lastname = normalizeName(profile.lastname);

  if (!isValidProfile(email, dni, firstname, lastname)) {
    return { reason: "invalid_profile" };
  }
  const selection = "id, user_id, role, correo, nombre_separado, apellido_separado";
  const [byEmail, byDni] = await Promise.all([
    admin.from("estudiantes").select(selection).ilike("correo", email).limit(2),
    admin.from("estudiantes").select(selection).eq("dni", Number(dni)).limit(2),
  ]);

  if (byEmail.error || byDni.error) {
    console.error("[moodle-autologin] Strict student lookup failed");
    return { reason: "lookup_error" };
  }

  const emailMatches = (byEmail.data ?? []) as StudentMatch[];
  const dniMatches = (byDni.data ?? []) as StudentMatch[];

  if (emailMatches.length === 0 && dniMatches.length === 0) {
    return { reason: "not_registered" };
  }

  // Cualquier ambigüedad o cruce entre dos filas distintas requiere contraseña.
  if (
    emailMatches.length !== 1 ||
    dniMatches.length !== 1 ||
    emailMatches[0].id !== dniMatches[0].id
  ) {
    return { reason: "manual_login" };
  }

  const student = emailMatches[0];
  const identityMatches =
    normalizeEmail(student.correo) === email &&
    normalizeName(student.nombre_separado) === firstname &&
    normalizeName(student.apellido_separado) === lastname;

  if (!identityMatches) return { reason: "manual_login" };
  if (!student.user_id) return { reason: "no_account" };

  // NULL es el valor histórico de algunos alumnos; cualquier rol explícito que
  // no sea Alumno queda fuera para impedir autologin de cuentas privilegiadas.
  if (student.role && student.role !== "Alumno") {
    console.warn("[moodle-autologin] Privileged/non-student role rejected");
    return { reason: "manual_login" };
  }

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(student.user_id);
  const authUser = authData?.user;
  const authEmail = normalizeEmail(authUser?.email);

  if (authError || !authUser || !authUser.email_confirmed_at || authEmail !== email) {
    console.warn("[moodle-autologin] Linked Auth account is not eligible");
    return { reason: "manual_login" };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail,
  });
  const tokenHash = linkData?.properties?.hashed_token;

  if (linkError || !tokenHash) {
    console.error("[moodle-autologin] One-time session issuance failed");
    return { reason: "manual_login" };
  }

  console.log("[moodle-autologin] Strict student autologin issued");
  return { matched: true, reason: "matched_strict", token_hash: tokenHash };
};
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: isAllowedOrigin(origin) ? 204 : 403,
      headers: responseHeaders(origin),
    });
  }

  if (!isAllowedOrigin(origin)) {
    return json(origin, { reason: "manual_login" } satisfies CampusEntryResult, 403);
  }

  if (req.method !== "POST") {
    return json(origin, { error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail((body as { email?: unknown }).email);
    const rawProfile = (body as { profile?: unknown }).profile;
    const profile =
      rawProfile && typeof rawProfile === "object" ? (rawProfile as MoodleProfile) : {};

    return json(origin, await resolveCampusEntry(email, profile));
  } catch (error) {
    console.error("[moodle-autologin] Unexpected error:", (error as Error).message);
    return json(origin, { reason: "server_error" } satisfies CampusEntryResult, 500);
  }
});
