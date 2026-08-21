/**
 * Brazo escritor del aprovisionador de tareas Moodle.
 *
 *   claim                        reclama las intenciones pendientes con un lease
 *                                de 30 min y guarda el token en disco.
 *   confirm <intentId> <archivo> confirma una intencion con lo que el agente
 *                                LEYO de vuelta en Moodle (no con lo que quiso
 *                                escribir). La base recompara todo bajo el lease
 *                                y es la autoridad final.
 *
 * El archivo de confirmacion es un JSON con lo observado al reabrir la tarea:
 *   { "cmid": 1222569, "stableKey": "...", "name": "...", "descriptionHtml": "...",
 *     "openAt": "2026-10-24T03:00:00Z", "dueAt": "...", "cutoffAt": null,
 *     "gradeMode": "direct_10", "gradeMax": 10, "sectionKey": null,
 *     "visibility": "visible" }
 *
 * Nunca marcar una tarea como creada sin releerla: Moodle puede rechazar el
 * guardado y devolver el mismo formulario sin cartel de error.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs";

const LEASE_FILE = new URL("../.moodle-worker-lease.json", import.meta.url);
const COURSE_ID = 3615;
const LEASE_SECONDS = 1800;

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [command, ...rest] = process.argv.slice(2);

if (command === "claim") {
  const workerToken = crypto.randomUUID();
  const { data, error } = await supabase.rpc("claim_moodle_task_intent_lease_v1", {
    p_batch_size: 5,
    p_lease_seconds: LEASE_SECONDS,
    p_worker_token: workerToken,
  });
  if (error) {
    console.error("No se pudo reclamar:", error.message);
    process.exitCode = 1;
  } else if (!data?.length) {
    console.log("Nada pendiente. No se reclamo ningun lease.");
  } else {
    fs.writeFileSync(
      LEASE_FILE,
      JSON.stringify({ workerToken, claimedAt: new Date().toISOString(), intents: data }, null, 2)
    );
    console.log(
      `Reclamadas ${data.length} intencion(es). Lease valido ${LEASE_SECONDS / 60} min.\n`
    );
    for (const i of data) {
      console.log(`  intentId   ${i.id}`);
      console.log(`  tarea      ${i.desired_name}`);
      console.log(`  Numero ID  ${i.stable_key}`);
      console.log(`  cmid       ${i.aula_entrega_id ? "(adoptar existente)" : "(crear nueva)"}\n`);
    }
    console.log("Cuando termines en Moodle, confirma cada una con:");
    console.log("  node scripts/moodle-provisioner-apply.mjs confirm <intentId> <observado.json>");
  }
} else if (command === "confirm") {
  const [intentId, observedPath] = rest;
  if (!intentId || !observedPath) {
    console.error("Uso: confirm <intentId> <archivo-observado.json>");
    process.exitCode = 1;
  } else {
    const lease = JSON.parse(fs.readFileSync(LEASE_FILE, "utf8"));
    const o = JSON.parse(fs.readFileSync(observedPath, "utf8"));
    const { data, error } = await supabase.rpc("confirm_moodle_task_intent_v1", {
      p_intent_id: intentId,
      p_lease_token: lease.workerToken,
      p_cmid: o.cmid,
      p_course_id: o.courseId ?? COURSE_ID,
      p_observed_stable_key: o.stableKey,
      p_observed_name: o.name,
      p_observed_description_html: o.descriptionHtml ?? "",
      p_observed_open_at: o.openAt ?? null,
      p_observed_due_at: o.dueAt ?? null,
      p_observed_cutoff_at: o.cutoffAt ?? null,
      p_observed_grade_mode: o.gradeMode,
      p_observed_grade_max: o.gradeMax,
      p_observed_section_key: o.sectionKey ?? null,
      p_observed_visibility: o.visibility,
      p_evidence: o.evidence ?? null,
    });
    if (error) {
      console.error("La base rechazo la confirmacion:", error.message);
      console.error("La intencion NO quedo verificada. Revisar antes de reintentar.");
      process.exitCode = 1;
    } else {
      console.log("Resultado de la base:", JSON.stringify(data, null, 2));
    }
  }
} else {
  console.error("Comandos: claim | confirm <intentId> <archivo.json>");
  process.exitCode = 1;
}
