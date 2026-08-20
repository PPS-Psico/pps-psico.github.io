-- El barrido de jefatura cubre todo el catalogo anual del area, incluso una
-- tarea que todavia no fue vinculada a un lanzamiento. La lectura puede
-- detectar ese faltante, pero la ingesta sigue exigiendo un vinculo confirmado
-- para aplicar cualquier fila a una practica.

create or replace function private.get_jefe_moodle_sync_tasks_v1_impl()
returns table(
  academic_year integer,
  course_id bigint,
  cmid bigint,
  task_name text,
  area_keys text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_areas text[];
  v_year integer := extract(
    year from (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )::integer;
begin
  v_areas := private.require_jefe_areas_v1();

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
      from unnest(v_areas) area_key
      where private.jefe_orientation_key(ae.area) = area_key
    ) matched
    where ae.academic_year = v_year
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
      and lm.orientacion_key = any(v_areas)
      and ae.academic_year = v_year
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
      from unnest(v_areas) area_key
      where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
    ) matched
    where pm.validation_status = 'confirmed'
      and ae.academic_year = v_year
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
$$;

revoke all on function private.get_jefe_moodle_sync_tasks_v1_impl()
  from public, anon, authenticated;
grant execute on function private.get_jefe_moodle_sync_tasks_v1_impl()
  to service_role;

comment on function public.get_jefe_moodle_sync_tasks_v1() is
  'Lista deduplicada de todas las tareas Moodle del anio actual y orientaciones del Jefe autenticado; la aplicacion posterior exige vinculos PPS confirmados.';
