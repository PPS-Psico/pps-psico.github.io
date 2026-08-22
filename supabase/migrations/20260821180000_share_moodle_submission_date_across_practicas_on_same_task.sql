begin;

-- Un mismo espacio de entrega de Moodle puede cubrir dos PPS del mismo alumno.
-- Caso real (Fundación Tiempo, cmid 1085731): el estudiante sube el informe de
-- Adultos y el de Niños como dos archivos dentro de la MISMA tarea, y Moodle
-- informa una sola fecha de "Enviado para calificar".
--
-- El sincronizador de jefaturas elige una única práctica por (cmid, alumno)
-- -- ver candidate_counts en sync_jefe_moodle_reports_scoped_v1_impl -- así que
-- la fecha queda guardada contra una sola de las dos prácticas. La otra se
-- mostraba para siempre como "entrega sin fecha verificable" aunque el dato
-- real ya estuviera en la base.
--
-- submitted_at es una propiedad de (alumno, tarea de Moodle), no de la
-- práctica: si el alumno entregó una vez en esa tarea, esa fecha vale para
-- todas sus prácticas vinculadas a esa misma tarea. Este parche agrega ese
-- fallback, acotado a la tarea que la propia práctica ya tiene asociada en su
-- snapshot (no inventa vínculos nuevos).
create or replace function private.jefe_report_rows_v1(p_areas text[])
returns table(
  practica_id uuid,
  estudiante_id uuid,
  student_name text,
  legajo text,
  lanzamiento_id uuid,
  pps_name text,
  institution_name text,
  orientation text,
  submitted boolean,
  submitted_at timestamptz,
  deadline_at date,
  days_remaining integer,
  grade text,
  report_status text,
  urgency text,
  campus_url text
)
language sql
stable
security definer
set search_path = ''
as $$
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
      (
        lower(coalesce(p.informe_estado, '')) = 'calificado'
        or coalesce(p.nota, '') ~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
        or lower(trim(coalesce(p.nota, ''))) = 'desaprobado'
        or s.grade_value is not null
      ) as graded,
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
      select s0.*
      from public.moodle_grade_snapshots s0
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
    select b.*
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
      nullif(trim(s.nota), ''),
      nullif(trim(s.grade_display), ''),
      s.grade_value::text
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
        when s.cmid is not null
          then 'https://campus.uflo.edu.ar/mod/assign/view.php?id=' || s.cmid::text
      end,
      nullif(trim(s.launch_report_url), '')
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
$$;

comment on function private.jefe_report_rows_v1(text[]) is
  'Detalle canónico de informes por área. Usa la fecha real informada por Moodle, compartida entre prácticas del mismo alumno que entregan en la misma tarea; oculta prácticas viejas ya superadas por otra práctica En curso sobre el mismo cmid cuando no tienen fecha propia.';

commit;
