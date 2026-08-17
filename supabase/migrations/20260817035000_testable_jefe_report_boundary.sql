-- Extrae la clasificación temporal para que el límite operativo pueda probarse
-- con fechas fijas, sin depender de los informes existentes el día del test.

create or replace function private.jefe_report_status_v1(
  p_graded boolean,
  p_submitted boolean,
  p_deadline date,
  p_today date
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_graded then 'corrected'
    when p_submitted
      and p_deadline is not null
      and p_deadline < p_today - 60
      then 'stale'
    when p_submitted then 'pending'
    else 'waiting'
  end;
$$;

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
  with base as (
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
        first_submission.submitted_at,
        case
          when c.fecha_entrega_informe ~ '^\d{4}-\d{2}-\d{2}$'
            then c.fecha_entrega_informe::date::timestamptz
          else null
        end
      ) as submitted_at,
      (
        first_submission.submitted_at is not null
        or coalesce(s.submitted, false)
        or coalesce(c.informe_subido, false)
        or lower(coalesce(p.informe_estado, '')) in ('entregado', 'calificado')
      ) as submitted,
      (
        lower(coalesce(p.informe_estado, '')) = 'calificado'
        or coalesce(p.nota, '') ~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
        or lower(trim(coalesce(p.nota, ''))) = 'desaprobado'
        or s.grade_value is not null
      ) as graded
    from public.practicas p
    left join public.estudiantes e on e.id = p.estudiante_id
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    left join public.instituciones i
      on i.id::text = coalesce(p.institucion_id::text, l.institucion_id)
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
      select min(o.observed_at) as submitted_at
      from public.moodle_grade_observations o
      where o.practica_id = p.id
        and o.submitted = true
    ) first_submission on true
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and exists (
        select 1
        from unnest(p_areas) area_key
        where private.jefe_text_has_area(
          coalesce(p.especialidad, l.orientacion),
          area_key
        )
      )
  ), classified as (
    select
      b.*,
      case
        when b.submitted_at is not null then b.submitted_at::date + 30
        else null
      end as deadline_at
    from base b
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

revoke all on function private.jefe_report_status_v1(boolean, boolean, date, date)
  from public, anon, authenticated;
revoke all on function private.jefe_report_rows_v1(text[])
  from public, anon, authenticated;

grant execute on function private.jefe_report_status_v1(boolean, boolean, date, date)
  to service_role;
grant execute on function private.jefe_report_rows_v1(text[])
  to service_role;

comment on function private.jefe_report_status_v1(boolean, boolean, date, date) is
  'Clasifica un informe con frontera determinista: hasta 60 días de atraso sigue pending; desde 61 pasa a stale.';
