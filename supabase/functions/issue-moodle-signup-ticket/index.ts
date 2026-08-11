import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MOODLE_ORIGIN = "https://campus.uflo.edu.ar";
const PPS_COURSE_ID = 3615;
const TICKET_TTL_MS = 5 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const responseHeaders = (allowed: boolean) => ({
  ...(allowed ? { "Access-Control-Allow-Origin": MOODLE_ORIGIN } : {}),
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
});

const json = (allowed: boolean, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(allowed) });

const normalizeText = (value: unknown, maxLength: number): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeEmail = (value: unknown): string => normalizeText(value, 320).toLowerCase();
const normalizeDigits = (value: unknown, maxLength: number): string =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, maxLength);

const isResolved = (value: string): boolean => value.length > 0 && !/[{}]/.test(value);

const randomHex = (size: number): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "") ?? "";
  const allowed = origin === MOODLE_ORIGIN;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: allowed ? 204 : 403, headers: responseHeaders(allowed) });
  }
  if (!allowed) return json(false, { error: "Moodle PPS origin required" }, 403);
  if (req.method !== "POST") return json(true, { error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId = Number(body.courseId);
    const moodleUserId = Number(body.moodleUserId);
    const moodleUsername = normalizeDigits(body.moodleUsername, 12);
    const email = normalizeEmail(body.email);
    const firstname = normalizeText(body.firstname, 120);
    const lastname = normalizeText(body.lastname, 120);

    const valid =
      courseId === PPS_COURSE_ID &&
      Number.isSafeInteger(moodleUserId) &&
      moodleUserId > 0 &&
      /^\d{6,12}$/.test(moodleUsername) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      firstname.length >= 2 &&
      lastname.length >= 2 &&
      isResolved(email) &&
      isResolved(firstname) &&
      isResolved(lastname);

    if (!valid) return json(true, { error: "Invalid Moodle PPS context" }, 400);

    const signupTicket = randomHex(32);
    const tokenHash = await sha256Hex(signupTicket);
    const expiresAt = new Date(Date.now() + TICKET_TTL_MS).toISOString();

    const { error } = await admin.from("moodle_signup_tickets").insert({
      token_hash: tokenHash,
      course_id: courseId,
      moodle_user_id: moodleUserId,
      moodle_username: moodleUsername,
      email,
      firstname,
      lastname,
      expires_at: expiresAt,
    });

    if (error) {
      console.error("[issue-moodle-signup-ticket] Ticket insert failed", error.message);
      return json(true, { error: "Ticket issuance failed" }, 500);
    }

    // Opportunistic cleanup. It is intentionally best-effort and never blocks
    // issuance of the current ticket.
    if (crypto.getRandomValues(new Uint8Array(1))[0] < 8) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupError } = await admin
        .from("moodle_signup_tickets")
        .delete()
        .lt("expires_at", cutoff);
      if (cleanupError) console.error("[issue-moodle-signup-ticket] Cleanup failed");
    }

    return json(true, { ok: true, signupTicket, expiresAt });
  } catch (error) {
    console.error("[issue-moodle-signup-ticket] Unexpected error", (error as Error).message);
    return json(true, { error: "Ticket issuance failed" }, 500);
  }
});
