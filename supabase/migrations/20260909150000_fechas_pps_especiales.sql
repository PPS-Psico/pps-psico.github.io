begin;

-- Las PPS especiales se creaban sin fechas: la practica quedaba con
-- fecha_inicio y fecha_finalizacion en null, asi que en el panel no habia
-- periodo que mostrar ni con que calcular nada.
--
-- Criterio acordado con coordinacion:
--   * fecha_inicio      = el dia en que se asigna la PPS.
--   * fecha_finalizacion = el dia en que se detecta la entrega del informe.
--
-- Para la finalizacion se prefiere la fecha real de entrega que informa Moodle
-- (moodle_grade_snapshots.submitted_at); si todavia no hay snapshot, se usa el
-- dia en que se detecto. Asi un barrido que corre tarde no corre la fecha.
--
-- Las dos fechas son `text` con formato YYYY-MM-DD, igual que en el resto de
-- `practicas` (ver private.finish_hour_based_practice).

-- 1. fecha_inicio al asignar -------------------------------------------------

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
  v_hoy text := ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text;
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

  -- fecha_inicio = hoy; la finalizacion la estampa el trigger cuando se
  -- detecta la entrega del informe.
  insert into public.practicas (
    estudiante_id, lanzamiento_id, horas_realizadas, fecha_inicio,
    fecha_finalizacion, estado, especialidad, nombre_institucion,
    es_online, tipo_actividad, informe_estado
  ) values (
    p_estudiante_id, null, p_expected_hours, v_hoy,
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

-- 2. fecha_finalizacion al detectar la entrega -------------------------------
--
-- Va como trigger y no dentro de cada funcion de deteccion porque la entrega
-- llega por varios caminos (apply_moodle_grade_observation,
-- apply_moodle_evidence_decision_v1, reconcile_moodle_case_v1). Un solo lugar
-- garantiza que ninguno se olvide de estampar la fecha.

create or replace function private.stamp_special_pps_completion_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submitted timestamptz;
begin
  if new.tipo_actividad is distinct from 'actividad_especial' then
    return new;
  end if;
  if new.fecha_finalizacion is not null then
    return new;
  end if;
  if lower(coalesce(new.informe_estado, '')) not in ('entregado', 'calificado') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and lower(coalesce(old.informe_estado, '')) = lower(coalesce(new.informe_estado, '')) then
    return new;
  end if;

  -- Fecha real de entrega si Moodle ya la informo; si no, el dia de deteccion.
  select max(s.submitted_at) into v_submitted
  from public.moodle_grade_snapshots s
  where s.practica_id = new.id and s.submitted;

  new.fecha_finalizacion := (
    coalesce(v_submitted, now()) at time zone 'America/Argentina/Buenos_Aires'
  )::date::text;

  return new;
end;
$$;

revoke all on function private.stamp_special_pps_completion_v1()
  from public, anon, authenticated;

drop trigger if exists trg_stamp_special_pps_completion on public.practicas;
create trigger trg_stamp_special_pps_completion
before insert or update of informe_estado on public.practicas
for each row execute function private.stamp_special_pps_completion_v1();

-- 3. Backfill de las asignaciones vivas --------------------------------------

update public.practicas p
set fecha_inicio = ((a.assigned_at at time zone 'America/Argentina/Buenos_Aires')::date)::text
from public.special_pps_assignments a
where a.practica_id = p.id
  and p.tipo_actividad = 'actividad_especial'
  and p.fecha_inicio is null;

update public.practicas p
set fecha_finalizacion = ((s.submitted_at at time zone 'America/Argentina/Buenos_Aires')::date)::text
from (
  select practica_id, max(submitted_at) as submitted_at
  from public.moodle_grade_snapshots
  where submitted and submitted_at is not null
  group by practica_id
) s
where s.practica_id = p.id
  and p.tipo_actividad = 'actividad_especial'
  and p.fecha_finalizacion is null
  and lower(coalesce(p.informe_estado, '')) in ('entregado', 'calificado');

commit;
