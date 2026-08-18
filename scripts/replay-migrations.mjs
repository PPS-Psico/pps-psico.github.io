import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(rootDir, "supabase/migrations");
const platformCompatPath = resolve(
  rootDir,
  "supabase/reference/bootstrap/platform/supabase_platform_compat.sql"
);
const bootstrapPath = resolve(
  rootDir,
  "supabase/reference/bootstrap/20251217_initial_public_schema.sql"
);
const overlaysDir = resolve(rootDir, "supabase/reference/bootstrap/overlays");
const testsDir = resolve(rootDir, "supabase/tests");
const image = process.env.MIGRATION_REPLAY_IMAGE ?? "public.ecr.aws/supabase/postgres:17.6.1.063";
const containerName = `consulta-pps-migration-replay-${process.pid}-${randomUUID().slice(0, 8)}`;
const filenamePattern = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/;
const runContracts = process.argv.includes("--contracts");
const inventoryArg = process.argv.indexOf("--inventory-out");
const inventoryOutput = inventoryArg === -1 ? null : process.argv[inventoryArg + 1];
if (inventoryArg !== -1 && !inventoryOutput) {
  throw new Error("--inventory-out requiere una ruta de salida.");
}

const portableContracts = [
  "analytics_v1_contract.sql",
  "director_report_v1_contract.sql",
  "interview_completion_candidates_v1_contract.sql",
  "selection_close_contract.sql",
  "online_practice_classification_contract.sql",
];

function redact(value = "") {
  return value
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/Bearer\s+[^\s'\"]+/gi, "Bearer [REDACTED]");
}

function docker(args, options = {}) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function requireSuccess(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = redact([result.stdout, result.stderr].filter(Boolean).join("\n").trim());
    throw new Error(`${context}${detail ? `\n${detail}` : ""}`);
  }
  return result;
}

async function sqlEntries(directory, kind) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  return files.map((file) => {
    const match = filenamePattern.exec(file);
    if (!match) throw new Error(`${kind} con nombre inválido: ${file}`);
    return {
      kind,
      version: match[1],
      name: match[2],
      file,
      path: resolve(directory, file),
    };
  });
}

function psql(sql, context, { tuplesOnly = false } = {}) {
  const args = [
    "exec",
    "-i",
    containerName,
    "psql",
    "-X",
    "--set",
    "ON_ERROR_STOP=1",
    "--username",
    "supabase_admin",
    "--dbname",
    "postgres",
    "--quiet",
  ];
  if (tuplesOnly) args.push("--tuples-only", "--no-align");
  const result = docker(args, { input: sql });
  return requireSuccess(result, context).stdout.trim();
}

async function replaySql(entry) {
  const sql = await readFile(entry.path, "utf8");
  if (entry.kind !== "migration") return sql;

  if (entry.version === "20260717211849" || entry.version === "20260717225419") {
    return "-- Schema-only replay: product-data reconciliation intentionally skipped.\n";
  }

  if (entry.version === "20260717212308") {
    const dataMarker = "insert into private.historical_launch_sources";
    const markerIndex = sql.toLowerCase().indexOf(dataMarker);
    if (markerIndex === -1) throw new Error(`No se encontró el límite DDL/DML en ${entry.file}.`);
    return `${sql.slice(0, markerIndex)}\ncommit;\n`;
  }

  if (entry.version === "20260717225039") {
    return `begin;
      alter table private.historical_launch_offers
        add column if not exists reviewed_at timestamptz,
        add column if not exists review_resolution text;
      comment on column private.historical_launch_offers.reviewed_at is
        'Fecha de resolución humana/documental de la observación de reconstrucción.';
      comment on column private.historical_launch_offers.review_resolution is
        'Resolución auditada; conserva la diferencia entre oferta canónica y filas legacy.';
      commit;`;
  }

  return sql;
}

