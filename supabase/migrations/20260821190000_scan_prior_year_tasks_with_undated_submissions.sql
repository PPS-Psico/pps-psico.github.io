begin;

-- Había un círculo vicioso en el alcance del escaneo de jefaturas.
--
-- La migración 20260821160000 ya incluía tareas de años previos, pero sólo si
-- YA existía un snapshot con task_status = 'submitted'. Una tarea que nunca
-- fue escaneada no tiene snapshot, así que nunca entraba al catálogo, y por lo
-- tanto nunca podía ser escaneada. Caso real: Milagros Paz, "Barriletes en
-- Bandada" (cmid 805657, academic_year 2025) figura en Moodle entregada el
-- 23/07/2025 y calificada 100/100 el 12/09/2025, pero en el panel seguía como
-- "entrega sin fecha verificable" porque esa tarea jamás fue leída.
--
-- Ahora el catálogo también incluye una tarea de año previo cuando alguna
-- práctica vinculada CONSTA como entregada (por convocatoria, informe_estado o
-- snapshot) pero todavía no tiene fecha real de Moodle y no está calificada.
-- Es un criterio auto-limitante: en cuanto el escaneo trae la fecha o la nota,
-- la tarea deja de calificar y sale del catálogo. Medido hoy: agrega 7 tareas
-- sobre las 35 vigentes.
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
  ), open_undated_tasks as (
    -- Rompe el círculo vicioso: entregas que constan pero siguen sin fecha.
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
    from public.practicas p
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    join public.aula_entregas ae
      on ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
     and (
       exists (
         select 1
         from public.practica_moodle_tareas pm2
         where pm2.practica_id = p.id
           and pm2.validation_status = 'confirmed'
           and pm2.aula_entrega_id = ae.id
       )
       or (
         not exists (
           select 1
           from public.practica_moodle_tareas pm3
           where pm3.practica_id = p.id
             and pm3.validation_status = 'confirmed'
         )
         and exists (
           select 1
           from public.lanzamiento_moodle_tareas lm2
           where lm2.lanzamiento_id = p.lanzamiento_id
             and lm2.validation_status = 'confirmed'
             and lm2.aula_entrega_id = ae.id
         )
       )
     )
    cross join lateral (
      select area_key
      from unnest(p_areas) area_key
      where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
    ) matched
    left join lateral (
      select c0.informe_subido
      from public.convocatorias c0
      where c0.estudiante_id = p.estudiante_id
        and c0.lanzamiento_id = p.lanzamiento_id
      order by c0.created_at desc nulls last
      limit 1
    ) c on true
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      -- consta como entregada por alguna vía
      and (
        coalesce(c.informe_subido, false)
        or lower(coalesce(p.informe_estado, '')) in ('entregado', 'calificado')
        or exists (
          select 1
          from public.moodle_grade_snapshots s
          where s.practica_id = p.id
            and s.submitted
        )
      )
      -- pero sin fecha real, ni propia ni compartida en la misma tarea
      and not exists (
        select 1
        from public.moodle_grade_observations o
        join public.practicas p2 on p2.id = o.practica_id
        where p2.estudiante_id = p.estudiante_id
          and o.cmid = ae.moodle_id::bigint
          and o.submitted = true
          and o.submitted_at is not null
      )
      -- y todavía sin calificar
      and lower(coalesce(p.informe_estado, '')) <> 'calificado'
      and coalesce(p.nota, '') !~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
      and not exists (
        select 1
        from public.moodle_grade_snapshots s
        where s.practica_id = p.id
          and s.grade_value is not null
      )
  ), all_tasks as (
    select * from catalog_tasks
    union all
    select * from launch_tasks
    union all
    select * from direct_tasks
    union all
    select * from open_undated_tasks
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

comment on function private.get_jefe_moodle_sync_tasks_for_areas_v1(text[]) is
  'Catálogo de tareas Moodle escaneables por jefatura. Incluye tareas de años previos con entregas abiertas y con entregas que constan pero siguen sin fecha verificable.';

-- El sync debe aceptar como candidatas las mismas tareas que el catálogo
-- habilita; de lo contrario la lectura llega pero no encuentra su práctica.
-- Se reemplaza el filtro de año por la pertenencia al catálogo, que ya es la
-- autoridad única de alcance (el propio sync valida los cmid contra él).
do $patch$
declare
  v_src text;
  v_anchor text;
  v_replacement text;
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

  v_anchor := 'and (ae.academic_year = p_academic_year or exists (
        select 1
        from public.moodle_grade_snapshots os
        where os.aula_entrega_id = ae.id
          and os.task_status = ''submitted''
      ))';

  v_count := (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor);

  if v_count <> 2 then
    raise exception 'Se esperaban exactamente 2 anclas de alcance por ano; hay %', v_count;
  end if;

  v_replacement := 'and (ae.academic_year = p_academic_year or ae.moodle_id::bigint in (
        select allowed_scope.cmid
        from private.get_jefe_moodle_sync_tasks_for_areas_v1(v_areas) allowed_scope
      ))';

  v_src := replace(v_src, v_anchor, v_replacement);

  execute v_src;
end;
$patch$;

commit;
