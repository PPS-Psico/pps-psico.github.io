begin;

-- Un informe entregado en Campus puede quedar invisible para la jefatura para
-- siempre. Caso que lo destapó: legajo 29259, PPS "Colegio Psicólogos CPAVZO"
-- (cmid 817710) y "Guardia de Vulnerabilidad" (cmid 906061), prácticas
-- terminadas en noviembre y diciembre de 2025. En la cola del área figuran como
-- `waiting` -- "esperando que el alumno entregue" -- casi un año después de que
-- entregó, así que nadie las corrigió y la materia le quedó abierta.
--
-- POR QUÉ PASA
--
-- La única evidencia de entrega que el sistema acepta es la lectura de Moodle,
-- y una tarea sólo se lee si entra al catálogo de barrido. El catálogo admite
-- tareas de años previos por tres puertas y las tres piden evidencia previa:
-- un snapshot `submitted`, o que la práctica ya conste entregada por
-- convocatoria / `informe_estado`. Para el alumno cuya única evidencia es la
-- entrega misma en Moodle, el círculo sigue cerrado: no hay evidencia -> la
-- tarea no se barre -> no aparece la evidencia. La migración
-- 20260821190000 abrió el caso "consta entregada pero sin fecha"; falta el
-- caso "no consta nada porque nunca miramos".
--
-- Medido hoy sobre producción: 54 tareas (22 de 2024, 32 de 2025) quedan fuera
-- del catálogo teniendo prácticas terminadas y sin corregir. Son 379 prácticas
-- de 123 alumnos que la jefatura nunca pudo ver. El catálogo vigente tiene 41
-- tareas; con esta regla pasa a ~95 una sola vez y vuelve a bajar a medida que
-- cada tarea se lee, porque la condición se apaga con la primera lectura.
--
-- Las lecturas del panel del alumno no cuentan como "leída": el puente del
-- alumno (`parser_version = 'assignment-page/*'`) trae sólo la fila de quien
-- está mirando, mientras que el barrido de jefatura
-- (`assignment-grading-table/*`) trae la tabla de calificación completa. Hasta
-- hoy, de las 8340 observaciones, 39 tareas fueron barridas por jefatura y el
-- resto son filas sueltas de alumnos que abrieron Mi Panel dentro de Moodle.
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
  ), unswept_pending_tasks as (
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

comment on function private.get_jefe_moodle_sync_tasks_for_areas_v1(text[]) is
  'Catálogo de tareas Moodle escaneables por jefatura. Incluye tareas de años previos con entregas abiertas, con entregas que constan pero siguen sin fecha verificable, y tareas con prácticas terminadas sin corregir que ninguna jefatura leyó nunca.';

-- El segundo tramo del mismo problema: aunque la tarea entre al catálogo, la
-- fila de la cola no traía cómo abrirla. `campus_url` salía únicamente del
-- cmid del snapshot de Moodle, que por definición no existe cuando nunca se
-- leyó la tarea -- justo el caso en que la jefatura necesita el link. Y cuando
-- no había snapshot caía al campo `informe` del lanzamiento, que en 29
-- lanzamientos es el texto de plantilla "poner link de informe".
--
-- Ahora usa el vínculo confirmado que la práctica ya tiene (directo si existe,
-- si no el del lanzamiento, prefiriendo la orientación de la práctica) y sólo
-- acepta el campo del lanzamiento si de verdad es una URL. Medido: 504 filas
-- sin link pasan a tenerlo y 75 dejan de mostrar el texto de plantilla.
CREATE OR REPLACE FUNCTION private.jefe_report_rows_v1(p_areas text[])
 RETURNS TABLE(practica_id uuid, estudiante_id uuid, student_name text, legajo text, lanzamiento_id uuid, pps_name text, institution_name text, orientation text, submitted boolean, submitted_at timestamp with time zone, deadline_at date, days_remaining integer, grade text, report_status text, urgency text, campus_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with direct_links as (
    select
      p.id as practica_id,
      p.estudiante_id,
      ae.moodle_id::bigint as cmid
    from public.practicas p
    join public.practica_moodle_tareas pm
      on pm.practica_id = p.id
     and pm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = pm.aula_entrega_id
     and ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
  ), launch_links as (
    select
      p.id as practica_id,
      p.estudiante_id,
      ae.moodle_id::bigint as cmid
    from public.practicas p
    join public.lanzamiento_moodle_tareas lm
      on lm.lanzamiento_id = p.lanzamiento_id
     and lm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = lm.aula_entrega_id
     and ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
    where not exists (
      select 1
      from public.practica_moodle_tareas pm2
      where pm2.practica_id = p.id
        and pm2.validation_status = 'confirmed'
    )
  ), resolved_cmid as (
    select * from direct_links
    union all
    select * from launch_links
  ), superseded_practicas as (
    select distinct r.practica_id
    from resolved_cmid r
    join public.practicas p on p.id = r.practica_id
    where lower(coalesce(p.estado, '')) <> 'en curso'
      and exists (
        select 1
        from resolved_cmid other
        join public.practicas op on op.id = other.practica_id
        where other.estudiante_id = r.estudiante_id
          and other.cmid = r.cmid
          and other.practica_id <> r.practica_id
          and lower(coalesce(op.estado, '')) = 'en curso'
      )
  ), base as (
    select
      p.id as practica_id,
      p.estudiante_id,
      coalesce(nullif(trim(e.nombre), ''), 'Estudiante') as student_name,
      e.legajo,
      p.lanzamiento_id,
      coalesce(
        nullif(trim(l.nombre_pps), ''),
        nullif(trim(p.nombre_institucion), ''),
        'PPS'
      ) as pps_name,
      coalesce(
        nullif(trim(i.nombre), ''),
        nullif(trim(p.nombre_institucion), ''),
        nullif(trim(l.nombre_pps), ''),
        'Sin institución'
      ) as institution_name,
      coalesce(
        nullif(trim(p.especialidad), ''),
        nullif(trim(l.orientacion), ''),
        'No informada'
      ) as orientation,
      p.nota,
      p.informe_estado,
      s.grade_value,
      s.grade_display,
      s.cmid,
      linked_task.cmid as linked_cmid,
      -- Nota de Campus ya interpretada segun el contrato de escala de la tarea.
      private.read_moodle_grade_v1(s.grade_value, s.grade_max, s.grade_conversion_mode)
        as campus_grade,
      (
        s.grade_conversion_mode = 'pass_fail' and s.grade_value is not null
        or private.read_moodle_grade_v1(s.grade_value, s.grade_max, s.grade_conversion_mode)
             is not null
      ) as campus_graded,
      l.informe as launch_report_url,
      coalesce(
        source_submission.submitted_at,
        shared_submission.submitted_at,
        case
          when c.fecha_entrega_informe ~ '^\d{4}-\d{2}-\d{2}$'
            then (
              c.fecha_entrega_informe::date + time '12:00'
            ) at time zone 'America/Argentina/Buenos_Aires'
          else null
        end
      ) as submitted_at,
      (
        source_submission.submitted_at is not null
        or shared_submission.submitted_at is not null
        or coalesce(s.submitted, false)
        or coalesce(c.informe_subido, false)
        or lower(coalesce(p.informe_estado, '')) in ('entregado', 'calificado')
      ) as submitted,
      (sp.practica_id is not null) as superseded
    from public.practicas p
    left join public.estudiantes e on e.id = p.estudiante_id
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    left join public.instituciones i
      on i.id::text = coalesce(p.institucion_id::text, l.institucion_id)
    left join superseded_practicas sp on sp.practica_id = p.id
    left join lateral (
      select c0.*
      from public.convocatorias c0
      where c0.estudiante_id = p.estudiante_id
        and c0.lanzamiento_id = p.lanzamiento_id
      order by c0.created_at desc nulls last
      limit 1
    ) c on true
    left join lateral (
      select s0.*, ae0.grade_conversion_mode
      from public.moodle_grade_snapshots s0
      left join public.aula_entregas ae0 on ae0.id = s0.aula_entrega_id
      where s0.practica_id = p.id
      order by s0.submitted desc, s0.observed_at desc
      limit 1
    ) s on true
    left join lateral (
      select min(o.submitted_at) as submitted_at
      from public.moodle_grade_observations o
      where o.practica_id = p.id
        and o.submitted = true
        and o.submitted_at is not null
    ) source_submission on true
    -- Misma tarea de Moodle, mismo alumno, otra práctica: una sola entrega
    -- cubre ambas PPS, así que la fecha real es compartida.
    left join lateral (
      select min(o2.submitted_at) as submitted_at
      from public.moodle_grade_observations o2
      join public.practicas p2 on p2.id = o2.practica_id
      where s.cmid is not null
        and o2.cmid = s.cmid
        and p2.estudiante_id = p.estudiante_id
        and o2.submitted = true
        and o2.submitted_at is not null
    ) shared_submission on true
    -- Tarea de Campus a la que apunta la práctica aunque todavía no haya
    -- ninguna lectura de Moodle. Es el único link que sirve justo cuando la
    -- jefatura necesita abrir la tarea: cuando no hay entrega observada.
    left join lateral (
      select coalesce(
        (
          select ae.moodle_id::bigint
          from public.practica_moodle_tareas pm
          join public.aula_entregas ae on ae.id = pm.aula_entrega_id
          where pm.practica_id = p.id
            and pm.validation_status = 'confirmed'
            and ae.course_id = 3615
            and ae.moodle_id ~ '^\d+$'
          order by ae.academic_year desc nulls last, ae.id
          limit 1
        ),
        (
          select ae.moodle_id::bigint
          from public.lanzamiento_moodle_tareas lm
          join public.aula_entregas ae on ae.id = lm.aula_entrega_id
          where lm.lanzamiento_id = p.lanzamiento_id
            and lm.validation_status = 'confirmed'
            and ae.course_id = 3615
            and ae.moodle_id ~ '^\d+$'
          order by
            private.jefe_text_has_area(
              coalesce(p.especialidad, l.orientacion), lm.orientacion_key
            ) desc,
            ae.academic_year desc nulls last,
            ae.id
          limit 1
        )
      ) as cmid
    ) linked_task on true
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and exists (
        select 1
        from unnest(p_areas) area_key
        where private.jefe_text_has_area(
          coalesce(p.especialidad, l.orientacion),
          area_key
        )
      )
  ), visible as (
    select
      b.*,
      (
        lower(coalesce(b.informe_estado, '')) = 'calificado'
        or coalesce(b.nota, '') ~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
        or lower(trim(coalesce(b.nota, ''))) = 'desaprobado'
        or b.campus_graded
      ) as graded
    from base b
    where not (b.superseded and b.submitted_at is null)
  ), classified as (
    select
      v.*,
      case
        when v.submitted_at is not null
          then (v.submitted_at at time zone 'America/Argentina/Buenos_Aires')::date + 30
        else null
      end as deadline_at
    from visible v
  ), statused as (
    select
      c.*,
      private.jefe_report_status_v1(
        c.graded,
        c.submitted,
        c.deadline_at,
        (now() at time zone 'America/Argentina/Buenos_Aires')::date
      ) as report_status
    from classified c
  )
  select
    s.practica_id,
    s.estudiante_id,
    s.student_name,
    s.legajo,
    s.lanzamiento_id,
    s.pps_name,
    s.institution_name,
    s.orientation,
    s.submitted,
    s.submitted_at,
    s.deadline_at,
    case
      when s.deadline_at is not null
        then s.deadline_at
          - (now() at time zone 'America/Argentina/Buenos_Aires')::date
      else null
    end as days_remaining,
    coalesce(
      case
        when trim(coalesce(s.nota, '')) ~ '^(10|[0-9])([.,][0-9]{1,2})?$'
          or lower(trim(coalesce(s.nota, ''))) in ('aprobado', 'desaprobado')
        then trim(s.nota)
      end,
      rtrim(rtrim(to_char(s.campus_grade, 'FM999999990.00'), '0'), '.'),
      nullif(trim(s.nota), ''),
      nullif(trim(s.grade_display), '')
    ) as grade,
    s.report_status,
    case
      when s.report_status <> 'pending' then s.report_status
      when s.deadline_at is null then 'undated'
      when s.deadline_at
        < (now() at time zone 'America/Argentina/Buenos_Aires')::date
        then 'critical'
      when s.deadline_at
        <= (now() at time zone 'America/Argentina/Buenos_Aires')::date + 7
        then 'soon'
      else 'on_time'
    end as urgency,
    coalesce(
      case
        when coalesce(s.cmid, s.linked_cmid) is not null
          then 'https://campus.uflo.edu.ar/mod/assign/view.php?id='
            || coalesce(s.cmid, s.linked_cmid)::text
      end,
      case
        when trim(coalesce(s.launch_report_url, '')) ~ '^https?://'
          then trim(s.launch_report_url)
      end
    ) as campus_url
  from statused s
  order by
    case s.report_status
      when 'pending' then 0
      when 'waiting' then 1
      when 'stale' then 2
      else 3
    end,
    s.deadline_at asc nulls last,
    s.student_name;
$function$
;

comment on function private.jefe_report_rows_v1(text[]) is
  'Detalle canónico de informes por área. Usa la fecha real informada por Moodle, compartida entre prácticas del mismo alumno que entregan en la misma tarea; lee la nota con read_moodle_grade_v1, así un número que no es una nota no cierra el informe; oculta prácticas viejas ya superadas por otra En curso sobre el mismo cmid cuando no tienen fecha propia; y arma el link a Campus desde el vínculo confirmado de la práctica aunque todavía no haya ninguna lectura de Moodle.';

commit;
