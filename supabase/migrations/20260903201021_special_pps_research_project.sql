begin;

-- Tercer tipo de PPS excepcional: el informe de un proyecto de investigacion
-- de la universidad.
--
-- Relevamiento y Entrevistas tienen una tarea de Moodle POR ORIENTACION porque
-- el trabajo que se pide es distinto en cada area. En investigacion el
-- entregable es siempre el mismo informe y el area que acredita la decide
-- Coordinacion caso por caso, asi que el catalogo guarda UNA sola tarea por
-- anio (orientation_key = 'general') y la orientacion se elige al asignar,
-- sobre la practica. Eso ademas evita tener que crear cuatro actividades en
-- Moodle para poder usar cualquier orientacion.
--
-- El titulo del proyecto es obligatorio y se concatena en
-- practicas.nombre_institucion, que es exactamente el campo que se lee al
-- cargar el SAC (FinalizacionForm.tsx lo pasa como item.nombre y EgresoTab lo
-- muestra en el detalle). Sin el titulo, en el SAC quedarian varias filas
-- identicas que dicen solo "Proyecto de Investigacion" y no se sabria cual es
-- cual.

alter table public.special_pps_task_catalog
  drop constraint special_pps_task_catalog_activity_type_check,
  drop constraint special_pps_task_catalog_orientation_key_check;

alter table public.special_pps_task_catalog
  add constraint special_pps_task_catalog_activity_type_check
    check (activity_type in (
      'relevamiento_profesional', 'entrevistas_profesionales', 'proyecto_investigacion'
    )),
  add constraint special_pps_task_catalog_orientation_key_check
    check (
      case activity_type
        when 'proyecto_investigacion' then orientation_key = 'general'
        else orientation_key in ('clinica', 'laboral_comunitaria', 'educacional')
      end
    );

alter table public.special_pps_assignments
  drop constraint special_pps_assignments_activity_type_check;

alter table public.special_pps_assignments
  add constraint special_pps_assignments_activity_type_check
    check (activity_type in (
      'relevamiento_profesional', 'entrevistas_profesionales', 'proyecto_investigacion'
    ));

alter table public.special_pps_assignments
  add column if not exists project_title text;

alter table public.special_pps_assignments
  add constraint special_pps_assignments_project_title_check
    check (
      case activity_type
        when 'proyecto_investigacion' then nullif(btrim(project_title), '') is not null
        else project_title is null
      end
    );

-- Configuracion de la tarea anual -------------------------------------------

create or replace function private.set_special_pps_task_v1_impl(
  p_activity_type text,
  p_orientation_key text,
  p_academic_year smallint,
  p_aula_entrega_id bigint
)
returns public.special_pps_task_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.aula_entregas%rowtype;
  v_result public.special_pps_task_catalog%rowtype;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;
  if p_activity_type not in (
    'relevamiento_profesional', 'entrevistas_profesionales', 'proyecto_investigacion'
  ) then
    raise exception 'Invalid special PPS activity type' using errcode = '22023';
  end if;
  if p_activity_type = 'proyecto_investigacion' then
    if p_orientation_key is distinct from 'general' then
      raise exception 'Research projects use a single shared task (orientation_key = general)'
        using errcode = '22023';
    end if;
  elsif p_orientation_key not in ('clinica', 'laboral_comunitaria', 'educacional') then
    raise exception 'Invalid orientation' using errcode = '22023';
  end if;
  if p_academic_year < 2024 or p_academic_year > 2100 then
    raise exception 'Invalid academic year' using errcode = '22023';
  end if;

  select * into v_task
  from public.aula_entregas ae
  where ae.id = p_aula_entrega_id
  for share;

  if v_task.id is null then
    raise exception 'Moodle task not found in catalog' using errcode = 'P0002';
  end if;
  if not v_task.activo then
    raise exception 'Moodle task is inactive' using errcode = '22023';
  end if;
  if v_task.academic_year is distinct from p_academic_year then
    raise exception 'Moodle task belongs to year %, not %', v_task.academic_year, p_academic_year
      using errcode = '22023';
  end if;

  -- La tarea de investigacion es unica y compartida: su area en aula_entregas
  -- es solo donde quedo registrada en el Campus y no limita que orientacion
  -- puede acreditar la practica, asi que no se valida contra la orientacion.
  if p_activity_type <> 'proyecto_investigacion' and not (
    v_task.area = p_orientation_key
    or (p_orientation_key = 'laboral_comunitaria' and v_task.area in ('laboral', 'comunitaria'))
  ) then
    raise exception 'Moodle task belongs to orientation %, not %', v_task.area, p_orientation_key
      using errcode = '22023';
  end if;

  insert into public.special_pps_task_catalog (
    activity_type, orientation_key, academic_year, aula_entrega_id,
    enabled, created_by, updated_at, updated_by
  ) values (
    p_activity_type, p_orientation_key, p_academic_year, p_aula_entrega_id,
    true, auth.uid(), now(), auth.uid()
  )
  on conflict (activity_type, orientation_key, academic_year) do update
  set aula_entrega_id = excluded.aula_entrega_id,
      enabled = true,
      updated_at = now(),
      updated_by = auth.uid()
  returning * into v_result;

  return v_result;
end;
$$;

-- Asignacion ----------------------------------------------------------------
-- Se agrega p_project_title, asi que hay que reemplazar la firma en vez de
-- usar `create or replace`: dejar las dos conviviendo haria ambigua la
-- resolucion por nombre de parametro desde PostgREST.

