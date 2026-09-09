import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Produce reviewable scripts; neither script is executed by this helper.
const file = process.argv[2] ?? "20260905132925_moodle_evidence_inbox";
const match = /^(\d{14})_([a-z0-9_]+)$/.exec(file);
if (!match) throw new Error("Invalid migration name");
const [, version, name] = match;
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
if (!/^begin;/i.test(migration.trim()) || !/commit;\s*$/i.test(migration))
  throw new Error("Expected transactional migration");
const directory = `artifacts/moodle-evidence/${version}`;
mkdirSync(directory, { recursive: true });
const checks = (name === "moodle_evidence_scan_queue" ? `
do $$ begin
  if (select count(*) from private.moodle_evidence_allowed_tasks_v1(array['clinica'])) < 1 then
    raise exception 'Empty clinical authorization catalog';
  end if;
  if exists(select 1 from private.moodle_evidence_allowed_tasks_v1(array['clinica']) where not (area_keys <@ array['clinica'])) then
    raise exception 'Queue expanded authorized area';
  end if;
end $$;
` : "") + `
do $$ begin
  if (select count(*) from private.moodle_evidence_versions where legacy_observation_id is not null)
     <> (select count(*) from public.moodle_grade_observations) then
    raise exception 'Historical evidence coverage mismatch';
  end if;
end $$;
select jsonb_build_object('cases',(select count(*) from private.moodle_evidence_cases),
  'versions',(select count(*) from private.moodle_evidence_versions),
  'legacy',(select count(*) from public.moodle_grade_observations),
  'decisions',(select count(*) from private.moodle_evidence_decisions)) as evidence_verification;
`;
const ledger = `
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${version}','${name}',array[$moodle_evidence_sql$${migration}$moodle_evidence_sql$]);
`;
writeFileSync(
  `${directory}/rehearsal.sql`,
  migration.replace(/commit;\s*$/i, () => checks + "rollback;\n")
);
writeFileSync(
  `${directory}/apply.sql`,
  migration.replace(/commit;\s*$/i, () => checks + ledger + "commit;\n")
);
console.log(`Prepared ${directory}/rehearsal.sql and apply.sql; no SQL executed.`);
