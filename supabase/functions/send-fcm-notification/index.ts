import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_ROLES = new Set(["admin", "SuperUser", "Jefe", "Directivo", "AdminTester"]);
// Un solo lugar para el dominio de la app, igual que en las funciones de
// consentimiento. Se apunta a la raiz y no a `/#/student` porque estas push
// tambien le llegan a admins, y la app ya redirige segun el rol.
const APP_URL = (Deno.env.get("APP_URL") || "https://pps-psico.github.io").replace(/\/$/, "");

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

interface ServiceAccount {
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

interface NotificationRequest {
  title?: unknown;
  body?: unknown;
  user_ids?: unknown;
  send_to_all?: unknown;
  type?: unknown;
  data?: unknown;
}

async function authorize(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json({ error: "Unauthorized" }, 401);

  if (SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Server authentication is not configured" }, 500);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const { data: profile, error: roleError } = await supabase
    .from("estudiantes")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError) {
    console.error("[FCM] Role validation failed:", roleError.message);
    return json({ error: "Authorization check failed" }, 500);
  }
  if (!profile?.role || !ADMIN_ROLES.has(profile.role)) {
    return json({ error: "Forbidden - Admin role required" }, 403);
  }
  return null;
}

function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_KEY");
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT_KEY not configured");
  return JSON.parse(raw) as ServiceAccount;
}

function base64Url(input: Uint8Array): string {
  return encodeBase64(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// El access token de Google vale una hora. Antes se renegociaba uno por CADA
// token FCM, o sea dos viajes de red por destinatario en vez de uno. Con el
// cache, un envio a N dispositivos hace 1 handshake + N envios.
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Margen de 60s para no usar un token que expira en pleno envio.
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60_000 > Date.now()) {
    return cachedAccessToken.value;
  }

  const serviceAccount = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(
    new TextEncoder().encode(
      JSON.stringify({ alg: "RS256", typ: "JWT", kid: serviceAccount.private_key_id })
    )
  );
  const payload = base64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: serviceAccount.token_uri,
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const privateKeyPem = serviceAccount.private_key
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(privateKeyPem), (character) => character.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`FCM token exchange failed (${response.status})`);
  const result = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error("FCM token exchange returned no access token");
  cachedAccessToken = {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
  return result.access_token;
}

async function sendToToken(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ success: boolean; error?: string; invalidToken?: boolean }> {
  try {
    const serviceAccount = getServiceAccount();
    const accessToken = await getAccessToken();
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token,
            data: {
              content_title: title,
              content_body: body,
              content_type: data.type || "message",
              title,
              body,
              url: APP_URL + "/",
              ...data,
            },
            webpush: { fcm_options: { link: APP_URL + "/" } },
          },
        }),
      }
    );
    if (!response.ok) {
      // 404 (UNREGISTERED en FCM v1) y 410 significan que ese dispositivo ya no
      // existe: el navegador se desinstalo, se limpio el storage o se revoco el
      // permiso. Sin borrarlos, la tabla `fcm_tokens` crece para siempre y cada
      // envio los reintenta uno por uno.
      const isGone = response.status === 404 || response.status === 410;
      return {
        success: false,
        error: `FCM responded ${response.status}`,
        invalidToken: isGone,
      };
    }
    return { success: true };
  } catch (error) {
    console.error("[FCM] Send failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorizationError = await authorize(req);
  if (authorizationError) return authorizationError;

  let request: NotificationRequest;
  try {
    request = (await req.json()) as NotificationRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const title = typeof request.title === "string" ? request.title.trim() : "";
  const messageBody = typeof request.body === "string" ? request.body.trim() : "";
  if (!title || !messageBody) return json({ error: "Title and body are required" }, 400);

  const sendToAll = request.send_to_all === true;
  const userIds = Array.isArray(request.user_ids)
    ? request.user_ids.filter((value): value is string => typeof value === "string")
    : [];
  if (!sendToAll && userIds.length === 0) {
    return json({ error: "Either user_ids or send_to_all must be specified" }, 400);
  }

  try {
    let tokens: string[] = [];
    if (sendToAll) {
      const { data, error } = await supabase.rpc("get_all_fcm_tokens");
      if (error) throw error;
      tokens = (data ?? [])
        .map((row: { fcm_token?: unknown }) => row.fcm_token)
        .filter((value: unknown): value is string => typeof value === "string");
    } else {
      const { data, error } = await supabase
        .from("fcm_tokens")
        .select("fcm_token")
        .in("user_id", userIds);
      if (error) throw error;
      tokens = (data ?? [])
        .map((row: { fcm_token?: unknown }) => row.fcm_token)
        .filter((value: unknown): value is string => typeof value === "string");
    }

    if (tokens.length === 0) {
      return json({ success: false, message: "No subscribed users found", sent: 0, failed: 0 });
    }

    const customData =
      request.data && typeof request.data === "object" && !Array.isArray(request.data)
        ? Object.fromEntries(
            Object.entries(request.data).map(([key, value]) => [key, String(value)])
          )
        : {};
    if (typeof request.type === "string") customData.type = request.type;

    let sent = 0;
    const errors: string[] = [];
    const deadTokens: string[] = [];
    for (const token of tokens) {
      const result = await sendToToken(token, title, messageBody, customData);
      if (result.success) sent += 1;
      else {
        errors.push(result.error ?? "Unknown error");
        if (result.invalidToken) deadTokens.push(token);
      }
    }

    // Purga de dispositivos que ya no existen. Se hace en un solo DELETE al
    // final y no corta la respuesta si falla: el envio ya ocurrio y la limpieza
    // es mantenimiento, no parte del resultado.
    let purged = 0;
    if (deadTokens.length > 0) {
      const { error: purgeError } = await supabase
        .from("fcm_tokens")
        .delete()
        .in("fcm_token", deadTokens);
      if (purgeError) {
        console.error("[FCM] No se pudieron purgar tokens muertos:", purgeError.message);
      } else {
        purged = deadTokens.length;
        console.log(`[FCM] Purgados ${purged} token(s) sin dispositivo`);
      }
    }

    return json({
      success: errors.length === 0,
      sent,
      failed: errors.length,
      total: tokens.length,
      purged_tokens: purged,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("[FCM] Request failed:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
