import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BACKUP_ROLES, hasRole } from "../_shared/roles.ts";

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
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response(JSON.stringify({ error: "No authorization token provided" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error("Auth error:", authError);
    return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Authenticated user:", user.id, user.email);

  // Verificar que sea admin - buscar en tabla estudiantes
  const { data: userData, error: roleError } = await supabase
    .from("estudiantes")
    .select("role, legajo, nombre")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    console.error("Role query error:", roleError);
  }

  console.log("User data from estudiantes:", userData);

  // Verificar rol admin o Jefe
  // `BACKUP_ROLES` reproduce exactamente esta cadena: los mismos 4 roles, sin
  // `AdminTester`. Ver la nota en `_shared/roles.ts`.
  const isAdmin = hasRole(userData?.role, BACKUP_ROLES);

  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        error: "Admin access required",
        userId: user.id,
        role: userData?.role || "not found",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // Obtener configuración de backup
    const { data: config, error: configError } = await supabase
      .from("backup_config")
      .select("*")
      .maybeSingle();

    if (configError) {
      console.error("Config query error:", configError);
    }

    const bucketName = config?.storage_bucket || "backups";
    console.log("Using bucket:", bucketName);

    switch (action) {
      case "list": {
        // Listar archivos de backup en Storage
        const { data: files, error: filesError } = await supabase.storage.from(bucketName).list();

        if (filesError) {
          console.error("Storage list error:", filesError);
          throw new Error(`Failed to list backups: ${filesError.message}`);
        }

        console.log("Files found:", files?.length || 0);

        // Obtener historial de backups
        let history = [];
        try {
          const { data: historyData, error: historyError } = await supabase
            .from("backup_history")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(50);

          if (historyError) {
            console.error("History query error:", historyError);
          } else {
            history = historyData || [];
          }
        } catch (e) {
          console.error("History fetch error:", e);
        }

        // Combinar información
        const backups = (files || [])
          .filter((f) => f.name.startsWith("backup_"))
          .map((file) => {
            const historyEntry = history.find((h) => h.storage_path === file.name);
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
        try {
          const { data: history, error: historyError } = await supabase
            .from("backup_history")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(100);

          if (historyError) {
            console.error("History query error:", historyError);
            return new Response(JSON.stringify({ history: [] }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ history: history || [] }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("History fetch error:", e);
          return new Response(JSON.stringify({ history: [] }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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
