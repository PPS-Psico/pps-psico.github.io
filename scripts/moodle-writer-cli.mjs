/** Claude operates the browser; this CLI verifies artifacts under a lease. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { writerClient, INTENT_SELECT, plansFor } from "./moodle-writer-client.mjs";
import { inventoryDecision, validateReadback } from "./moodle-writer-contract.mjs";

const directory = new URL("../.moodle-worker-runs/", import.meta.url);
const [command, ...args] = process.argv.slice(2);
let checkpointFile;
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
function loadLease(file) {
  const lease = read(file);
  if (lease.schema !== "moodle-writer/v2" || !lease.intent?.intentId || !lease.workerToken)
    throw new Error("Lease desconocido");
  if (!Number.isFinite(Date.parse(lease.expiresAt)) || Date.parse(lease.expiresAt) <= Date.now())
    throw new Error("Lease vencido: conservar checkpoint y reclamar nuevamente");
  return lease;
}
async function checkLiveLease(client, lease) {
  const { data, error } = await client
    .from("moodle_task_intents")
    .select(INTENT_SELECT)
    .eq("id", lease.intent.intentId)
    .single();
  if (error) throw error;
  if (
    data.lease_token !== lease.workerToken ||
    !["claimed", "reconciling"].includes(data.provisioning_status) ||
    !Number.isFinite(Date.parse(data.lease_expires_at)) ||
    Date.parse(data.lease_expires_at) <= Date.now()
  )
    throw new Error("El lease ya no está vigente en la base");
  const [current] = await plansFor(client, [data]);
  if (
    JSON.stringify(current.expected) !== JSON.stringify(lease.intent.expected) ||
    current.linkedCmid !== lease.intent.linkedCmid ||
    current.year !== lease.intent.year
  )
    throw new Error("La configuración deseada cambió: detener esta corrida");
}
function journal(file, event) {
  fs.appendFileSync(
    path.join(path.dirname(path.resolve(file)), "events.jsonl"),
    JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n"
  );
}
try {
  const client = writerClient();
  if (command === "claim") {
    const token = crypto.randomUUID();
    const runDir = new URL(crypto.randomUUID() + "/", directory);
    fs.mkdirSync(runDir, { recursive: true });
    const leasePath = new URL("lease.json", runDir);
    const { data, error } = await client.rpc("claim_moodle_task_intent_lease_v1", {
      p_batch_size: 1,
      p_lease_seconds: 1800,
      p_worker_token: token,
    });
    if (error) throw error;
    if (!data?.length) console.log(JSON.stringify({ status: "idle" }));
    else {
      const raw = data[0];
      // Persist the receipt before any subsequent query can fail.
      fs.writeFileSync(
        leasePath,
        JSON.stringify(
          {
            schema: "moodle-writer/v2",
            workerToken: token,
            raw,
            claimedAt: raw.last_attempt_at,
            expiresAt: raw.lease_expires_at,
          },
          null,
          2
        ),
        { flag: "wx" }
      );
      checkpointFile = fileURLToPath(leasePath);
      const result = await client
        .from("moodle_task_intents")
        .select(INTENT_SELECT)
        .eq("id", raw.id)
        .single();
      if (result.error) throw result.error;
      const [intent] = await plansFor(client, [result.data]);
      const lease = {
        schema: "moodle-writer/v2",
        workerToken: token,
        claimedAt: raw.last_attempt_at,
        expiresAt: raw.lease_expires_at,
        intent,
      };
      fs.writeFileSync(leasePath, JSON.stringify(lease, null, 2));
      console.log(
        JSON.stringify({ status: "claimed", leaseFile: fileURLToPath(leasePath), intent }, null, 2)
      );
    }
  } else if (command === "resume") {
    const [file] = args;
    if (!file) throw new Error("Uso: resume <lease.json>");
    const receipt = read(file);
    const intentId = receipt.intent?.intentId ?? receipt.raw?.id;
    if (receipt.schema !== "moodle-writer/v2" || !intentId || !receipt.workerToken)
      throw new Error("Recibo desconocido");
    const { data, error } = await client
      .from("moodle_task_intents")
      .select(INTENT_SELECT)
      .eq("id", intentId)
      .single();
    if (error) throw error;
    const [intent] = await plansFor(client, [data]);
    const recovered = {
      ...receipt,
      intent,
      claimedAt: data.last_attempt_at,
      expiresAt: data.lease_expires_at,
    };
    await checkLiveLease(client, recovered);
    // An existing plan must not silently adopt a changed configuration.
    if (receipt.intent) await checkLiveLease(client, receipt);
    fs.writeFileSync(file, JSON.stringify(recovered, null, 2));
    journal(file, { stage: "resume", intentId });
    console.log(
      JSON.stringify({ status: "resumed", leaseFile: path.resolve(file), intent }, null, 2)
    );
  } else if (command === "preflight") {
    const [file, inventoryFile] = args;
    if (!file || !inventoryFile) throw new Error("Uso: preflight <lease.json> <inventory.json>");
    const lease = loadLease(file),
      inventory = read(inventoryFile),
      decision = inventoryDecision(lease.intent, inventory);
    await checkLiveLease(client, lease);
    fs.writeFileSync(
      path.join(path.dirname(path.resolve(file)), "preflight.json"),
      JSON.stringify(
        {
          schema: "moodle-writer/v2",
          intentId: lease.intent.intentId,
          at: new Date().toISOString(),
          inventory,
          decision,
        },
        null,
        2
      )
    );
    journal(file, { stage: "preflight", decision });
    console.log(JSON.stringify(decision));
  } else if (command === "confirm") {
    const [file, observedFile, finalInventoryFile] = args;
    if (!file || !observedFile || !finalInventoryFile)
      throw new Error("Uso: confirm <lease.json> <observado.json> <inventario-final.json>");
    const lease = loadLease(file),
      observed = read(observedFile);
    const preflight = read(path.join(path.dirname(path.resolve(file)), "preflight.json"));
    if (preflight.intentId !== lease.intent.intentId)
      throw new Error("Preflight de otra intención");
    const decision = inventoryDecision(lease.intent, preflight.inventory);
    if (decision.cmid && observed.cmid !== decision.cmid)
      throw new Error("CMID diferente al inventario");
    const evidence = validateReadback(lease.intent, observed, lease.claimedAt);
    const finalInventory = read(finalInventoryFile);
    const finalDecision = inventoryDecision(lease.intent, finalInventory);
    if (
      finalDecision.action !== "verify_existing" ||
      finalDecision.cmid !== observed.cmid ||
      Date.parse(finalInventory.observedAt) < Date.parse(observed.observedAt)
    )
      throw new Error("El inventario final no confirma una única tarea después de la relectura");
    await checkLiveLease(client, lease);
    journal(file, { stage: "readback", cmid: observed.cmid, evidence });
    const { data, error } = await client.rpc("confirm_moodle_task_intent_v1", {
      p_intent_id: lease.intent.intentId,
      p_lease_token: lease.workerToken,
      p_cmid: observed.cmid,
      p_course_id: observed.courseId,
      p_observed_stable_key: observed.stableKey,
      p_observed_name: observed.name,
      p_observed_description_html: observed.descriptionHtml,
      p_observed_open_at: observed.openAt,
      p_observed_due_at: observed.dueAt,
      p_observed_cutoff_at: observed.cutoffAt,
      p_observed_grade_mode: observed.gradeMode,
      p_observed_grade_max: observed.gradeMax,
      p_observed_section_key: observed.sectionKey,
      p_observed_visibility: observed.visibility,
      p_evidence: evidence,
    });
    journal(file, { stage: "confirm", result: data, error: error?.message });
    if (error) throw error;
    if (data?.verified !== true)
      throw new Error("La base NO verificó la tarea: " + JSON.stringify(data));
    fs.writeFileSync(
      path.join(path.dirname(path.resolve(file)), "confirmed.json"),
      JSON.stringify(data, null, 2)
    );
    console.log(JSON.stringify(data, null, 2));
  } else
    throw new Error(
      "Comandos: claim | resume <lease.json> | preflight <lease.json> <inventory.json> | confirm <lease.json> <observado.json> <inventario-final.json>"
    );
} catch (error) {
  console.error("Writer detenido:", error.message);
  if (checkpointFile) console.error("Checkpoint para retomar:", checkpointFile);
  process.exitCode = 1;
}