drop function if exists public.assign_special_pps_v1(uuid, text, text, smallint, numeric);
drop function if exists private.assign_special_pps_v1_impl(uuid, text, text, smallint, numeric);

create function private.assign_special_pps_v1_impl(
  p_estudiante_id uuid,
  p_activity_type text,
  p_orientation_key text,
  p_academic_year smallint,
  p_expected_hours numeric,
  p_project_title text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog public.special_pps_task_catalog%rowtype;
  v_task public.aula_entregas%rowtype;
  v_practica_id uuid;
  v_assignment_id uuid;
  v_practice_name text;
  v_orientation_name text;
  v_title text := nullif(btrim(coalesce(p_project_title, '')), '');
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;
  if p_expected_hours is null or p_expected_hours <= 0 or p_expected_hours > 500 then
    raise exception 'Expected hours must be between 1 and 500' using errcode = '22023';
  end if;
  if not exists (select 1 from public.estudiantes e where e.id = p_estudiante_id) then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  if p_activity_type = 'proyecto_investigacion' then
    if v_title is null then
      raise exception 'El titulo del proyecto de investigacion es obligatorio'
        using errcode = '22023';
    end if;
  elsif v_title is not null then
    raise exception 'Only research projects carry a project title' using errcode = '22023';
  end if;

  select c.* into v_catalog
  from public.special_pps_task_catalog c
  where c.activity_type = p_activity_type
    and c.orientation_key = case
      when p_activity_type = 'proyecto_investigacion' then 'general'
      when p_orientation_key in ('laboral', 'comunitaria') then 'laboral_comunitaria'
      else p_orientation_key
    end
    and c.academic_year = p_academic_year
    and c.enabled
  for share;

  if v_catalog.id is null then
    raise exception 'No annual Moodle task is configured for this activity and orientation'
      using errcode = 'P0002';
  end if;

  select * into v_task
  from public.aula_entregas ae
  where ae.id = v_catalog.aula_entrega_id
    and ae.activo
    and ae.academic_year = p_academic_year
  for share;

  if v_task.id is null then
    raise exception 'The configured Moodle task is inactive or belongs to another year'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.special_pps_assignments a
    where a.estudiante_id = p_estudiante_id
      and a.activity_type = p_activity_type
      and a.academic_year = p_academic_year
      and a.status = 'assigned'
  ) then
    raise exception 'Student already has this special PPS assigned for the selected year'
      using errcode = '23505';
  end if;

  -- Este nombre es lo que se ve al cargar el SAC, por eso lleva el titulo.
  v_practice_name := case p_activity_type
    when 'relevamiento_profesional' then 'Relevamiento del Ejercicio Profesional en Psicología'
    when 'entrevistas_profesionales' then 'Entrevistas a Profesionales'
    when 'proyecto_investigacion' then 'Proyecto de Investigación — ' || v_title
  end;
  v_orientation_name := case p_orientation_key
    when 'clinica' then 'Clínica'
    when 'laboral' then 'Laboral'
    when 'comunitaria' then 'Comunitaria'
    when 'educacional' then 'Educacional'
  end;

  if v_orientation_name is null then
    raise exception 'Invalid orientation' using errcode = '22023';
  end if;

  insert into public.practicas (
    estudiante_id, lanzamiento_id, horas_realizadas, fecha_inicio,
    fecha_finalizacion, estado, especialidad, nombre_institucion,
    es_online, tipo_actividad, informe_estado
  ) values (
    p_estudiante_id, null, p_expected_hours, null,
    null, 'En curso', v_orientation_name, v_practice_name,
    true, 'actividad_especial', 'a_revisar'
  ) returning id into v_practica_id;

  insert into public.practica_moodle_tareas (
    practica_id, aula_entrega_id, validation_status, link_source,
    rationale, validated_at, validated_by
  ) values (
    v_practica_id, v_task.id, 'confirmed', 'manual',
    format('Asignacion excepcional %s %s por coordinacion', p_activity_type, p_academic_year),
    now(), auth.uid()
  );

  insert into public.special_pps_assignments (
    practica_id, estudiante_id, task_catalog_id, activity_type,
    orientation_key, academic_year, expected_hours, project_title, assigned_by
  ) values (
    v_practica_id, p_estudiante_id, v_catalog.id, p_activity_type,
    p_orientation_key, p_academic_year, p_expected_hours, v_title, auth.uid()
  ) returning id into v_assignment_id;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'practica_id', v_practica_id,
    'aula_entrega_id', v_task.id,
    'cmid', v_task.moodle_id
  );
end;
$$;

revoke all on function private.assign_special_pps_v1_impl(uuid, text, text, smallint, numeric, text)
  from public, anon, authenticated;
grant execute on function private.assign_special_pps_v1_impl(uuid, text, text, smallint, numeric, text)
  to authenticated, service_role;

create function public.assign_special_pps_v1(
  p_estudiante_id uuid,
  p_activity_type text,
  p_orientation_key text,
  p_academic_year smallint,
  p_expected_hours numeric default 20,
  p_project_title text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.assign_special_pps_v1_impl(
    p_estudiante_id, p_activity_type, p_orientation_key, p_academic_year,
    p_expected_hours, p_project_title
  );
$$;

revoke all on function public.assign_special_pps_v1(uuid, text, text, smallint, numeric, text)
  from public, anon;
grant execute on function public.assign_special_pps_v1(uuid, text, text, smallint, numeric, text)
  to authenticated, service_role;

commit;
