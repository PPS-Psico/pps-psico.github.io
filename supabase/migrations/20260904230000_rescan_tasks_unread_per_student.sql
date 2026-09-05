begin;

-- Una entrega puede quedar invisible para siempre aunque su tarea ya se haya
-- barrido. Caso que lo destapó: legajo 35793, PPS "Asociación Civil Pensar -
-- Barriletes". Entregó el 07/07/2026 a las 21:58 en la tarea "Barriletes en
-- Bandada - 14" (cmid 805657) y sigue sin calificar. El panel le dice "sin
-- entrega" desde entonces; reclamó por mail el 31/07, el 04/08 y el 04/09.
--
-- DOS CAUSAS, LAS DOS EN EL ALCANCE
--
-- 1. "Leída" se medía por tarea, no por alumno. `tareas_ya_barridas` marcaba
--    una tarea como leída si alguna vez apareció en un barrido de jefatura, y
--    la sacaba del drenaje para siempre. Pero una tarea sigue recibiendo
--    entregas después de esa lectura. El único barrido de 805657 fue el
--    21/08 y capturó 28 de las 34 filas que la tarea tiene hoy; la de él no
--    estaba, ni siquiera como diagnóstico rechazado. Con la condición vieja esa
--    entrega no se podía volver a leer nunca.
--
-- 2. El alcance sólo miraba la tarea vinculada a la práctica. La práctica de
--    este alumno apunta a "Barriletes en Bandada" 2026 (cmid 1111226), donde ni
--    siquiera es participante: Moodle redirige su userid al primero de la lista.
--    Él entregó en la tarea del cohorte anterior. Mientras el alcance mire sólo
--    donde ya creíamos que estaba la entrega, no puede encontrarla en otro lado.
--
-- QUÉ CAMBIA
--
-- * "Sin leer" pasa a medirse por (tarea, alumno). Una tarea vuelve al drenaje
--   mientras haya una práctica pendiente cuyo alumno nunca fue leído en ella.
-- * El alcance se extiende por unidad de entrega: una práctica pendiente arrastra
--   todas las tareas no compartidas de su unidad, no sólo la vinculada. Es la
--   misma idea que ya rige la atribución desde 20260904210000, aplicada al
--   alcance.
-- * Amortiguador de 7 días: si la fila del alumno ya se leyó y no se pudo
--   atribuir, no se reintenta en cada barrido. Sin esto, los casos irresolubles
--   se comerían los 30 cupos de la tanda para siempre y taparían al resto.
--
-- Medido antes de aplicar: entran 55 tareas al drenaje (31 para
-- laboral+comunitaria, y 805657 cae dentro de la primera tanda de 30).
--
-- Las exclusiones van como CTE y no como subconsulta correlacionada por fila:
-- esa forma es la que en su momento costó 2,7 s por llamada y hacía que el sync
-- (que invoca este catálogo tres veces por request) chocara contra el
-- statement_timeout de 8 s del rol authenticated.

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
  ), pendientes_sin_corregir as (
    select
      p.id as practica_id,
      p.estudiante_id,
      p.lanzamiento_id,
      coalesce(p.especialidad, l.orientacion) as orientacion
    from public.practicas p
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and lower(coalesce(p.estado, '')) = 'finalizada'
      and lower(coalesce(p.informe_estado, '')) <> 'calificado'
      and coalesce(p.nota, '') !~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
  ), vinculos_pendientes as (
    select pe.orientacion, pe.estudiante_id, ae.academic_year, ae.course_id, ae.moodle_id, ae.moodle_name, ae.institucion
    from pendientes_sin_corregir pe
    join public.practica_moodle_tareas pm
      on pm.practica_id = pe.practica_id
     and pm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = pm.aula_entrega_id
     and ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
    union all
    select pe.orientacion, pe.estudiante_id, ae.academic_year, ae.course_id, ae.moodle_id, ae.moodle_name, ae.institucion
    from pendientes_sin_corregir pe
    join public.lanzamiento_moodle_tareas lm
      on lm.lanzamiento_id = pe.lanzamiento_id
     and lm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = lm.aula_entrega_id
     and ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
    where not exists (
      select 1
      from public.practica_moodle_tareas pm2
      where pm2.practica_id = pe.practica_id
        and pm2.validation_status = 'confirmed'
    )
    union all
    -- Tercera vía: el resto de las tareas de la misma unidad de entrega. El
    -- alumno pudo entregar en cualquiera de ellas, no sólo en la que su práctica
    -- tiene vinculada. Las compartidas quedan afuera porque no identifican
    -- institución (cajones de sastre de 2024).
    select pe.orientacion, pe.estudiante_id, ae.academic_year, ae.course_id, ae.moodle_id, ae.moodle_name, ae.institucion
    from pendientes_sin_corregir pe
    join public.lanzamientos_pps lu
      on lu.id = pe.lanzamiento_id
     and lu.unidad_id is not null
    join public.unidad_entrega_tareas uet
      on uet.unidad_id = lu.unidad_id
     and uet.compartida = false
    join public.aula_entregas ae
      on ae.id = uet.aula_entrega_id
     and ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
  ), leidas_por_alumno as (
    -- Se calcula una sola vez, por el motivo de siempre: como subconsulta
    -- correlacionada esto cuesta segundos y el sync llama al catálogo tres
    -- veces por request.
    select distinct o.cmid, o.estudiante_id
    from public.moodle_grade_observations o
    join public.moodle_sync_runs r on r.request_id = o.request_id
    where r.parser_version like 'assignment-grading-table/%'
      and o.estudiante_id is not null
  ), intentos_recientes as (
    select distinct d.cmid, d.estudiante_id
    from private.moodle_jefe_unmatched_diagnostics d
    where d.resolution_status in ('pending', 'needs_review')
      and d.observed_at > now() - interval '7 days'
      and d.estudiante_id is not null
  ), unswept_all as (
    select distinct
      v.academic_year,
      v.course_id,
      v.moodle_id::bigint as cmid,
      coalesce(
        nullif(trim(v.moodle_name), ''),
        nullif(trim(v.institucion), ''),
        'Tarea Moodle'
      ) as task_name,
      matched.area_key
    from vinculos_pendientes v
    cross join lateral (
      select area_key
      from unnest(p_areas) area_key
      where private.jefe_text_has_area(v.orientacion, area_key)
    ) matched
    -- Las tareas del año en curso ya entran por catalog_tasks: gastar cupos de
    -- la tanda en ellas deja afuera justo el atraso que la tanda existe para
    -- destrabar. La ventana es solo para años anteriores.
    where v.academic_year < v_year
      and not exists (
        select 1
        from leidas_por_alumno b
        where b.cmid = v.moodle_id::bigint
          and b.estudiante_id = v.estudiante_id
      )
      and not exists (
        select 1
        from intentos_recientes i
        where i.cmid = v.moodle_id::bigint
          and i.estudiante_id = v.estudiante_id
      )
  ), unswept_pending_tasks as (
    -- El barrido corre en el navegador de la jefatura y parsea cada tabla de
    -- calificación en el hilo principal, así que se toman de a tandas: orden
    -- estable, y cada tarea sale del conjunto en cuanto la fila que faltaba se
    -- pudo leer. Repetir el barrido drena el atraso.
    select u.*
    from unswept_all u
    join (
      select w.cmid
      from unswept_all w
      group by w.cmid
      order by max(w.academic_year) desc, w.cmid desc
      limit 30
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
$function$;

commit;
