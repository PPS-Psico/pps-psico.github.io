begin;

-- observed_at responde "cuándo leyó Mi Panel"; no responde "cuándo entregó
-- el estudiante". Se conserva el timestamp real que muestra Moodle como dato
-- separado para que la cola de jefaturas no reinicie plazos al sincronizar.
alter table public.moodle_grade_observations
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_at_display text;

alter table public.moodle_grade_snapshots
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_at_display text;

comment on column public.moodle_grade_observations.submitted_at is
  'Fecha de entrega informada por Moodle. No confundir con observed_at, que es la fecha de lectura del puente.';
comment on column public.moodle_grade_observations.submitted_at_display is
  'Texto original de la fecha de entrega mostrado por Moodle, conservado para auditoría del parser.';
comment on column public.moodle_grade_snapshots.submitted_at is
  'Primera fecha de entrega Moodle confirmada para la práctica y tarea.';
comment on column public.moodle_grade_snapshots.submitted_at_display is
  'Texto Moodle correspondiente a submitted_at.';

-- Evidencia puntual aportada por Coordinación y visible en Moodle:
-- Santiago Oliva (DNI 44684830), Ministerio de Juventud, Deportes y Cultura,
-- "Enviado para calificar" el martes 21/07/2026 a la 01:12.
update public.moodle_grade_observations o
set submitted_at = timestamptz '2026-07-21 01:12:00-03',
    submitted_at_display = 'martes, 21 de julio de 2026, 01:12'
from public.practicas p
join public.estudiantes e on e.id = p.estudiante_id
where o.practica_id = p.id
  and e.dni = 44684830
  and o.cmid = 1109159
  and o.submitted = true;

update public.moodle_grade_snapshots s
set submitted_at = timestamptz '2026-07-21 01:12:00-03',
    submitted_at_display = 'martes, 21 de julio de 2026, 01:12'
from public.practicas p
join public.estudiantes e on e.id = p.estudiante_id
where s.practica_id = p.id
  and e.dni = 44684830
  and s.cmid = 1109159
  and s.submitted = true;

-- El snapshot conserva el mejor estado académico y, ahora, también la primera
-- fecha real de entrega. Una lectura vieja o incompleta no puede borrarla.
create or replace function private.preserve_moodle_grade_snapshot_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.last_observation_id := new.latest_observation_id;
    new.last_task_status := new.task_status;
    new.last_submitted := new.submitted;
    new.last_grade_value := new.grade_value;
    new.last_grade_max := new.grade_max;
    new.last_grade_display := new.grade_display;
    new.last_graded_at_display := new.graded_at_display;
    new.last_observed_at := new.observed_at;
    new.last_received_at := new.received_at;
    new.last_confidence := new.confidence;
    new.scan_closed := new.task_status = 'graded';
    return new;
  end if;

  new.last_observation_id := new.latest_observation_id;
  new.last_task_status := new.task_status;
  new.last_submitted := new.submitted;
  new.last_grade_value := new.grade_value;
  new.last_grade_max := new.grade_max;
  new.last_grade_display := new.grade_display;
  new.last_graded_at_display := new.graded_at_display;
  new.last_observed_at := new.observed_at;
  new.last_received_at := new.received_at;
  new.last_confidence := new.confidence;
  new.grade_revision := old.grade_revision;
  new.reopened_at := old.reopened_at;

  if old.submitted_at is not null
     and (new.submitted_at is null or old.submitted_at <= new.submitted_at) then
    new.submitted_at := old.submitted_at;
    new.submitted_at_display := old.submitted_at_display;
  end if;

  if old.scan_closed then
    new.latest_observation_id := old.latest_observation_id;
    new.estudiante_id := old.estudiante_id;
    new.lanzamiento_id := old.lanzamiento_id;
    new.aula_entrega_id := old.aula_entrega_id;
    new.task_status := old.task_status;
    new.submitted := old.submitted;
    new.submitted_at := old.submitted_at;
    new.submitted_at_display := old.submitted_at_display;
    new.grade_value := old.grade_value;
    new.grade_max := old.grade_max;
    new.grade_display := old.grade_display;
    new.graded_at_display := old.graded_at_display;
    new.observed_at := old.observed_at;
    new.received_at := old.received_at;
    new.confidence := old.confidence;
    new.scan_closed := true;
    return new;
  end if;

  if old.task_status = 'graded' and new.task_status <> 'graded' then
    new.latest_observation_id := old.latest_observation_id;
    new.estudiante_id := old.estudiante_id;
    new.lanzamiento_id := old.lanzamiento_id;
    new.aula_entrega_id := old.aula_entrega_id;
    new.task_status := old.task_status;
    new.submitted := old.submitted;
    new.submitted_at := old.submitted_at;
    new.submitted_at_display := old.submitted_at_display;
    new.grade_value := old.grade_value;
    new.grade_max := old.grade_max;
    new.grade_display := old.grade_display;
    new.graded_at_display := old.graded_at_display;
    new.observed_at := old.observed_at;
    new.received_at := old.received_at;
    new.confidence := old.confidence;
    new.scan_closed := false;
    return new;
  end if;

  if private.moodle_grade_status_rank(new.task_status)
     < private.moodle_grade_status_rank(old.task_status) then
    new.latest_observation_id := old.latest_observation_id;
    new.estudiante_id := old.estudiante_id;
    new.lanzamiento_id := old.lanzamiento_id;
    new.aula_entrega_id := old.aula_entrega_id;
    new.task_status := old.task_status;
    new.submitted := old.submitted;
    new.submitted_at := old.submitted_at;
    new.submitted_at_display := old.submitted_at_display;
    new.grade_value := old.grade_value;
    new.grade_max := old.grade_max;
    new.grade_display := old.grade_display;
    new.graded_at_display := old.graded_at_display;
    new.observed_at := old.observed_at;
    new.received_at := old.received_at;
    new.confidence := old.confidence;
  end if;

  new.scan_closed := new.task_status = 'graded';
  return new;
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
        source_submission.submitted_at,
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
      select min(o.submitted_at) as submitted_at
      from public.moodle_grade_observations o
      where o.practica_id = p.id
        and o.submitted = true
        and o.submitted_at is not null
    ) source_submission on true
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
        when b.submitted_at is not null
          then (b.submitted_at at time zone 'America/Argentina/Buenos_Aires')::date + 30
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

