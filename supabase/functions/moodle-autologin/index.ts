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

type MoodleProfile = Record<string, unknown> | null;

type AutologinResult = {
  matched: boolean;
  reason?: string;
  token_hash?: string;
  /** Email de la cuenta real del panel (puede diferir del email de Moodle
   *  cuando el match fue por DNI y el alumno se registró con correo personal). */
  account_email?: string;
};

const clip = (v: unknown) =>
  String(v ?? "")
    .trim()
    .slice(0, 120) || null;

/**
 * SONDA (temporal): guarda en `moodle_probe` los campos de perfil que inyectó
 * Moodle (FilterCodes) en esta entrada, cruzados contra `estudiantes`:
 *  - ¿username coincide con un DNI? (confirmado: username de UFLO = DNI)
 *  - ¿idnumber coincide con un legajo? (hasta ahora viene vacío)
 *  - ¿email existe en `correo`?
 * Nunca debe romper el auto-login: todo va en try/catch.
 */
const recordProbe = async (
  email: string,
  profile: MoodleProfile,
  autologinResult: string
): Promise<void> => {
  try {
    const p = profile ?? {};
    const username = clip(p.username);
    const idnumber = clip(p.idnumber);

    let emailMatch = false;
    let usernameDniMatch = false;
    let idnumberLegajoMatch = false;

    if (email) {
      const { count } = await admin
        .from("estudiantes")
        .select("id", { count: "exact", head: true })
        .ilike("correo", email);
      emailMatch = (count ?? 0) > 0;
    }

    const usernameDigits = username?.replace(/\D/g, "") ?? "";
    if (usernameDigits.length >= 6) {
      const { count } = await admin
        .from("estudiantes")
        .select("id", { count: "exact", head: true })
        .eq("dni", Number(usernameDigits));
      usernameDniMatch = (count ?? 0) > 0;
    }

    if (idnumber) {
      const { count } = await admin
        .from("estudiantes")
        .select("id", { count: "exact", head: true })
        .eq("legajo", idnumber);
      idnumberLegajoMatch = (count ?? 0) > 0;
    }

    const { error } = await admin.from("moodle_probe").insert({
      email: email || null,
      firstname: clip(p.firstname),
      lastname: clip(p.lastname),
      idnumber,
      username,
      phone1: clip(p.phone1),
      phone2: clip(p.phone2),
      email_match: emailMatch,
      username_dni_match: usernameDniMatch,
      idnumber_legajo_match: idnumberLegajoMatch,
      autologin_result: autologinResult,
    });
    if (error) console.error("[moodle-autologin][probe] insert error:", error.message);
  } catch (e) {
    console.error("[moodle-autologin][probe] error:", (e as Error).message);
  }
};

/**
 * Resuelve el auto-login para un email + perfil de Moodle.
 *
 * Orden de match contra `estudiantes` (el DNI es el identificador robusto:
 * no depende de qué correo puso el alumno al registrarse ni del dominio
 * doble @uflo.edu.ar / @uflouniversidad.edu.ar):
 *  1. por correo (histórico, exacto case-insensitive)
 *  2. por DNI = username de Moodle (confirmado por la sonda)
 *
 * Razones cuando no hay login:
 *  - not_registered:      no hay fila en estudiantes → candidato a alta.
 *  - no_account:          hay fila pero nunca creó cuenta → alta con vinculación.
 *  - auth_user_not_found: fila con user_id que no existe en Auth (integridad).
 */
