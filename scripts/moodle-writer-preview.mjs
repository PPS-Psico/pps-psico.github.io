/** Read-only manifest. Never leases or writes Moodle/Supabase. */
import {
  writerClient,
  INTENT_SELECT,
  plansFor,
  unplannedActiveLaunches,
} from "./moodle-writer-client.mjs";
import { queueState } from "./moodle-writer-contract.mjs";

try {
  const client = writerClient();
  const index = process.argv.indexOf("--preview");
  const preview = index >= 0 ? process.argv[index + 1] : null;
  if (index >= 0 && !/^[0-9a-f-]{36}$/i.test(preview ?? ""))
    throw new Error("Se requiere UUID del lanzamiento");
  let query = client.from("moodle_task_intents").select(INTENT_SELECT);
  query = preview ? query.eq("lanzamiento_id", preview) : query.eq("mode", "dedicated");
  const { data, error } = await query;
  if (error) throw error;
  const state = queueState(data);
  const unplanned = preview ? [] : await unplannedActiveLaunches(client);
  console.log(
    JSON.stringify(
      {
        schema: "moodle-writer/v2",
        generatedAt: new Date().toISOString(),
        readOnly: true,
        status: preview ? "preview" : unplanned.length ? "attention" : state.status,
        attention: [
          ...state.attention.map((r) => ({
            intentId: r.id,
            name: r.desired_name,
            status: r.provisioning_status,
            error: r.last_error_code,
          })),
          ...unplanned,
        ],
        plans: await plansFor(client, preview ? data : state.ready),
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("No se pudo obtener una cola verificable:", error.message);
  process.exitCode = 1;
}
