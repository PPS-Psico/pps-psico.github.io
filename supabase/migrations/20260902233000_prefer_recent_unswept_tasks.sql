begin;

-- La tanda de seis se elegía por cmid ascendente, que es lo mismo que decir
-- "las más viejas primero". Medido en producción sobre laboral+comunitaria, eso
-- seleccionaba justo las seis tareas de 2024 -- Practicas Socio-Comunitaria,
-- Practicas Clinicas Antiguas, Subsecretaria de Trabajo, Informes PPS Asociación
-- PENSAR, Crianza Responsable, Informes de las Entrevistas -- que son las que
-- devuelven la página llena y obligan a la etiqueta a paginar. La tanda pensada
-- para aliviar el barrido se llevaba las tareas más pesadas.
--
-- Ahora se ordena por año académico descendente: primero las tareas del año en
-- curso y las de 2025, que son tablas chicas y además el atraso que le importa
-- a alguien hoy. Las de 2024 quedan para el final, cuando ya no compitan con
-- nada. El orden sigue siendo estable dentro de una corrida: sólo cambia cuando
-- una tarea se lee y sale del conjunto para siempre.
CREATE OR REPLACE FUNCTION private.get_jefe_moodle_sync_tasks_for_areas_v1(p_areas text[])
 RETURNS TABLE(academic_year integer, course_id bigint, cmid bigint, task_name text, area_keys text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  ), unswept_all as (
    -- Rompe el último tramo del círculo: una tarea cuya única evidencia
    -- posible es la propia entrega en Moodle. Si tiene prácticas terminadas y
    -- sin corregir y NINGUNA jefatura la leyó nunca, entra al catálogo hasta
    -- que se la lea por primera vez. Las lecturas del panel del alumno
    -- (`assignment-page/*`) no cuentan: traen sólo la fila de quien mira.
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
         from public.practica_moodle_tareas pm
         where pm.practica_id = p.id
           and pm.validation_status = 'confirmed'
           and pm.aula_entrega_id = ae.id
       )
       or (
         not exists (
           select 1
           from public.practica_moodle_tareas pm2
           where pm2.practica_id = p.id
             and pm2.validation_status = 'confirmed'
         )
         and exists (
           select 1
           from public.lanzamiento_moodle_tareas lm
           where lm.lanzamiento_id = p.lanzamiento_id
             and lm.validation_status = 'confirmed'
             and lm.aula_entrega_id = ae.id
         )
       )
     )
    cross join lateral (
      select area_key
      from unnest(p_areas) area_key
      where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
    ) matched
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and lower(coalesce(p.estado, '')) = 'finalizada'
      and lower(coalesce(p.informe_estado, '')) <> 'calificado'
      and coalesce(p.nota, '') !~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
      and not exists (
        select 1
        from public.moodle_grade_observations o
        join public.moodle_sync_runs r on r.request_id = o.request_id
        where o.cmid = ae.moodle_id::bigint
          and r.parser_version like 'assignment-grading-table/%'
      )
      -- Un barrido que no pudo enganchar ninguna fila igual leyó la tarea.
      and not exists (
        select 1
        from private.moodle_jefe_unmatched_diagnostics d
        where d.cmid = ae.moodle_id::bigint
      )
  ), unswept_pending_tasks as (
    -- El barrido corre en el navegador de la jefatura y parsea cada tabla de
    -- calificacion en el hilo principal. Sumar de golpe todas las tareas nunca
    -- leidas cuelga la pestania antes de completar un solo lote, asi que se
    -- toman de a pocas: orden estable por cmid, y las ya leidas salen del
    -- conjunto para siempre. Repetir el barrido drena el atraso de a tandas.
    select u.*
    from unswept_all u
    join (
      select w.cmid
      from unswept_all w
      group by w.cmid
      order by max(w.academic_year) desc, w.cmid desc
      limit 6
    ) pick on pick.cmid = u.cmid
  ), all_tasks as (
    select * from catalog_tasks
    union all
    select * from launch_tasks
    union all
    select * from direct_tasks
    union all
    select * from open_undated_tasks
    union all
    select * from unswept_pending_tasks
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
$function$
;

commit;
