begin;

-- "Entrevistas a Profesionales" era el nombre viejo de "Relevamiento del
-- Ejercicio Profesional en Psicología". Se unifica todo bajo
-- relevamiento_profesional: el panel de PPS especiales deja de ofrecer
-- "Entrevistas" como actividad separada y las tres tareas 2026 pasan a
-- resolverse cuando se elige "Relevamiento profesional" + 2026.
--
-- Seguro de aplicar: hoy no existe ninguna special_pps_assignments con
-- activity_type = 'entrevistas_profesionales' (la única asignación viva es
-- proyecto_investigacion) y no hay filas relevamiento_profesional 2026 que
-- colisionen con el unique (activity_type, orientation_key, academic_year).

-- 1. Re-apuntar el catálogo (sólo hay filas 2026).
update public.special_pps_task_catalog
set activity_type = 'relevamiento_profesional',
    updated_at = now()
where activity_type = 'entrevistas_profesionales';

-- 2. Renombrar las tareas en aula_entregas para que el estudiante no vea
--    "Entrevistas". El rename real en Moodle (curso 3615, CMIDs 1224814 /
--    1224816 / 1097090) es un paso operativo aparte; estas tres tareas no
--    tienen entregas.
update public.aula_entregas set
  moodle_name = 'Relevamiento del Ejercicio Profesional en Psicología · Clínica',
  institucion = 'Relevamiento del Ejercicio Profesional en Psicología · Clínica'
where id = 153;

update public.aula_entregas set
  moodle_name = 'Relevamiento del Ejercicio Profesional en Psicología · Educacional',
  institucion = 'Relevamiento del Ejercicio Profesional en Psicología · Educacional'
where id = 154;

update public.aula_entregas set
  moodle_name = 'Relevamiento del Ejercicio Profesional en Psicología · Laboral/Comunitaria',
  institucion = 'Relevamiento del Ejercicio Profesional en Psicología · Laboral/Comunitaria'
where id = 134;

-- 3. Endurecer los checks: relevamiento_profesional y proyecto_investigacion
--    son los únicos tipos válidos de ahora en más.
alter table public.special_pps_task_catalog
  drop constraint special_pps_task_catalog_activity_type_check,
  add constraint special_pps_task_catalog_activity_type_check
    check (activity_type in ('relevamiento_profesional', 'proyecto_investigacion'));

alter table public.special_pps_assignments
  drop constraint special_pps_assignments_activity_type_check,
  add constraint special_pps_assignments_activity_type_check
    check (activity_type in ('relevamiento_profesional', 'proyecto_investigacion'));

-- 4. Sacar 'entrevistas_profesionales' de la lista interna de la función de
--    configuración de tarea anual (el resto del cuerpo queda igual que en
--    20260903201021_special_pps_research_project.sql).
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
  if p_activity_type not in ('relevamiento_profesional', 'proyecto_investigacion') then
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

-- 5. Sacar la rama 'entrevistas_profesionales' del nombre de práctica en la
--    función de asignación (resto del cuerpo igual que en
--    20260903201021_special_pps_research_project.sql).
create or replace function private.assign_special_pps_v1_impl(
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

  v_practice_name := case p_activity_type
    when 'relevamiento_profesional' then 'Relevamiento del Ejercicio Profesional en Psicología'
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

commit;
