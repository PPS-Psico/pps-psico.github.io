-- Reconciliación y privilegios del panel de jefaturas de área.
do $$
declare
  v_area text;
  v_offers integer;
  v_expected integer;
  v_fixed integer;
  v_expected_fixed integer;
  v_report_total integer;
  v_report_parts integer;
  v_queue jsonb;
begin
  if (select count(*) from private.jefe_area_assignments) <> 4 then
    raise exception 'Se esperaban cuatro asignaciones área/DNI';
  end if;

  if (select count(*) from private.jefe_area_assignments where dni = 26777403) <> 2 then
    raise exception 'Cynthia debe tener Laboral y Comunitaria';
  end if;

  if (select count(distinct preview_key) from private.jefe_area_assignments) <> 3
     or exists (select 1 from private.jefe_area_assignments where preview_key is null) then
    raise exception 'Cada jefatura debe tener una clave opaca de simulación';
  end if;

  if (select count(*) from private.jefe_moodle_identities) <> 3 then
    raise exception 'Se esperaban tres identidades Moodle de jefatura';
  end if;

  if (
    select count(*)
    from private.jefe_moodle_identities
    where (dni, moodle_user_id) in (
      (13842270, 9386),
      (34052382, 2338),
      (26777403, 394)
    )
  ) <> 3 then
    raise exception 'No coincide el allowlist DNI/usuario Moodle de jefaturas';
  end if;

  foreach v_area in array array['clinica', 'educacional', 'laboral', 'comunitaria'] loop
    select count(*), coalesce(sum(fixed_capacity), 0)
    into v_offers, v_fixed
    from private.jefe_annual_offers_v1(array[v_area], 2024, date '2024-12-31');

    select count(*), coalesce(sum(offered_capacity) filter (where capacity_mode = 'fijo'), 0)
    into v_expected, v_expected_fixed
    from private.historical_launch_offers h
    where h.source_year = 2024
      and h.count_in_offer_metrics
      and private.jefe_text_has_area(h.orientation, v_area);

    if v_offers <> v_expected or v_fixed <> v_expected_fixed then
      raise exception 'No reconcilia el agregado 2024 para %', v_area;
    end if;
  end loop;

  select count(*) into v_report_total
  from private.jefe_report_rows_v1(array['clinica']);

  select coalesce(sum(n), 0) into v_report_parts
  from (
    select count(*) n
    from private.jefe_report_rows_v1(array['clinica'])
    group by report_status
  ) grouped;

  if v_report_total <> v_report_parts then
    raise exception 'La cola agregada no reconcilia con el detalle';
  end if;

  if private.jefe_report_status_v1(
    false,
    true,
    date '2026-06-18',
    date '2026-08-17'
  ) <> 'pending' then
    raise exception 'A los 60 días exactos el informe debe seguir pendiente';
  end if;

  if private.jefe_report_status_v1(
    false,
    true,
    date '2026-06-17',
    date '2026-08-17'
  ) <> 'stale' then
    raise exception 'A partir del día 61 el informe debe pasar a stale';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'moodle_grade_observations'
      and column_name = 'submitted_at'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'moodle_grade_snapshots'
      and column_name = 'submitted_at'
  ) then
    raise exception 'El ledger y el snapshot deben conservar la fecha real de entrega Moodle';
  end if;

  if pg_get_functiondef('private.jefe_report_rows_v1(text[])'::regprocedure)
       like '%min(o.observed_at)%'
     or pg_get_functiondef('private.jefe_report_rows_v1(text[])'::regprocedure)
       not like '%min(o.submitted_at)%' then
    raise exception 'La cola no debe confundir la fecha de observación con la fecha de entrega';
  end if;

  v_queue := private.reconcile_jefe_report_queue_v1(jsonb_build_object(
    'reports', jsonb_build_array(
      jsonb_build_object('report_status', 'pending', 'urgency', 'on_time'),
      jsonb_build_object('report_status', 'pending', 'urgency', 'undated')
    )
  )) -> 'queue';

  if (v_queue ->> 'pending')::integer <> 2
     or (v_queue ->> 'on_time')::integer <> 1
     or (v_queue ->> 'undated')::integer <> 1 then
    raise exception 'Las entregas sin fecha deben reconciliar separadas de las entregas en plazo';
  end if;

  if exists (select 1 from public.estudiantes where dni = 44684830)
     and not exists (
       select 1
       from private.jefe_report_rows_v1(array['educacional']) r
       join public.estudiantes e on e.id = r.estudiante_id
       where e.dni = 44684830
         and r.pps_name = 'Ministerio de Juventud, Deportes y Cultura'
         and r.submitted_at = timestamptz '2026-07-21 01:12:00-03'
         and r.deadline_at = date '2026-08-20'
     ) then
    raise exception 'La entrega informada de Santiago debe vencer el 20/08/2026';
  end if;

  if exists (select 1 from public.estudiantes where dni = 44684830)
     and not exists (
       select 1
       from private.jefe_report_rows_v1(array['educacional']) r
       join public.estudiantes e on e.id = r.estudiante_id
       where e.dni = 44684830
         and r.pps_name = 'Instituto de Formación Docente N6'
         and r.submitted_at = timestamptz '2026-08-04 15:17:00-03'
         and r.deadline_at = date '2026-09-03'
     ) then
    raise exception 'La segunda entrega de Santiago debe conservar la fecha real del 04/08/2026';
  end if;

  if exists (
    select 1
    from private.jefe_report_rows_v1(array['clinica', 'educacional', 'laboral', 'comunitaria'])
    where report_status = 'pending'
      and days_remaining < -60
  ) then
    raise exception 'Una entrega con más de 60 días de atraso no debe seguir pendiente';
  end if;

  if exists (
    select 1
    from private.jefe_report_rows_v1(array['clinica', 'educacional', 'laboral', 'comunitaria'])
    where report_status = 'stale'
      and (days_remaining is null or days_remaining >= -60)
  ) then
    raise exception 'El estado stale sólo corresponde después de 60 días de atraso';
  end if;

  if has_table_privilege('authenticated', 'private.jefe_area_assignments', 'select')
     or has_table_privilege('anon', 'private.jefe_area_assignments', 'select') then
    raise exception 'Las asignaciones privadas no deben ser consultables desde el cliente';
  end if;

  if has_function_privilege('anon', 'public.get_jefe_dashboard_v1(integer,date)', 'execute')
     or has_function_privilege('anon', 'public.update_jefe_report_grade_v1(uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.get_jefe_moodle_sync_tasks_v1()', 'execute')
     or has_function_privilege(
       'anon',
       'public.sync_jefe_moodle_reports_v1(uuid,bigint,integer,timestamptz,bigint,text,jsonb)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.get_jefe_moodle_sync_tasks_preview_v1(uuid)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.sync_jefe_moodle_reports_preview_v1(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)',
       'execute'
     )
     or has_function_privilege('anon', 'public.get_jefe_dashboard_preview_v1(bigint,integer,date)', 'execute')
     or has_function_privilege('anon', 'public.get_jefe_dashboard_preview_v2(uuid,integer,date)', 'execute')
     or has_function_privilege('anon', 'public.list_jefe_preview_profiles_v1()', 'execute') then
    raise exception 'Los RPC de jefatura no deben estar disponibles para anon';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.get_jefe_dashboard_preview_v1(bigint,integer,date)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_jefe_dashboard_preview_v2(uuid,integer,date)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.list_jefe_preview_profiles_v1()',
    'execute'
  ) then
    raise exception 'El cliente debe usar sólo la vista previa protegida por clave opaca';
  end if;

  if has_function_privilege('authenticated', 'private.jefe_report_rows_v1(text[])', 'execute')
     or has_function_privilege(
       'authenticated',
       'private.jefe_report_status_v1(boolean,boolean,date,date)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'private.reconcile_jefe_report_queue_v1(jsonb)',
       'execute'
     )
     or has_function_privilege('authenticated', 'private.jefe_annual_offers_v1(text[],integer,date)', 'execute')
     or has_function_privilege('authenticated', 'private.build_jefe_dashboard_v1(bigint,text[],integer,date)', 'execute')
     or has_function_privilege('authenticated', 'private.require_jefe_preview_access_v1()', 'execute') then
    raise exception 'Los helpers con áreas arbitrarias deben quedar privados';
  end if;

  if has_function_privilege(
       'authenticated',
       'private.get_jefe_moodle_sync_tasks_for_areas_v1(text[])',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)',
       'execute'
     ) then
    raise exception 'El cliente no debe poder elegir áreas arbitrarias para sincronizar Moodle';
  end if;

  if pg_get_functiondef(
    'private.get_jefe_dashboard_preview_v2_impl(uuid,integer,date)'::regprocedure
  ) not like '%require_jefe_preview_access_v1%' then
    raise exception 'La vista previa debe validar el rol en la base de datos';
  end if;

  if pg_get_functiondef('private.require_jefe_preview_access_v1()'::regprocedure)
     like '%auth.users%' then
    raise exception 'La autorización de simulación no debe depender de excepciones por email';
  end if;

  if pg_get_functiondef('private.get_jefe_dashboard_v1_impl(integer,date)'::regprocedure)
     not like '%build_jefe_dashboard_v1%' then
    raise exception 'La vista real y la simulación deben compartir el mismo cálculo';
  end if;

  if not has_function_privilege(
       'authenticated', 'public.get_jefe_moodle_sync_tasks_v1()', 'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.sync_jefe_moodle_reports_v1(uuid,bigint,integer,timestamptz,bigint,text,jsonb)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated', 'private.get_jefe_moodle_sync_tasks_v1_impl()', 'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'private.sync_jefe_moodle_reports_v1_impl(uuid,bigint,integer,timestamptz,bigint,text,jsonb)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_jefe_moodle_sync_tasks_preview_v1(uuid)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.sync_jefe_moodle_reports_preview_v1(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)',
       'execute'
     ) then
    raise exception 'La jefatura y el simulador necesitan los RPC protegidos del barrido Moodle anual';
  end if;

  if (
       select p.prosecdef
       from pg_proc p
       where p.oid = 'public.get_jefe_moodle_sync_tasks_v1()'::regprocedure
     )
     or (
       select p.prosecdef
       from pg_proc p
       where p.oid =
         'public.sync_jefe_moodle_reports_v1(uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
     )
     or (
       select p.prosecdef
       from pg_proc p
       where p.oid = 'public.get_jefe_moodle_sync_tasks_preview_v1(uuid)'::regprocedure
     )
     or (
       select p.prosecdef
       from pg_proc p
       where p.oid =
         'public.sync_jefe_moodle_reports_preview_v1(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
     ) then
    raise exception 'Los RPC públicos del barrido Moodle deben ser SECURITY INVOKER';
  end if;

  if pg_get_functiondef(
       'private.get_jefe_moodle_sync_tasks_for_areas_v1(text[])'::regprocedure
     ) not like '%ae.academic_year = v_year%'
     or pg_get_functiondef(
       'private.get_jefe_moodle_sync_tasks_for_areas_v1(text[])'::regprocedure
     ) not like '%group by t.course_id, t.cmid%' then
    raise exception 'El barrido Moodle debe limitarse al año corriente y deduplicar por tarea';
  end if;

  if pg_get_functiondef(
       'private.get_jefe_moodle_sync_tasks_v1_impl()'::regprocedure
     ) not like '%get_jefe_moodle_sync_tasks_for_areas_v1%' then
    raise exception 'La jefatura real y la simulada deben compartir el catálogo anual de tareas';
  end if;

  if pg_get_functiondef(
       'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
     ) not like '%c.candidate_count = 1%'
     or pg_get_functiondef(
       'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
     ) not like '%Jefe Moodle identity not configured%' then
    raise exception 'La ingesta de jefatura debe fallar cerrado ante mapeos o identidades ambiguas';
  end if;

  if pg_get_functiondef(
       'private.get_jefe_moodle_sync_tasks_preview_v1_impl(uuid)'::regprocedure
     ) not like '%require_jefe_preview_access_v1%'
     or pg_get_functiondef(
       'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
     ) not like '%jefe_area_year_preview%'
     or pg_get_functiondef(
       'private.sync_jefe_moodle_reports_v1_impl(uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
     ) not like '%sync_jefe_moodle_reports_scoped_v1_impl%' then
    raise exception 'El simulador debe compartir la ingesta anual y revalidar Admin + preview_key';
  end if;

  if has_function_privilege('authenticated', 'public.get_moodle_jefe_login_candidate_v1(text)', 'execute')
     or has_function_privilege('authenticated', 'public.complete_moodle_jefe_login_v1(text,uuid)', 'execute')
     or has_function_privilege('anon', 'public.get_moodle_jefe_login_candidate_v1(text)', 'execute')
     or has_function_privilege('anon', 'public.complete_moodle_jefe_login_v1(text,uuid)', 'execute') then
    raise exception 'Los RPC de autologin de jefatura deben ser exclusivos de service_role';
  end if;

  if not has_function_privilege('service_role', 'public.get_moodle_jefe_login_candidate_v1(text)', 'execute')
     or not has_function_privilege('service_role', 'public.complete_moodle_jefe_login_v1(text,uuid)', 'execute') then
    raise exception 'El servicio de autologin necesita ejecutar sus RPC dedicados';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.practicas'::regclass
      and conname = 'practicas_nota_fuente_check'
      and pg_get_constraintdef(oid) like '%jefe_panel%'
  ) then
    raise exception 'La procedencia jefe_panel debe ser válida para la carga de notas';
  end if;

  if pg_get_functiondef(
    'private.build_jefe_dashboard_v1(bigint,text[],integer,date)'::regprocedure
  )
     not like '%en proceso%' then
    raise exception 'La foto actual debe incluir prácticas legacy En proceso';
  end if;
end;
$$;
