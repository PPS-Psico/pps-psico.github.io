import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * generate-content
 *
 * Proxy a Gemini para funciones administrativas (generación de convenios,
 * análisis de lanzamientos, diagnóstico de modelos).
 *
 * SEGURIDAD — leer antes de tocar:
 * Esta función estaba desplegada con verify_jwt=false y SIN ninguna verificación
 * interna: era un relay abierto a internet contra la GEMINI_API_KEY del
 * proyecto. Cualquiera que leyera la URL en el bundle público podía consumir
 * cuota ilimitada y elegir el modelo más caro.
 *
 * Ahora exige sesión real + rol administrativo, siguiendo el mismo patrón que
 * hermes-proxy. Los tres llamadores del panel (ConvenioGenerator,
 * useLaunchManager, geminiService) ya mandaban el token de sesión, así que el
 * cambio es transparente para la app.
 */

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ADMIN_ROLES = new Set(["admin", "SuperUser", "Jefe", "Directivo", "AdminTester"]);

/** Allowlist: impide que el llamante pida un modelo arbitrario (costo). */
const ALLOWED_MODELS = new Set([
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Autenticación ──────────────────────────────────────────────────
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return json({ error: "Falta el token de sesión." }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Sesión inválida." }, 401);
    }

    // ── 2. Autorización (rol) ─────────────────────────────────────────────
    const { data: userData, error: roleError } = await supabase
      .from("estudiantes")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("[generate-content] No se pudo verificar el rol:", roleError.message);
      return json({ error: "No se pudo verificar tu autorización." }, 500);
    }

    if (!userData?.role || !ADMIN_ROLES.has(userData.role)) {
      return json({ error: "No tenés permisos para usar esta función." }, 403);
    }

    // ── 3. Validación de entrada ──────────────────────────────────────────
    const { prompt, file, mimeType, model = "gemini-2.5-flash" } = await req.json();

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not found");
    }

    if (!ALLOWED_MODELS.has(model)) {
      return json({ error: `Modelo no permitido: ${model}` }, 400);
    }

    const parts = [{ text: prompt }];
    if (file && mimeType) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: file,
        },
      } as any);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in Gemini edge function:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
