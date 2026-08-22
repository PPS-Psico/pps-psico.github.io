// Health check real.
//
// La version anterior devolvia un objeto hardcodeado con todo en "ok" sin
// tocar nada. Eso es peor que no tener health check: enchufado a un monitor
// reporta salud eterna. En julio de 2026 el backup automatico estuvo 26 dias
// caido y este endpoint siguio contestando "healthy" todo el tiempo.
//
// Ahora cada componente se verifica de verdad y, si algo falla, la respuesta
// sale con HTTP 503 para que un monitor externo lo levante.
//
// El endpoint es publico (`verify_jwt = false` en config.toml), asi que el
// detalle solo se entrega a quien presente `X-API-Key: CRON_SECRET` o una
// sesion admin. Sin credencial se devuelve el estado agregado y nada mas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const ADMIN_ROLES = new Set(["admin", "SuperUser", "Jefe", "Directivo", "AdminTester"]);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Dias de atraso tolerados por frecuencia antes de considerar el backup vencido.
// Un dia de gracia sobre la propia cadencia. Igual criterio que BackupManager.
const STALE_AFTER_DAYS: Record<string, number> = {
  hourly: 1,
  daily: 2,
  weekly: 9,
  monthly: 33,
};

type CheckResult = {
  ok: boolean;
  detail?: string;
};

/** Quien puede ver el detalle: el cron o una sesion administrativa. */
const canSeeDetail = async (req: Request): Promise<boolean> => {
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

/** La DB responde y la RLS/service role siguen operativas. */
const checkDatabase = async (): Promise<CheckResult> => {
  try {
    const { error } = await supabase.from("backup_config").select("id").limit(1);
    if (error) return { ok: false, detail: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Unknown error" };
  }
};

/** Storage responde y el bucket de backups sigue existiendo. */
const checkStorage = async (bucket: string): Promise<CheckResult> => {
  try {
    const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
    if (error) return { ok: false, detail: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Unknown error" };
  }
};

/**
 * El backup automatico corrio dentro de su ventana. Este es el chequeo que
 * hubiera evitado los 26 dias a ciegas.
 */
const checkBackupFreshness = async (): Promise<{ result: CheckResult; bucket: string }> => {
  try {
    const { data: config, error } = await supabase
      .from("backup_config")
      .select("enabled, frequency, last_backup_at, storage_bucket")
      .single();

    const bucket = config?.storage_bucket ?? "backups";

    if (error || !config) {
      return {
        result: { ok: false, detail: error?.message ?? "backup_config no encontrado" },
        bucket,
      };
    }

    // Backup deshabilitado a proposito no es una falla: es una decision.
    if (!config.enabled) {
      return { result: { ok: true, detail: "deshabilitado" }, bucket };
    }

    if (!config.last_backup_at) {
      return { result: { ok: false, detail: "nunca se ejecuto" }, bucket };
    }

    const ageDays = Math.floor(
      (Date.now() - new Date(config.last_backup_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const limit = STALE_AFTER_DAYS[config.frequency] ?? 2;

    if (ageDays > limit) {
      return {
        result: { ok: false, detail: `ultimo backup hace ${ageDays} dias (limite ${limit})` },
        bucket,
      };
    }

    return { result: { ok: true, detail: `hace ${ageDays} dia(s)` }, bucket };
  } catch (error) {
    return {
      result: { ok: false, detail: error instanceof Error ? error.message : "Unknown error" },
      bucket: "backups",
    };
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { result: backup, bucket } = await checkBackupFreshness();
  const [database, storage] = await Promise.all([checkDatabase(), checkStorage(bucket)]);

  const checks: Record<string, CheckResult> = { database, storage, backup };
  const failed = Object.entries(checks).filter(([, check]) => !check.ok);
  const healthy = failed.length === 0;

  const withDetail = await canSeeDetail(req);

  const body: Record<string, unknown> = {
    status: healthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    version: "2.0",
  };

  if (withDetail) {
    body.services = Object.fromEntries(
      Object.entries(checks).map(([name, check]) => [
        name,
        check.detail ? `${check.ok ? "ok" : "fail"} (${check.detail})` : check.ok ? "ok" : "fail",
      ])
    );
  } else {
    // Publico: solo que componente esta caido, sin mensajes internos.
    body.services = Object.fromEntries(
      Object.entries(checks).map(([name, check]) => [name, check.ok ? "ok" : "fail"])
    );
  }

  if (!healthy) {
    console.error(
      "[health-check] Componentes en falla:",
      failed.map(([name, check]) => `${name}: ${check.detail ?? "fail"}`).join("; ")
    );
  }

  // 503 cuando algo falla: es lo unico que un monitor externo mira.
  return new Response(JSON.stringify(body), {
    status: healthy ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
