import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const name = `pps-evidence-contract-${randomUUID().slice(0, 8)}`;
function docker(args, input) {
  const result = spawnSync("docker", args, {
    input,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || result.error?.message || "Docker failed");
  return result.stdout;
}
function sql(source) {
  return docker(
    ["exec", "-i", name, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    source
  );
}
try {
  docker([
    "run",
    "--detach",
    "--name",
    name,
    "--network",
    "none",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17-alpine",
  ]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      docker(["exec", name, "pg_isready", "-U", "postgres"]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("Isolated Postgres did not start");
  sql(readFileSync("supabase/tests/fixtures/moodle_evidence_schema.sql", "utf8"));
  sql(readFileSync("supabase/migrations/20260905132925_moodle_evidence_inbox.sql", "utf8"));
  sql(readFileSync("supabase/migrations/20260906001008_moodle_partial_scan_coverage.sql", "utf8"));
  sql(
    readFileSync(
      "supabase/migrations/20260906142427_moodle_expected_negative_observations.sql",
      "utf8"
    )
  );
  const actor = randomUUID();
  sql(
    `insert into auth.users(id) values ('${actor}'); insert into public.estudiantes(id,user_id,role,nombre) values(gen_random_uuid(),'${actor}','SuperUser','[TEST] Coordinator');`
  );
  sql(
    `select set_config('request.jwt.claim.sub','${actor}',false); select set_config('request.jwt.claim.role','authenticated',false);\n` +
      readFileSync("supabase/tests/moodle_evidence_inbox_contract.sql", "utf8")
  );
  console.log("Moodle evidence SQL contract: PASS (isolated PostgreSQL 17; synthetic data)");
  sql(readFileSync("supabase/tests/fixtures/moodle_application_schema.sql", "utf8"));
  sql(readFileSync("supabase/migrations/20260906005856_moodle_evidence_application.sql", "utf8"));
  sql(
    `select set_config('request.jwt.claim.sub','${actor}',false);\n` +
      readFileSync("supabase/tests/moodle_evidence_application_contract.sql", "utf8")
  );
  console.log("Moodle application SQL contract: PASS (isolated PostgreSQL 17; synthetic data)");
} finally {
  docker(["rm", "--force", name]);
}
