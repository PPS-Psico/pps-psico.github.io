begin;

select plan(44);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.moodle_grade_observations'::regclass),
  'moodle_grade_observations has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.moodle_grade_snapshots'::regclass),
  'moodle_grade_snapshots has RLS enabled'
);

select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'moodle_grade_observations'
      and column_name = 'lanzamiento_id'
  ),
  'YES',
  'direct practice observations may preserve a null launch'
);

select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'moodle_grade_snapshots'
      and column_name = 'lanzamiento_id'
  ),
  'YES',
  'direct practice snapshots may preserve a null launch'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_grade_observations', 'INSERT'),
  false,
  'authenticated cannot insert observations directly'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_grade_observations', 'UPDATE'),
  false,
  'authenticated cannot update the observation ledger'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_grade_observations', 'DELETE'),
  false,
  'authenticated cannot delete from the observation ledger'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_grade_snapshots', 'INSERT'),
  false,
  'authenticated cannot insert snapshots directly'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_grade_snapshots', 'UPDATE'),
  false,
  'authenticated cannot update snapshots directly'
);

select like(
  pg_get_functiondef('public.check_practica_updates()'::regprocedure),
  '%to_jsonb(new) - ''fecha_finalizacion''%',
  'student practice updates are fail-closed except fecha_finalizacion'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.finalizacion_pps'::regclass
      and tgname = 'strip_student_declared_finalization_grades_trigger'
      and not tgisinternal
  ),
  'student-declared finalization grades are stripped by a trigger'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.get_moodle_grade_discrepancies()'::regprocedure),
  false,
  'the discrepancy report is security invoker'
);

select is(
  has_function_privilege('anon', 'public.get_moodle_grade_discrepancies()', 'EXECUTE'),
  false,
  'anonymous users cannot execute the discrepancy report'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.strip_student_declared_finalization_grades()',
    'EXECUTE'
  ),
  false,
  'the finalization trigger helper is not exposed as an authenticated RPC'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'practicas'
      and cmd = 'DELETE'
  ),
  1::bigint,
  'only the admin DELETE policy remains on practicas'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in ('moodle_grade_observations', 'moodle_grade_snapshots')
      and cmd = 'SELECT'
  ),
  2,
  'each Moodle grade table has one combined SELECT policy'
);

select ok(
  to_regclass('private.moodle_grade_applications') is not null,
  'automatic Moodle grade applications have an audit ledger'
);

select is(
  has_table_privilege('authenticated', 'private.moodle_grade_applications', 'SELECT'),
  false,
  'authenticated cannot read the private application ledger directly'
);

select is(
  has_table_privilege('authenticated', 'private.moodle_grade_applications', 'INSERT'),
  false,
  'authenticated cannot forge grade applications'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.apply_moodle_grade_observation()',
    'EXECUTE'
  ),
  false,
  'authenticated cannot invoke the grade application trigger helper'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.moodle_grade_observations'::regclass
      and tgname = 'apply_moodle_grade_observation_trigger'
      and not tgisinternal
  ),
  'graded observations invoke the automatic application trigger'
);

select like(
  pg_get_functiondef('private.apply_moodle_grade_observation()'::regprocedure),
  '%grade_conversion_mode%',
  'the trigger resolves grades through the explicit task conversion mode'
);

select is(
  private.moodle_grade_status_rank('graded'),
  4::smallint,
  'graded is the terminal Moodle snapshot state'
);

select is(
  private.moodle_grade_status_rank('submitted'),
  3::smallint,
  'submitted outranks non-submission and parser failures'
);

select is(
  private.moodle_grade_status_rank('not_submitted'),
  2::smallint,
  'a confirmed non-submission outranks parser failures'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.moodle_grade_status_rank(text)',
    'EXECUTE'
  ),
  false,
  'the private Moodle status helper is not exposed as an RPC'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.moodle_grade_snapshots'::regclass
      and tgname = 'preserve_moodle_grade_snapshot_progress_trigger'
      and not tgisinternal
  ),
  'snapshot updates invoke the monotonic progress guard'
);

select like(
  pg_get_functiondef('private.apply_moodle_grade_observation()'::regprocedure),
  '%private.moodle_grade_finalizations%',
  'a practice-task-revision finalization is terminal'
);

select is(
  (select count(*) from public.aula_entregas where activo and grade_conversion_mode is null),
  0::bigint,
  'every active Moodle task has an explicit conversion mode'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'practicas'
      and column_name = 'informe_estado'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'practicas'
      and column_name = 'nota_moodle'
  ),
  'delivery state and Moodle grade are separate practice fields'
);

select is(
  (select is_nullable from information_schema.columns
   where table_schema = 'public' and table_name = 'moodle_grade_snapshots'
     and column_name = 'last_observation_id'),
  'NO',
  'every snapshot preserves its last real observation'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.moodle_sync_runs'::regclass),
  'Moodle sync runs have RLS enabled'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_sync_runs', 'INSERT'),
  false,
  'authenticated clients cannot forge sync runs'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.moodle_grade_reopen_events'::regclass),
  'grade reopen events have RLS enabled'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_grade_reopen_events', 'UPDATE'),
  false,
  'reopen events are append-only for authenticated clients'
);

select ok(
  to_regclass('private.moodle_grade_finalizations') is not null,
  'terminal grade revisions have a unique private lock table'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.get_finalization_grade_resolution(uuid)'::regprocedure),
  false,
  'finalization grade resolution is security invoker'
);

select is(
  has_function_privilege('anon', 'public.get_finalization_grade_resolution(uuid)', 'EXECUTE'),
  false,
  'anonymous users cannot resolve finalization grades'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.get_moodle_unlinked_practices(integer)'::regprocedure),
  false,
  'the linkage backlog report is security invoker'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'moodle_grade_observations'
     and cmd = 'SELECT' and policyname = 'Admins read Moodle observations'),
  1::bigint,
  'only staff can read the technical observation ledger'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.moodle_grade_import_batches'::regclass),
  'bulk Moodle import batches have RLS enabled'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_grade_import_batches', 'INSERT'),
  false,
  'authenticated clients cannot forge bulk import audit batches'
);

select like(
  pg_get_functiondef('public.get_moodle_grade_discrepancies()'::regprocedure),
  '%grade_conversion_mode%',
  'the discrepancy report uses the explicit task scale contract'
);

select like(
  pg_get_functiondef('public.get_finalization_grade_resolution(uuid)'::regprocedure),
  '%nota_fuente is null or p.nota_fuente = ''legacy'' then null%',
  'finalization never promotes untrusted legacy notes to an academic source'
);

select * from finish();
rollback;
