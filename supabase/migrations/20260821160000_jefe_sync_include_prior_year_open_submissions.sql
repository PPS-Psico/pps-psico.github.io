-- El barrido anual de jefaturas ahora incluye tambien tareas de años previos
-- que conservan entregas abiertas (submitted sin calificar), para capturar la
-- fecha real de entrega que el puente solo registra desde el 19/08/2026.
--
-- Con la fecha en mano, la regla vigente de 90 dias los reclasifica sola como
-- antecedentes y el rotulo "entregas sin fecha verificable" desaparece de la
-- cola cuando llega a cero.
--
-- Alcance del cambio:
--  1. get_jefe_moodle_sync_tasks_for_areas_v1: catalogo y vinculos directos
--     incluyen tareas viejas con entregas abiertas.
--  2. sync_jefe_moodle_reports_scoped_v1_impl: los candidatos de practica
--     aceptan la misma excepcion, para que la lectura de una tarea vieja
--     encuentre su practica.

create or replace function private.get_jefe_moodle_sync_tasks_for_areas_v1(p_areas text[])
returns table(academic_year integer, course_id bigint, cmid bigint, task_name text, area_keys text[])
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_year integer := extract(
    year from (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )::integer;
begin
  if coalesce(cardinality(p_areas), 0) = 0
     or not (p_areas <@ array['clinica', 'educacional', 'laboral', 'comunitaria']::text[]) then
    raise exception 'Invalid jefe Moodle area scope' using errcode = '42501';
  end if;

  return query
  with catalog_tasks as (
    select
      ae.academic_year,
      ae.course_id,
      ae.moodle_id::bigint as cmid,
      coalesce(
        nullif(trim(ae.moodle_name), ''),
        nullif(trim(ae.institucion), ''),
        'Tarea Moodle'
      ) as task_name,
      area_key
    from public.aula_entregas ae
    cross join lateral (
      select area_key
      from unnest(p_areas) area_key
      where private.jefe_orientation_key(ae.area) = area_key
    ) matched
    where (ae.academic_year = v_year or exists (
        select 1
        from public.moodle_grade_snapshots os
        where os.aula_entrega_id = ae.id
          and os.task_status = 'submitted'
      ))
      and ae.course_id = 3615
      and ae.moodle_id ~ '^\d+$'
  ), launch_tasks as (
    select
      ae.academic_year,
      ae.course_id,
      ae.moodle_id::bigint as cmid,
      coalesce(
        nullif(trim(ae.moodle_name), ''),
        nullif(trim(ae.institucion), ''),
        'Tarea Moodle'
      ) as task_name,
      lm.orientacion_key as area_key
    from public.lanzamiento_moodle_tareas lm
    join public.aula_entregas ae on ae.id = lm.aula_entrega_id
    where lm.validation_status = 'confirmed'
      and lm.orientacion_key = any(p_areas)
      and (
        exists (
          select 1
          from public.lanzamientos_pps l2
          where l2.id = lm.lanzamiento_id
            and coalesce(substring(l2.fecha_inicio from '^(\d{4})')::integer, 0) = v_year
        )
        or exists (
          select 1
          from public.moodle_grade_snapshots os
          where os.aula_entrega_id = ae.id
            and os.task_status = 'submitted'
        )
      )
      and ae.course_id = 3615
      and ae.moodle_id ~ '^\d+$'
  ), direct_tasks as (
    select
      ae.academic_year,
      ae.course_id,
      ae.moodle_id::bigint as cmid,
      coalesce(
        nullif(trim(ae.moodle_name), ''),
        nullif(trim(ae.institucion), ''),
        'Tarea Moodle'
      ) as task_name,
      matched.area_key
    from public.practica_moodle_tareas pm
    join public.aula_entregas ae on ae.id = pm.aula_entrega_id
    join public.practicas p on p.id = pm.practica_id
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    cross join lateral (
      select area_key
      from unnest(p_areas) area_key
      where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
    ) matched
    where pm.validation_status = 'confirmed'
      and (ae.academic_year = v_year or exists (
        select 1
        from public.moodle_grade_snapshots os
        where os.aula_entrega_id = ae.id
          and os.task_status = 'submitted'
      ))
      and ae.course_id = 3615
      and ae.moodle_id ~ '^\d+$'
  ), all_tasks as (
    select * from catalog_tasks
    union all
    select * from launch_tasks
    union all
    select * from direct_tasks
  )
  select
    v_year,
    t.course_id,
    t.cmid,
    min(t.task_name) as task_name,
    array_agg(distinct t.area_key order by t.area_key) as area_keys
  from all_tasks t
  group by t.course_id, t.cmid
  order by min(t.task_name), t.cmid;
end;
$function$;

-- Parche por anclas al cuerpo del sync persistente.
do $patch$
declare
  v_src text;
  v_count integer;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'sync_jefe_moodle_reports_scoped_v1_impl';

  if v_src is null then
    raise exception 'No se encontro sync_jefe_moodle_reports_scoped_v1_impl';
  end if;

  if position('candidate_pool' in v_src) = 0 then
    raise exception 'El parche de precedencia no esta aplicado; correr primero esa migracion';
  end if;

  v_count := (length(v_src) - length(replace(v_src,
    'and ae.academic_year = p_academic_year',
    ''))) / length('and ae.academic_year = p_academic_year');

  if v_count <> 2 then
    raise exception 'Se esperaban exactamente 2 candidatos con filtro de ano; hay %', v_count;
  end if;

  v_src := replace(v_src,
    'and ae.academic_year = p_academic_year',
    'and (ae.academic_year = p_academic_year or exists (
        select 1
        from public.moodle_grade_snapshots os
        where os.aula_entrega_id = ae.id
          and os.task_status = ''submitted''
      ))');

  execute v_src;
end;
$patch$;