const resolveAutologin = async (
  email: string,
  profile: MoodleProfile
): Promise<AutologinResult> => {
  // 1. Match por correo.
  let matchedBy = "email";
  let { data: estudiante, error: lookupError } = await admin
    .from("estudiantes")
    .select("id, correo, user_id")
    .ilike("correo", email)
    .maybeSingle();

  if (lookupError) {
    console.error("[moodle-autologin] Error buscando estudiante:", lookupError.message);
    return { matched: false, reason: "lookup_error" };
  }

  // 2. Fallback: match por DNI (username de Moodle).
  if (!estudiante) {
    const usernameDigits = String((profile ?? {}).username ?? "").replace(/\D/g, "");
    if (usernameDigits.length >= 6) {
      const { data: byDni, error: dniError } = await admin
        .from("estudiantes")
        .select("id, correo, user_id")
        .eq("dni", Number(usernameDigits))
        .maybeSingle();
      if (dniError) {
        console.error("[moodle-autologin] Error buscando por DNI:", dniError.message);
      } else if (byDni) {
        estudiante = byDni;
        matchedBy = "dni";
      }
    }
  }

  if (!estudiante) {
    console.log("[moodle-autologin] Sin match en estudiantes para:", email);
    return { matched: false, reason: "not_registered" };
  }

  // 3. Resolver el usuario de Auth de esa fila.
  let authUser: { id: string; email?: string } | null = null;

  if (estudiante.user_id) {
    const { data: byId, error: byIdError } = await admin.auth.admin.getUserById(estudiante.user_id);
    if (byIdError) {
      console.error("[moodle-autologin] Error getUserById:", byIdError.message);
    } else if (byId?.user) {
      authUser = byId.user;
    }
  }

  // Cuentas viejas sin user_id vinculado: scan paginado por el email de la URL
  // (supabase-js no tiene getUserByEmail).
  if (!authUser) {
    const perPage = 1000;
    for (let page = 1; page <= 20 && !authUser; page++) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) {
        console.error("[moodle-autologin] Error listando usuarios de Auth:", listError.message);
        break;
      }
      const found = list.users.find((u) => u.email?.toLowerCase() === email);
      if (found) authUser = found;
      if (list.users.length < perPage) break; // última página
    }
  }

  if (!authUser?.email) {
    console.log(
      `[moodle-autologin] Estudiante matcheado por ${matchedBy} pero sin cuenta en Auth:`,
      email
    );
    return {
      matched: false,
      reason: estudiante.user_id ? "auth_user_not_found" : "no_account",
    };
  }

  // 4. Sanear el vínculo user_id si quedó desactualizado.
  if (estudiante.user_id !== authUser.id) {
    console.log(
      `[moodle-autologin] Sincronizando user_id de ${email} de ${estudiante.user_id} a ${authUser.id}`
    );
    const { error: updateError } = await admin
      .from("estudiantes")
      .update({ user_id: authUser.id })
      .eq("id", estudiante.id);

    if (updateError) {
      console.error("[moodle-autologin] Error actualizando user_id:", updateError.message);
    }
  }

  // 5. Magic link interno para el email de la CUENTA (no el de la URL: con
  // match por DNI pueden diferir). La app lo canjea con verifyOtp.
  const accountEmail = authUser.email.toLowerCase();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: accountEmail,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error(
      "[moodle-autologin] Error generando link:",
      linkError?.message ?? "sin hashed_token"
    );
    return { matched: false, reason: "link_error" };
  }

  console.log(`[moodle-autologin] Auto-login emitido para: ${email} (match: ${matchedBy})`);
  return {
    matched: true,
    reason: `matched_${matchedBy}`,
    token_hash: linkData.properties.hashed_token,
    account_email: accountEmail,
  };
};

/**
 * moodle-autologin
 *
 * Recibe el email + perfil (firstname/lastname/username=DNI/...) que el campus
 * Moodle inyecta en el iframe vía FilterCodes. Si corresponde a un estudiante
 * registrado (por correo o por DNI), devuelve un `token_hash` de magic link que
 * la app canjea con `verifyOtp` para iniciar sesión sin que el alumno escriba
 * nada. Si no, devuelve la razón para que la app decida (login normal o alta).
 *
 * SEGURIDAD — leer antes de tocar:
 * - El email/perfil que llega NO está criptográficamente verificado (viaja por
 *   la URL). La protección real es del lado del cliente: la app solo llama a
 *   esta función cuando corre embebida en un iframe del campus. Eso bloquea el
 *   caso casual de copiar la URL con los datos de otra persona.
 * - Esto NO sustituye a un SSO/LTI real. Si algún día se habilita LTI (requiere
 *   admin de Moodle), migrar a identidad firmada y retirar este atajo.
 * - Solo se emite token para estudiantes que ya existen. Nunca se crean
 *   usuarios desde acá (el alta va por register_campus_student, autenticado).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { email: rawEmail, profile } = await req
      .json()
      .catch(() => ({ email: "", profile: null }));
    const email = String(rawEmail ?? "")
      .trim()
      .toLowerCase();

    // Validación mínima de formato.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ matched: false, reason: "invalid_email" });
    }

    const result = await resolveAutologin(email, (profile ?? null) as MoodleProfile);

    // SONDA: registrar la entrada con el resultado real.
    await recordProbe(
      email,
      (profile ?? null) as MoodleProfile,
      result.reason ?? (result.matched ? "matched" : "unknown")
    );

    return json(result);
  } catch (error) {
    console.error("[moodle-autologin] Error global:", (error as Error).message);
    return json({ matched: false, reason: "server_error" }, 500);
  }
});