comment on function private.jefe_report_rows_v1(text[]) is
  'Detalle canónico de informes por área. Usa la fecha real informada por Moodle; observed_at nunca reinicia el plazo de corrección.';

-- Reconcilia el agregado con el detalle y evita presentar como "en plazo" una
-- entrega cuya fecha todavía no se pudo verificar.
create or replace function private.reconcile_jefe_report_queue_v1(p_payload jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  with reports as (
    select value as report
    from jsonb_array_elements(coalesce(p_payload -> 'reports', '[]'::jsonb))
  ), queue as (
    select jsonb_build_object(
      'pending', count(*) filter (where report ->> 'report_status' = 'pending'),
      'critical', count(*) filter (
        where report ->> 'report_status' = 'pending'
          and report ->> 'urgency' = 'critical'
      ),
      'soon', count(*) filter (
        where report ->> 'report_status' = 'pending'
          and report ->> 'urgency' = 'soon'
      ),
      'on_time', count(*) filter (
        where report ->> 'report_status' = 'pending'
          and report ->> 'urgency' = 'on_time'
      ),
      'undated', count(*) filter (
        where report ->> 'report_status' = 'pending'
          and report ->> 'urgency' = 'undated'
      ),
      'waiting', count(*) filter (where report ->> 'report_status' = 'waiting'),
      'corrected', count(*) filter (where report ->> 'report_status' = 'corrected')
    ) as value
    from reports
  )
  select jsonb_set(p_payload, '{queue}', queue.value, true)
  from queue;
$$;

create or replace function private.get_jefe_dashboard_v1_impl(
  p_year integer,
  p_cutoff date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dni bigint;
  v_areas text[];
begin
  v_areas := private.require_jefe_areas_v1();

  select e.dni::bigint
  into v_dni
  from public.estudiantes e
  where e.user_id = auth.uid()
    and e.role = 'Jefe'
  order by e.created_at desc nulls last
  limit 1;

  return private.reconcile_jefe_report_queue_v1(
    private.build_jefe_dashboard_v1(v_dni, v_areas, p_year, p_cutoff)
  );
end;
$$;

create or replace function private.get_jefe_dashboard_preview_v2_impl(
  p_preview_key uuid,
  p_year integer,
  p_cutoff date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dni bigint;
  v_areas text[];
  v_dni_count integer;
begin
  perform private.require_jefe_preview_access_v1();

  select
    min(a.dni),
    count(distinct a.dni)::integer,
    array_agg(a.area_key order by a.sort_order, a.area_key)
  into v_dni, v_dni_count, v_areas
  from private.jefe_area_assignments a
  where a.preview_key = p_preview_key;

  if v_dni is null or v_dni_count <> 1 or coalesce(cardinality(v_areas), 0) = 0 then
    raise exception 'Unknown jefe preview identity' using errcode = '22023';
  end if;

  return private.reconcile_jefe_report_queue_v1(
    private.build_jefe_dashboard_v1(v_dni, v_areas, p_year, p_cutoff)
  );
end;
$$;

revoke all on function private.reconcile_jefe_report_queue_v1(jsonb)
  from public, anon, authenticated;
grant execute on function private.reconcile_jefe_report_queue_v1(jsonb)
  to service_role;

commit;
