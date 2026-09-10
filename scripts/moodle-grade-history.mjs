import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const project = "qxnxtnhtbpsgzprqtrjl";
const [mode, destination] = process.argv.slice(2);
if (!["preview", "apply"].includes(mode) || !destination) {
  throw new Error("Usage: node scripts/moodle-grade-history.mjs preview|apply <private-directory>");
}
const directory = resolve(destination);
mkdirSync(directory, { recursive: true });
const manifestPath = join(directory, "manifest.json");
const sqlPath = join(directory, "query.sql");
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function query(sql) {
  writeFileSync(sqlPath, sql);
  const command = process.platform === "win32" ? "powershell.exe" : "npx";
  const args =
    process.platform === "win32"
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `& npx supabase db query --linked --project-ref ${project} --file '${sqlPath.replaceAll("'", "''")}'`,
        ]
      : ["supabase", "db", "query", "--linked", "--project-ref", project, "--file", sqlPath];
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Database query failed; no further batches processed. ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  if (!Array.isArray(parsed.rows)) throw new Error("Unexpected database response");
  return parsed.rows;
}
function countOutcomes(items) {
  const counts = {};
  for (const item of items) {
    const outcome = item.plan ?? item.outcome;
    for (const status of outcome.reason
      ? [outcome.reason]
      : (outcome.results ?? []).map((r) => r.status)) {
      counts[status] = (counts[status] ?? 0) + 1;
    }
  }
  return counts;
}
if (mode === "preview") {
  if (existsSync(manifestPath))
    throw new Error("Use a new directory; previous audit must be preserved.");
  const manifest = {
    contract: "moodle-grade-history/v1",
    project,
    run: randomUUID(),
    createdAt: new Date().toISOString(),
    pages: [],
    complete: false,
  };
  let after = null;
  const all = [];
  while (true) {
    // PostgreSQL enforces read-only even if a future edit accidentally adds writes.
    const [{ items }] = query(
      `begin read only; select private.preview_moodle_history_v1(${after ? literal(after) + "::uuid" : "null"},100) as items; commit;`
    );
    if (!items.length) break;
    const file = `preview-${String(manifest.pages.length + 1).padStart(3, "0")}.json`;
    writeFileSync(join(directory, file), JSON.stringify(items, null, 2));
    manifest.pages.push(file);
    all.push(...items);
    after = items.at(-1).case;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ mode, page: manifest.pages.length, cases: all.length }));
  }
  manifest.complete = true;
  manifest.cases = all.length;
  manifest.outcomes = countOutcomes(all);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ mode, cases: all.length, outcomes: manifest.outcomes }));
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    manifest.contract !== "moodle-grade-history/v1" ||
    manifest.project !== project ||
    !manifest.complete
  ) {
    throw new Error("A complete preview of this project is required.");
  }
  const all = [];
  for (const [index, file] of manifest.pages.entries()) {
    if (!/^preview-\d{3}\.json$/.test(file)) throw new Error("Invalid preview filename");
    const previews = JSON.parse(readFileSync(join(directory, file), "utf8"));
    const [{ items }] = query(
      `begin; select private.apply_moodle_history_batch_v1(${literal(manifest.run)}::uuid,${literal(JSON.stringify(previews))}::jsonb) as items; commit;`
    );
    writeFileSync(
      join(directory, file.replace("preview", "applied")),
      JSON.stringify(items, null, 2)
    );
    all.push(...items);
    console.log(
      JSON.stringify({ mode, page: index + 1, cases: all.length, outcomes: countOutcomes(items) })
    );
  }
  writeFileSync(
    join(directory, "application-summary.json"),
    JSON.stringify({ cases: all.length, outcomes: countOutcomes(all) }, null, 2)
  );
}
