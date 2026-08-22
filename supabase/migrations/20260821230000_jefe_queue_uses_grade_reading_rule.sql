begin;

-- La cola de jefaturas daba por calificado cualquier informe con un numero en
-- Campus (`s.grade_value is not null`), asi que el 0 que deja Moodle cuando la
-- correccion real va escrita en los comentarios sacaba el informe de la cola
-- como si estuviera resuelto.
--
-- Ahora usa la misma lectura que el resto del sistema: un numero que no es una
-- nota posible no cuenta como correccion, y el informe sigue pendiente.
--
-- Ademas la columna `grade` mostraba el texto crudo de Campus
-- ("8,00 / 100,00") cuando la practica no tenia nota propia cargada. Pasa a
-- mostrar la nota ya interpretada, y deja el texto crudo solo como ultimo
-- recurso.
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
      nullif(trim(s.nota), ''),
      rtrim(rtrim(to_char(s.campus_grade, 'FM999999990.00'), '0'), '.'),
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
  'Detalle canónico de informes por área. Usa la fecha real informada por Moodle, compartida entre prácticas del mismo alumno que entregan en la misma tarea; lee la nota con read_moodle_grade_v1, así un número que no es una nota no cierra el informe; oculta prácticas viejas ya superadas por otra En curso sobre el mismo cmid cuando no tienen fecha propia.';

commit;
