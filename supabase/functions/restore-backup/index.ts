import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // Verificar método
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  console.log("Restore - Authenticated user:", user.id, user.email);

  // Verificar que sea admin
  const { data: userData, error: roleError } = await supabase
    .from("estudiantes")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    console.error("Role query error:", roleError);
  }

  const isAdmin =
    userData?.role === "admin" ||
    userData?.role === "Jefe" ||
    userData?.role === "SuperUser" ||
    userData?.role === "Directivo";

  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        error: "Admin access required",
        role: userData?.role || "not found",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json();
    const { backup_file_name, tables_to_restore, dry_run = false } = body;

    if (!backup_file_name) {
      return new Response(JSON.stringify({ error: "backup_file_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Obtener configuración de backup
    const { data: config } = await supabase.from("backup_config").select("storage_bucket").single();

    const bucketName = config?.storage_bucket || "backups";

    // 2. Descargar archivo de backup
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(backup_file_name);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download backup: ${downloadError?.message || "File not found"}`);
    }

    // 3. Parsear contenido del backup
    const backupContent = await fileData.text();
    const backup = JSON.parse(backupContent);

    if (!backup.data || typeof backup.data !== "object") {
      throw new Error("Invalid backup format");
    }

    // 4. Determinar tablas a restaurar
    const availableTables = Object.keys(backup.data);
    const tablesToRestore =
      tables_to_restore?.length > 0
        ? tables_to_restore.filter((t: string) => availableTables.includes(t))
        : availableTables;

    if (tablesToRestore.length === 0) {
      return new Response(JSON.stringify({ error: "No valid tables to restore" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Modo simulación (dry run)
    if (dry_run) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          backup_info: backup.metadata,
          available_tables: availableTables,
          tables_to_restore: tablesToRestore,
          records_per_table: tablesToRestore.reduce((acc: any, table: string) => {
            acc[table] = backup.data[table]?.length || 0;
            return acc;
          }, {}),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Realizar restauración
    const results: { [table: string]: { success: boolean; count: number; error?: string } } = {};

    for (const tableName of tablesToRestore) {
      try {
        const records = backup.data[tableName] || [];

        if (records.length === 0) {
          results[tableName] = { success: true, count: 0 };
          continue;
        }

        // Usar UPSERT para evitar duplicados
        const { error: upsertError } = await supabase
          .from(tableName)
          .upsert(records, { onConflict: "id" });

        if (upsertError) {
          results[tableName] = {
            success: false,
            count: 0,
            error: upsertError.message,
          };
          console.error(`Error restoring ${tableName}:`, upsertError);
        } else {
          results[tableName] = { success: true, count: records.length };
          console.log(`✅ Restored ${tableName}: ${records.length} records`);
        }
      } catch (err) {
        results[tableName] = {
          success: false,
          count: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    // 7. Registrar restauración en historial
    const successCount = Object.values(results).filter((r) => r.success).length;
    const totalRecordsRestored = Object.values(results).reduce(
      (sum, r) => sum + (r.success ? r.count : 0),
      0
    );

    await supabase.from("backup_history").insert({
      backup_type: "manual",
      // Una restauracion parcial se registra como `failed`: el historial es lo
      // unico que queda para saber si el backup sirvio, y "casi completo" no
      // sirve. Vocabulario alineado con `automated-backup` (running/completed/failed).
      status: successCount === tablesToRestore.length ? "completed" : "failed",
      tables_backed_up: tablesToRestore,
      metadata: {
        action: "restore",
        source_file: backup_file_name,
        results,
        total_restored: totalRecordsRestored,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Restore completed",
        backup_metadata: backup.metadata,
        results,
        summary: {
          total_tables: tablesToRestore.length,
          successful: successCount,
          failed: tablesToRestore.length - successCount,
          total_records_restored: totalRecordsRestored,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Restore error:", error);

    return new Response(
      JSON.stringify({
        error: "Restore failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
