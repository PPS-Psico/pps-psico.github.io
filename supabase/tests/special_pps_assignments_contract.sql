-- Functional and security contract for exceptional PPS assignments.
-- All fixtures are isolated and rolled back.

begin;

set local statement_timeout = '20s';
set local lock_timeout = '5s';

select set_config('pps_test.special_student_id', gen_random_uuid()::text, true);
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
    raise exception 'Special PPS contract requires one SuperUser/AdminTester with user_id';
  end if;
end;
$$;

insert into public.estudiantes (id, legajo, nombre, apellido_separado, dni, correo, role, estado)
values (
  current_setting('pps_test.special_student_id')::uuid,
  'TEST-SPECIAL-PPS', '[TEST] PPS', 'Especial', 99977666,
  'special.pps.contract@example.invalid', 'Alumno', 'Activo'
);

insert into public.aula_entregas (
  id, area, institucion, moodle_id, activo, course_id, academic_year, moodle_name
)
overriding system value
values (
  1999999901, 'laboral', '[TEST] Entrevistas a Profesionales',
  '1999999901', true, 3615, 2099, '[TEST] Entrevistas a Profesionales'
);

set local role authenticated;

do $$
declare
  v_student uuid := current_setting('pps_test.special_student_id')::uuid;
  v_catalog_id bigint := 1999999901;
  v_result jsonb;
  v_practice uuid;
  v_assignment uuid;
begin
  perform public.set_special_pps_task_v1(
    'entrevistas_profesionales', 'laboral_comunitaria', 2099::smallint, v_catalog_id
  );

  v_result := public.assign_special_pps_v1(
    v_student, 'entrevistas_profesionales', 'comunitaria', 2099::smallint, 20
  );
  v_practice := (v_result ->> 'practica_id')::uuid;
  v_assignment := (v_result ->> 'assignment_id')::uuid;

  if not exists (
    select 1
    from public.practicas p
    where p.id = v_practice
      and p.tipo_actividad = 'actividad_especial'
      and p.especialidad = 'Comunitaria'
      and p.fecha_inicio is null
      and p.fecha_finalizacion is null
  ) then
    raise exception 'The exceptional practice was not created with the expected contract';
  end if;

  if not exists (
    select 1
    from public.practica_moodle_tareas pmt
    join public.aula_entregas ae on ae.id = pmt.aula_entrega_id
    where pmt.practica_id = v_practice
      and pmt.validation_status = 'confirmed'
      and ae.moodle_id = '1999999901'
  ) then
    raise exception 'Community did not resolve to the shared Laboral/Community task';
  end if;

  begin
    perform public.assign_special_pps_v1(
      v_student, 'entrevistas_profesionales', 'laboral', 2099::smallint, 20
    );
    raise exception 'A duplicate active annual assignment was accepted';
  exception when unique_violation then null;
  end;

  if not public.cancel_special_pps_assignment_v1(v_assignment, 'Contract test') then
    raise exception 'The exceptional assignment could not be cancelled';
  end if;

  if exists (
    select 1 from public.practica_moodle_tareas pmt where pmt.practica_id = v_practice
  ) then
    raise exception 'Cancellation did not remove the exact Moodle task link';
  end if;

  if not exists (
    select 1
    from public.practicas p
    where p.id = v_practice and p.estado = 'No se pudo concretar'
  ) then
    raise exception 'Cancellation did not move the practice to the supported terminal state';
  end if;
end;
$$;

reset role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.special_pps_task_catalog'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.special_pps_assignments'::regclass) then
    raise exception 'Special PPS tables must have RLS enabled';
  end if;

  if has_table_privilege('authenticated', 'public.special_pps_task_catalog', 'INSERT')
     or has_table_privilege('authenticated', 'public.special_pps_task_catalog', 'UPDATE')
     or has_table_privilege('authenticated', 'public.special_pps_assignments', 'INSERT')
     or has_table_privilege('authenticated', 'public.special_pps_assignments', 'UPDATE') then
    raise exception 'Authenticated clients must not write special PPS tables directly';
  end if;
end;
$$;

rollback;
