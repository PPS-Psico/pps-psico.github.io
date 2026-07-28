import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ADMIN_ROLES = new Set(["admin", "SuperUser", "Jefe", "Directivo", "AdminTester"]);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface BackupData {
  [tableName: string]: unknown[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("X-API-Key");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCronJob = Boolean(cronSecret && apiKey && apiKey === cronSecret);

  if (!isCronJob) {
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: roleError } = await supabase
      .from("estudiantes")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("[automated-backup] Role validation failed:", roleError.message);
      return json({ error: "Authorization check failed" }, 500);
    }

    if (!profile?.role || !ADMIN_ROLES.has(profile.role)) {
      return json({ error: "Forbidden - Admin role required" }, 403);
    }
  }

  try {
    // 1. Obtener configuración de backup
    const { data: config, error: configError } = await supabase
      .from("backup_config")
      .select("*")
      .single();

    if (configError || !config) {
      throw new Error("Backup configuration not found");
    }

    if (!config.enabled) {
      return new Response(JSON.stringify({ message: "Backup is disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Crear registro en historial
    const { data: historyRecord, error: historyError } = await supabase
      .from("backup_history")
      .insert({
        backup_type: isCronJob ? "automatic" : "manual",
        status: "running",
        tables_backed_up: config.include_tables,
      })
      .select()
      .single();

    if (historyError) {
      throw new Error(`Failed to create history record: ${historyError.message}`);
    }

    // 3. Realizar backup de cada tabla
    const backupData: BackupData = {};
    let totalRecords = 0;
    const backedUpTables: string[] = [];

    for (const tableName of config.include_tables) {
      try {
        const { data: tableData, error: tableError } = await supabase.from(tableName).select("*");

        if (tableError) {
          console.error(`Error backing up ${tableName}:`, tableError);
          continue;
        }

        backupData[tableName] = tableData || [];
        totalRecords += tableData?.length || 0;
        backedUpTables.push(tableName);

        console.log(`✅ Backed up ${tableName}: ${tableData?.length || 0} records`);
      } catch (err) {
        console.error(`Failed to backup ${tableName}:`, err);
      }
    }

    // 4. Preparar archivo de backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup_${timestamp}.json`;
    const backupContent = JSON.stringify(
      {
        metadata: {
          created_at: new Date().toISOString(),
          tables: backedUpTables,
          record_count: totalRecords,
          version: "1.0",
        },
        data: backupData,
      },
      null,
      2
    );

    // 5. Verificar/crear bucket de backups
    const { data: buckets } = await supabase.storage.listBuckets();
    const backupBucketExists = buckets?.some((b) => b.name === config.storage_bucket);

    if (!backupBucketExists) {
      await supabase.storage.createBucket(config.storage_bucket, {
        public: false,
        fileSizeLimit: 104857600, // 100MB
      });
    }

    // 6. Subir backup a Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(config.storage_bucket)
      .upload(fileName, backupContent, {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload backup: ${uploadError.message}`);
    }

    // 7. Actualizar historial
    await supabase
      .from("backup_history")
      .update({
        status: "completed",
        tables_backed_up: backedUpTables,
        storage_path: uploadData?.path || fileName,
        file_size_bytes: new Blob([backupContent]).size,
        record_count: totalRecords,
        completed_at: new Date().toISOString(),
      })
      .eq("id", historyRecord.id);

    // 8. Actualizar último backup en configuración
    await supabase
      .from("backup_config")
      .update({ last_backup_at: new Date().toISOString() })
      .eq("id", config.id);

    // 9. Limpiar backups antiguos (mantener máximo 3: diario, semanal, mensual)
    await cleanupOldBackups(config.storage_bucket);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Backup completed successfully",
        backup_id: historyRecord.id,
        file_name: fileName,
        tables_backed_up: backedUpTables,
        record_count: totalRecords,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backup error:", error);

    // Actualizar historial con error
    await supabase
      .from("backup_history")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("status", "running");

    return new Response(
      JSON.stringify({
        error: "Backup failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function cleanupOldBackups(bucketName: string) {
  try {
    const { data: files, error } = await supabase.storage.from(bucketName).list();

    if (error || !files) {
      console.error("Error listing files:", error);
      return;
    }

    // Filtrar solo archivos de backup
    const backupFiles = files.filter((f) => f.name.startsWith("backup_"));

    if (backupFiles.length <= 1) {
      console.log(`Found ${backupFiles.length} backups, no cleanup needed`);
      return;
    }

    // Ordenar por fecha de creación (más reciente primero)
    const sortedFiles = backupFiles.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    console.log(`Found ${sortedFiles.length} backups, applying smart retention strategy`);

    // Estrategia: Máximo 3 backups
    // 1. Último diario (siempre el más reciente)
    // 2. Último semanal (domingo más reciente, si existe y es diferente al diario)
    // 3. Último mensual (1ro del mes más reciente, si existe y es diferente a los anteriores)

    const filesToKeep = new Set<string>();

    // 1. Siempre mantener el más reciente (diario actual)
    filesToKeep.add(sortedFiles[0].name);
    console.log(`📌 Daily (latest): ${sortedFiles[0].name}`);

    // Buscar semanal (último domingo) y mensual (último 1ro)
    let weeklyBackup: (typeof sortedFiles)[0] | null = null;
    let monthlyBackup: (typeof sortedFiles)[0] | null = null;

    for (let i = 1; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      const fileDate = new Date(file.created_at || 0);

      // Buscar semanal (domingo)
      if (!weeklyBackup && fileDate.getDay() === 0) {
        weeklyBackup = file;
        console.log(`📌 Weekly (Sunday): ${file.name}`);
      }

      // Buscar mensual (1ro del mes)
      if (!monthlyBackup && fileDate.getDate() === 1) {
        monthlyBackup = file;
        console.log(`📌 Monthly (1st): ${file.name}`);
      }

      // Si ya encontramos ambos, salir del bucle
      if (weeklyBackup && monthlyBackup) break;
    }

    // Agregar semanal si existe y es diferente al diario
    if (weeklyBackup && weeklyBackup.name !== sortedFiles[0].name) {
      filesToKeep.add(weeklyBackup.name);
    }

    // Agregar mensual si existe y es diferente a los anteriores
    if (monthlyBackup && !filesToKeep.has(monthlyBackup.name)) {
      filesToKeep.add(monthlyBackup.name);
    }

    // Eliminar TODO lo demás (sin excepciones)
    const filesToDelete = sortedFiles.filter((f) => !filesToKeep.has(f.name));

    console.log(
      `Keeping ${filesToKeep.size} backups, deleting ${filesToDelete.length} old backups`
    );

    for (const file of filesToDelete) {
      await supabase.storage.from(bucketName).remove([file.name]);
      console.log(`🗑️ Deleted: ${file.name}`);
    }
  } catch (err) {
    console.error("Error cleaning up old backups:", err);
  }
}
