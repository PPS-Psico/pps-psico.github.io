import fs from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { describeIntent } from "./moodle-writer-contract.mjs";

export function writerClient() {
  const file = new URL("../.env", import.meta.url);
  const env = {
    ...(fs.existsSync(file) ? parseEnv(fs.readFileSync(file, "utf8")) : {}),
    ...process.env,
  };
  if (
    env.VITE_SUPABASE_URL !== "https://qxnxtnhtbpsgzprqtrjl.supabase.co" ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("Configuración privada del writer incompleta o proyecto incorrecto");
  return createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
export const INTENT_SELECT =
  "*,lanzamiento:lanzamientos_pps!moodle_task_intents_lanzamiento_id_fkey(nombre_pps,fecha_inicio,fecha_finalizacion,horas_acreditadas)";

export async function unplannedActiveLaunches(client) {
  const launches = await client
    .from("lanzamientos_pps")
    .select("id,nombre_pps,fecha_inicio,orientacion")
    .eq("estado_convocatoria", "Activa")
    .gte("fecha_inicio", "2026-01-01");
  if (launches.error) throw launches.error;
  if (!launches.data.length) return [];
  const intents = await client
    .from("moodle_task_intents")
    .select("lanzamiento_id")
    .in(
      "lanzamiento_id",
      launches.data.map((l) => l.id)
    );
  if (intents.error) throw intents.error;
  const planned = new Set(intents.data.map((i) => i.lanzamiento_id));
  return launches.data
    .filter((l) => !planned.has(l.id))
    .map((l) => ({
      launchId: l.id,
      name: l.nombre_pps,
      start: l.fecha_inicio,
      status: "missing_intent",
      error: "ACTIVE_LAUNCH_OUTSIDE_QUEUE",
    }));
}
export async function plansFor(client, rows) {
  const ids = [...new Set(rows.map((r) => r.aula_entrega_id).filter(Boolean))];
  let catalog = [];
  if (ids.length) {
    const result = await client
      .from("aula_entregas")
      .select("id,course_id,moodle_id")
      .in("id", ids);
    if (result.error) throw result.error;
    catalog = result.data;
  }
  return rows.map((row) =>
    describeIntent(
      row,
      catalog.find((c) => c.id === row.aula_entrega_id)
    )
  );
}
