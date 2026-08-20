-- Functional and security contract for Moodle Task Automation v2.
-- All fixtures are isolated and rolled back.

begin;

set local statement_timeout = '20s';
set local lock_timeout = '5s';

select set_config('pps_test.moodle_v2_launch_id', gen_random_uuid()::text, true);
select set_config('pps_test.moodle_v2_student_id', gen_random_uuid()::text, true);
select set_config('pps_test.moodle_v2_practice_id', gen_random_uuid()::text, true);
select set_config('pps_test.moodle_v2_worker_token', gen_random_uuid()::text, true);
select set_config(
  'request.jwt.claim.sub',
  (
    select e.user_id::text
    from public.estudiantes e
    where e.user_id is not null and e.role in ('SuperUser', 'AdminTester')
    order by (e.role = 'SuperUser') desc, e.created_at desc nulls last
    limit 1
  ),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if nullif(current_setting('request.jwt.claim.sub', true), '') is null then
    raise exception 'Moodle v2 contract requires one SuperUser/AdminTester with user_id';
  end if;
end;
$$;

insert into public.estudiantes (id, legajo, nombre, apellido_separado, dni, correo, role, estado)
values (
  current_setting('pps_test.moodle_v2_student_id')::uuid,
  'TEST-MOODLE-V2', '[TEST] Moodle', 'V2', 99988777,
  'moodle.v2.contract@example.invalid', 'Alumno', 'Activo'
);

insert into public.lanzamientos_pps (
  id, nombre_pps, orientacion, fecha_inicio, fecha_finalizacion,
  estado_convocatoria, tipo_actividad, modalidad_cupo
)
values (
  current_setting('pps_test.moodle_v2_launch_id')::uuid,
  '[TEST] PPS Moodle v2', 'Clínica', '2099-03-01', '2099-07-01',
  'Confirmacion', 'pps', 'fijo'
);

insert into public.practicas (
  id, lanzamiento_id, estudiante_id, especialidad, estado,
  fecha_inicio, fecha_finalizacion, tipo_actividad
)
values (
  current_setting('pps_test.moodle_v2_practice_id')::uuid,
  current_setting('pps_test.moodle_v2_launch_id')::uuid,
  current_setting('pps_test.moodle_v2_student_id')::uuid,
  'Clínica', 'En curso', '2099-03-01', '2099-07-01', 'pps'
);

set local role authenticated;

do $$
declare
  v_launch_id uuid := current_setting('pps_test.moodle_v2_launch_id')::uuid;
  v_worker_token uuid := current_setting('pps_test.moodle_v2_worker_token')::uuid;
  v_result jsonb;
  v_intent public.moodle_task_intents%rowtype;
  v_claimed public.moodle_task_intents%rowtype;
  v_confirmation jsonb;
  v_summary record;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'The simulated coordinator session was not authorized';
  end if;

  update public.lanzamientos_pps
  set estado_convocatoria = 'Activa'
  where id = v_launch_id;

  -- The activation trigger must create the unit and its expected roster in the
  -- same transaction as the state change.
  v_result := public.reconcile_moodle_task_intents_v1(v_launch_id);
  if (v_result ->> 'intents_created')::integer <> 0
     or (v_result ->> 'intents_updated')::integer <> 1
     or (v_result ->> 'participants_synced')::integer <> 1 then
    raise exception 'Activation did not reconcile the intent idempotently: %', v_result;
  end if;

  v_result := public.reconcile_moodle_task_intents_v1(v_launch_id);
  if (v_result ->> 'intents_created')::integer <> 0
     or (v_result ->> 'intents_updated')::integer <> 1 then
    raise exception 'Reconciliation is not idempotent: %', v_result;
  end if;

  select * into strict v_intent
  from public.moodle_task_intents i
  where i.lanzamiento_id = v_launch_id and i.orientacion_key = 'clinica';

  if v_intent.mode <> 'dedicated'
     or v_intent.stable_key <> 'PPS:' || v_launch_id::text || ':clinica'
     or v_intent.provisioning_status <> 'pending' then
    raise exception 'Dedicated intent contract is invalid: %', row_to_json(v_intent);
  end if;

  select * into strict v_claimed
  from public.claim_moodle_task_intent_lease_v1(1, 300, v_worker_token);
  if v_claimed.id <> v_intent.id
     or v_claimed.lease_token <> v_worker_token
     or v_claimed.provisioning_status <> 'claimed' then
    raise exception 'Lease claim returned an invalid intent';
  end if;

  begin
    perform public.confirm_moodle_task_intent_v1(
      v_intent.id, gen_random_uuid(), 1999999998, 3615,
      v_intent.stable_key, v_intent.desired_name,
      v_intent.desired_description_html, v_intent.desired_open_at,
      v_intent.desired_due_at, v_intent.desired_cutoff_at,
      v_intent.desired_grade_mode, v_intent.desired_grade_max,
      v_intent.desired_section_key, v_intent.desired_visibility, '{}'::jsonb
    );
    raise exception 'Confirmation accepted a foreign lease token';
  exception when insufficient_privilege then null;
  end;

  v_confirmation := public.confirm_moodle_task_intent_v1(
    v_intent.id, v_worker_token, 1999999999, 3615,
    v_intent.stable_key, v_intent.desired_name,
    v_intent.desired_description_html, v_intent.desired_open_at,
    v_intent.desired_due_at, v_intent.desired_cutoff_at,
    v_intent.desired_grade_mode, v_intent.desired_grade_max,
    v_intent.desired_section_key, v_intent.desired_visibility,
    jsonb_build_object('contract_test', true)
  );

  if not coalesce((v_confirmation ->> 'verified')::boolean, false) then
    raise exception 'Valid confirmation was rejected: %', v_confirmation;
  end if;

  select * into strict v_summary
  from public.get_moodle_task_unit_summaries_v1(v_launch_id, 'clinica');
  if v_summary.total_expected <> 1
     or v_summary.total_missing <> 1
     or v_summary.total_submitted <> 0
     or v_summary.total_settled <> 0 then
    raise exception 'Unexpected canonical summary: %', row_to_json(v_summary);
  end if;

  if exists (
    select 1 from public.claim_moodle_task_intent_lease_v1(1, 300, gen_random_uuid())
    where id = v_intent.id
  ) then
    raise exception 'A verified intent was claimable again';
  end if;
end;
$$;

reset role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.moodle_task_intents'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.moodle_task_expected_participants'::regclass) then
    raise exception 'Public Moodle v2 tables must have RLS enabled';
  end if;

  if has_table_privilege('authenticated', 'public.moodle_task_intents', 'INSERT')
     or has_table_privilege('authenticated', 'public.moodle_task_intents', 'UPDATE')
     or has_table_privilege('authenticated', 'public.moodle_task_expected_participants', 'INSERT')
     or has_table_privilege('authenticated', 'public.moodle_task_expected_participants', 'UPDATE') then
    raise exception 'Authenticated clients must not write canonical tables directly';
  end if;

  if has_table_privilege('authenticated', 'private.moodle_agent_runs', 'SELECT')
     or has_table_privilege('authenticated', 'private.moodle_agent_run_items', 'SELECT') then
    raise exception 'Agent audit tables must remain private';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'private' and tablename = 'moodle_agent_runs'
      and 'service_role' = any(roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'private' and tablename = 'moodle_agent_run_items'
      and 'service_role' = any(roles)
  ) then
    raise exception 'Private agent ledgers require explicit service_role policies';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'moodle_task_expected_practice_idx'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'moodle_task_expected_replacement_idx'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'moodle_task_expected_created_by_idx'
  ) then
    raise exception 'Expected participant foreign keys require covering indexes';
  end if;

  if has_function_privilege('anon', 'public.reconcile_moodle_task_intents_v1(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.claim_moodle_task_intent_lease_v1(integer,integer,uuid)', 'EXECUTE')
     or has_function_privilege(
       'anon',
       'public.confirm_moodle_task_intent_v1(uuid,uuid,bigint,bigint,text,text,text,timestamptz,timestamptz,timestamptz,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege('anon', 'public.get_moodle_task_unit_summaries_v1(uuid,text)', 'EXECUTE') then
    raise exception 'Anonymous users can execute a Moodle v2 RPC';
  end if;

  if (select prosecdef from pg_proc where oid = 'public.reconcile_moodle_task_intents_v1(uuid)'::regprocedure)
     or (select prosecdef from pg_proc where oid = 'public.claim_moodle_task_intent_lease_v1(integer,integer,uuid)'::regprocedure)
     or (select prosecdef from pg_proc where oid = 'public.get_moodle_task_unit_summaries_v1(uuid,text)'::regprocedure) then
    raise exception 'Public Moodle v2 RPCs must be SECURITY INVOKER';
  end if;

  if not (select prosecdef from pg_proc where oid = 'private.reconcile_moodle_task_intents_v1_impl(uuid)'::regprocedure)
     or not (select prosecdef from pg_proc where oid = 'private.claim_moodle_task_intent_lease_v1_impl(integer,integer,uuid)'::regprocedure)
     or not (select prosecdef from pg_proc where oid = 'private.confirm_moodle_task_intent_v1_impl(uuid,uuid,bigint,bigint,text,text,text,timestamptz,timestamptz,timestamptz,text,numeric,text,text,jsonb)'::regprocedure) then
    raise exception 'Privileged Moodle v2 implementation functions must be SECURITY DEFINER';
  end if;

  if exists (
    select 1
    from public.moodle_task_expected_participants ep
    join public.moodle_task_intents i on i.id = ep.intent_id
    join public.practicas p on p.id = ep.practica_id
    where private.moodle_orientation_key(p.especialidad) is not null
      and private.moodle_orientation_key(p.especialidad) <> i.orientacion_key
  ) then
    raise exception 'A participant was backfilled into the wrong orientation';
  end if;

  if exists (
    select 1
    from public.moodle_task_expected_participants ep
    join public.moodle_task_intents i on i.id = ep.intent_id
    join public.practicas p on p.id = ep.practica_id
    where private.moodle_orientation_key(p.especialidad) is null
      and (select count(*) from public.moodle_task_intents sibling
           where sibling.lanzamiento_id = i.lanzamiento_id
             and sibling.provisioning_status <> 'cancelled') <> 1
  ) then
    raise exception 'An ambiguous participant was assigned to a multi-orientation launch';
  end if;
end;
$$;

set local role authenticated;
do $$
begin
  begin
    perform 1 from private.moodle_agent_runs limit 1;
    raise exception 'Authenticated unexpectedly read private.moodle_agent_runs';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
