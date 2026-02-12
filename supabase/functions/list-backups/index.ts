import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // Verificar autenticación (solo admin)
  const authHeader = req.headers.get("Authorization");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader?.replace("Bearer ", "") || "");

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verificar que sea admin
  const { data: userData } = await supabase
    .from("estudiantes")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (userData?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // Obtener configuración de backup
    const { data: config } = await supabase.from("backup_config").select("*").single();

    const bucketName = config?.storage_bucket || "backups";

    switch (action) {
      case "list": {
        // Listar archivos de backup en Storage
        const { data: files, error: filesError } = await supabase.storage.from(bucketName).list();

        if (filesError) {
          throw new Error(`Failed to list backups: ${filesError.message}`);
        }

        // Obtener historial de backups
        const { data: history } = await supabase
          .from("backup_history")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        // Combinar información
        const backups = (files || [])
          .filter((f) => f.name.startsWith("backup_"))
          .map((file) => {
            const historyEntry = history?.find((h) => h.storage_path === file.name);
            return {
              file_name: file.name,
              created_at: file.created_at,
              size_bytes: file.metadata?.size || 0,
              status: historyEntry?.status || "unknown",
              record_count: historyEntry?.record_count || 0,
              tables_backed_up: historyEntry?.tables_backed_up || [],
              backup_type: historyEntry?.backup_type || "unknown",
            };
          })
          .sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );

        return new Response(
          JSON.stringify({
            config,
            backups,
            total_count: backups.length,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "config": {
        // GET o UPDATE configuración
        if (req.method === "GET") {
          return new Response(JSON.stringify({ config }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (req.method === "POST") {
          const updates = await req.json();

          const { data: updatedConfig, error: updateError } = await supabase
            .from("backup_config")
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq("id", config.id)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update config: ${updateError.message}`);
          }

          return new Response(
            JSON.stringify({
              success: true,
              config: updatedConfig,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "history": {
        // Obtener historial completo
        const { data: history, error: historyError } = await supabase
          .from("backup_history")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (historyError) {
          throw new Error(`Failed to get history: ${historyError.message}`);
        }

        return new Response(JSON.stringify({ history: history || [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("List backups error:", error);

    return new Response(
      JSON.stringify({
        error: "Operation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
