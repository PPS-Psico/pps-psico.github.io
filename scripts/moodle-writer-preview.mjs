/** Read-only manifest. Never leases or writes Moodle/Supabase. */
import {
  writerClient,
  INTENT_SELECT,
  plansFor,
  unplannedActiveLaunches,
} from "./moodle-writer-client.mjs";
import { queueState } from "./moodle-writer-contract.mjs";
import { practiceCoverage, readAll } from "./moodle-writer-coverage.mjs";

try {
  const client = writerClient();
  const index = process.argv.indexOf("--preview");
  const preview = index >= 0 ? process.argv[index + 1] : null;
  if (index >= 0 && !/^[0-9a-f-]{36}$/i.test(preview ?? ""))
    throw new Error("Se requiere UUID del lanzamiento");
  const data = await readAll(() => {
    const query = client.from("moodle_task_intents").select(INTENT_SELECT);
    return preview ? query.eq("lanzamiento_id", preview) : query.eq("mode", "dedicated");
  });
  const state = queueState(data);
  const unplanned = preview ? [] : await unplannedActiveLaunches(client);
  const coverage = await practiceCoverage(client);
  console.log(
    JSON.stringify(
      {
        schema: "moodle-writer/v2",
        generatedAt: new Date().toISOString(),
        readOnly: true,
        status: preview
          ? "preview"
          : unplanned.length || coverage.attention.length
            ? "attention"
            : state.status,
        coverage: coverage.summary,
        archivedCoverage: coverage.archived,
        attention: [
          ...state.attention.map((r) => ({
            intentId: r.id,
            name: r.desired_name,
            status: r.provisioning_status,
            error: r.last_error_code,
          })),
          ...unplanned,
          ...coverage.attention,
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