async function applyFile(entry) {
  const sql = await replaySql(entry);
  psql(sql, `Falló ${entry.kind} ${entry.file}`);

  if (entry.kind === "migration") {
    psql(
      `insert into supabase_migrations.schema_migrations (version, statements, name)\n` +
        `values ('${entry.version}', array[]::text[], '${entry.name}');`,
      `No se pudo registrar ${entry.file}`
    );
  }
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const logs = docker(["logs", containerName]);
    const initialized = `${logs.stdout ?? ""}\n${logs.stderr ?? ""}`.includes(
      "PostgreSQL init process complete; ready for start up."
    );
    const readiness = docker([
      "exec",
      containerName,
      "pg_isready",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
    ]);
    if (initialized && readiness.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error("El PostgreSQL descartable no completó su bootstrap dentro de 180 segundos.");
}

async function main() {
  requireSuccess(docker(["info"]), "Docker no está disponible");

  const migrations = await sqlEntries(migrationsDir, "migration");
  const overlays = await sqlEntries(overlaysDir, "overlay");
  const canonicalVersions = new Set(migrations.map(({ version }) => version));
  const collision = overlays.find(({ version }) => canonicalVersions.has(version));
  if (collision) {
    throw new Error(`El overlay ${collision.file} colisiona con una migración canónica.`);
  }

  const timeline = [...migrations, ...overlays].sort((left, right) =>
    left.version.localeCompare(right.version)
  );

  console.log(
    `Replay aislado: ${migrations.length} migraciones, ${overlays.length} overlays, PostgreSQL 17.6.`
  );

  requireSuccess(
    docker([
      "run",
      "--detach",
      "--name",
      containerName,
      "--label",
      "consulta-pps-purpose=migration-replay",
      "--network",
      "none",
      "--env",
      "POSTGRES_PASSWORD=replay-local-only",
      "--env",
      "POSTGRES_DB=postgres",
      image,
      "postgres",
      "-c",
      "shared_preload_libraries=pg_stat_statements,pg_cron,pg_net",
      "-c",
      "cron.launch_active_jobs=off",
    ]),
    "No se pudo iniciar el contenedor descartable"
  );

  waitForPostgres();

  const platformCompat = await readFile(platformCompatPath, "utf8");
  psql(platformCompat, `Falló la compatibilidad ${basename(platformCompatPath)}`);

  const bootstrap = await readFile(bootstrapPath, "utf8");
  psql(bootstrap, `Falló el baseline ${basename(bootstrapPath)}`);
  psql(
    `create schema if not exists supabase_migrations;\n` +
      `create table if not exists supabase_migrations.schema_migrations (\n` +
      `  version text primary key, statements text[], name text\n` +
      `);\n` +
      `truncate table supabase_migrations.schema_migrations;`,
    "No se pudo preparar el ledger local"
  );

  let applied = 0;
  for (const entry of timeline) {
    await applyFile(entry);
    if (entry.kind === "migration") {
      applied += 1;
      if (applied % 10 === 0 || applied === migrations.length) {
        console.log(`  ${applied}/${migrations.length} migraciones aplicadas`);
      }
    } else {
      console.log(`  overlay local ${entry.version} aplicado`);
    }
  }

  const summary = psql(
    `select json_build_object(\n` +
      `  'server_version', current_setting('server_version'),\n` +
      `  'canonical_migrations', (select count(*) from supabase_migrations.schema_migrations),\n` +
      `  'public_tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')),\n` +
      `  'public_functions', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),\n` +
      `  'rls_policies', (select count(*) from pg_policies where schemaname = 'public'),\n` +
      `  'foreign_keys', (select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f'),\n` +
      `  'cron_jobs', (select count(*) from cron.job),\n` +
      `  'cron_execution_disabled', current_setting('cron.launch_active_jobs')\n` +
      `);`,
    "No se pudo generar el resumen del replay",
    { tuplesOnly: true }
  );

  const replayCount = Number(
    psql(
      "select count(*) from supabase_migrations.schema_migrations;",
      "No se pudo verificar el ledger local",
      { tuplesOnly: true }
    )
  );
  if (replayCount !== migrations.length) {
    throw new Error(`Ledger incompleto: ${replayCount}/${migrations.length} migraciones.`);
  }

  if (inventoryOutput) {
    const inventory = psql(
      `select json_build_object(
        'public_tables', (select coalesce(json_agg(x order by x), '[]'::json) from (select c.relname as x from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) q),
        'public_columns', (select coalesce(json_agg(x order by x), '[]'::json) from (select table_name || '|' || column_name || '|' || udt_name || '|' || is_nullable as x from information_schema.columns where table_schema='public') q),
        'public_functions', (select coalesce(json_agg(x order by x), '[]'::json) from (select p.oid::regprocedure::text || '|' || p.prokind::text || '|' || p.prosecdef::text as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') q),
        'public_policies', (select coalesce(json_agg(x order by x), '[]'::json) from (select tablename || '|' || policyname || '|' || cmd || '|' || roles::text as x from pg_policies where schemaname='public') q),
        'public_constraints', (select coalesce(json_agg(x order by x), '[]'::json) from (select c.conrelid::regclass::text || '|' || c.conname || '|' || c.contype::text as x from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public') q),
        'storage_columns', (select coalesce(json_agg(x order by x), '[]'::json) from (select table_name || '|' || column_name || '|' || udt_name || '|' || is_nullable as x from information_schema.columns where table_schema='storage' and table_name in ('buckets','objects')) q),
        'storage_policies', (select coalesce(json_agg(x order by x), '[]'::json) from (select tablename || '|' || policyname || '|' || cmd || '|' || roles::text as x from pg_policies where schemaname='storage') q),
        'cron_jobs', (select coalesce(json_agg(x order by x), '[]'::json) from (select jobname || '|' || schedule || '|' || active::text as x from cron.job) q)
      );`,
      "No se pudo generar el inventario local",
      { tuplesOnly: true }
    );
    const outputPath = resolve(rootDir, inventoryOutput);
    await writeFile(outputPath, `${inventory}\n`, "utf8");
    console.log(`  inventario local escrito en ${outputPath}`);
  }

  if (runContracts) {
    const fixtureUserId = randomUUID();
    const fixtureStudentId = randomUUID();
    psql(
      `insert into auth.users (id) values ('${fixtureUserId}');\n` +
        `insert into public.estudiantes (id, legajo, nombre, role, estado, user_id)\n` +
        `values ('${fixtureStudentId}', 'REPLAY-STAFF', '[REPLAY] Staff', 'SuperUser', 'Inactivo', '${fixtureUserId}');`,
      "No se pudo crear la sesión sintética para contratos"
    );
    const session =
      `select set_config('request.jwt.claim.sub', '${fixtureUserId}', false);\n` +
      `select set_config('request.jwt.claim.role', 'authenticated', false);\n`;

    for (const contract of portableContracts) {
      const sql = await readFile(resolve(testsDir, contract), "utf8");
      psql(session + sql, `Falló el contrato portable ${contract}`);
      console.log(`  contrato portable ${contract}: OK`);
    }
  }

  console.log(`Replay completo: ${summary}`);
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(redact(error instanceof Error ? error.message : String(error)));
  const logs = docker(["logs", "--tail", "80", containerName]);
  if (logs.status === 0) console.error(redact(logs.stdout + logs.stderr));
} finally {
  const cleanup = docker(["rm", "--force", containerName]);
  if (cleanup.status !== 0 && !cleanup.stderr?.includes("No such container")) {
    exitCode = 1;
    console.error(redact(`No se pudo eliminar ${containerName}: ${cleanup.stderr}`));
  }
}

process.exitCode = exitCode;
