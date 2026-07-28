import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -- CONFIGURATION --
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const ADMIN_ROLES = new Set(["admin", "SuperUser", "Jefe", "Directivo", "AdminTester"]);

/**
 * Dos identidades válidas: el cron (secreto en X-API-Key) o una sesión
 * administrativa. La anon key NO alcanza: es pública y viaja en el bundle.
 */
const isAuthorized = async (req: Request): Promise<boolean> => {
  const apiKey = req.headers.get("X-API-Key");
  if (CRON_SECRET && apiKey === CRON_SECRET) return true;

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return false;

  const { data } = await supabase
    .from("estudiantes")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data?.role && ADMIN_ROLES.has(data.role);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Publica convocatorias y dispara notificaciones: no puede quedar abierta.
  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ error: "No autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date().toISOString();
    console.log(`[Scheduler] Checking for scheduled launches at ${now}...`);

    // 1. Find 'Programada' launches that are due
    const { data: launches, error: fetchError } = await supabase
      .from("lanzamientos_pps")
      .select("id, nombre_pps")
      .eq("estado_convocatoria", "Programada")
      .lte("fecha_publicacion", now);

    if (fetchError) {
      console.error("[Scheduler] Error fetching launches:", fetchError);
      throw fetchError;
    }

    if (!launches || launches.length === 0) {
      console.log("✅ No pending launches found.");
      return new Response(JSON.stringify({ message: "No pending launches", time: now }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🚀 Found ${launches.length} launches to activate.`);
    const results = [];

    // 2. Process each launch
    for (const launch of launches) {
      try {
        console.log(`[Scheduler] Activando: ${launch.nombre_pps} (${launch.id})`);

        // Update status to 'Abierta' only if the launch is still scheduled.
        const { data: updatedLaunch, error: updateError } = await supabase
          .from("lanzamientos_pps")
          .update({ estado_convocatoria: "Abierta" })
          .eq("id", launch.id)
          .eq("estado_convocatoria", "Programada")
          .select("id")
          .maybeSingle();

        if (updateError) {
          console.error(`❌ Database update failed for ${launch.id}:`, updateError);
          results.push({ id: launch.id, status: "error", error: "DB Update failed" });
          continue;
        }

        if (!updatedLaunch) {
          console.log(`[Scheduler] Omitido por cambio concurrente: ${launch.id}`);
          results.push({ id: launch.id, status: "skipped" });
          continue;
        }

        results.push({ id: updatedLaunch.id, status: "activated" });
      } catch (err: any) {
        console.error(`[Scheduler] Critical error processing launch ${launch.id}:`, err);
        results.push({ id: launch.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results, time: now }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Scheduler] Global Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
