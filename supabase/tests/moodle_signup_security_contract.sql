begin;

select plan(9);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.moodle_signup_tickets'::regclass),
  'moodle signup tickets have RLS enabled'
);

select is(
  has_table_privilege('anon', 'public.moodle_signup_tickets', 'SELECT'),
  false,
  'anonymous users cannot read Moodle signup tickets'
);

select is(
  has_table_privilege('authenticated', 'public.moodle_signup_tickets', 'INSERT'),
  false,
  'authenticated users cannot mint Moodle signup tickets'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.register_new_student(text,uuid,bigint,text,text)',
    'EXECUTE'
  ),
  false,
  'legacy student registration is closed to authenticated clients'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.register_campus_student(text,uuid,bigint,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'legacy campus registration is closed to authenticated clients'
);

select is(
  has_function_privilege(
    'anon',
    'public.complete_moodle_student_signup(text,uuid,text,bigint,text)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot consume Moodle signup tickets'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.complete_moodle_student_signup(text,uuid,text,bigint,text)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot consume Moodle signup tickets directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.complete_moodle_student_signup(text,uuid,text,bigint,text)',
    'EXECUTE'
  ),
  true,
  'only the signup service can consume Moodle tickets through the public wrapper'
);

select is(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.complete_moodle_student_signup(text,uuid,text,bigint,text)'::regprocedure
  ),
  false,
  'the exposed signup wrapper is security invoker'
);

select * from finish();
rollback;
