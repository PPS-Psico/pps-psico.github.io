begin;

select plan(16);

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

select * from finish();
rollback;
