-- Capa semántica versionada para los KPIs comparables del reporte.

begin;

create or replace function public.get_analytics_v1(
  p_year integer,
  p_cutoff date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with bounds as (
  select
    make_date(p_year, 1, 1) as start_date,
    least(p_cutoff, make_date(p_year, 12, 31)) + 1 as end_date
),
cycle_launches as (
  select l.*
  from public.lanzamientos_pps as l
  cross join bounds as b
  where l.tipo_actividad = 'pps'
    and l.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
    and left(l.fecha_inicio, 10)::date >= b.start_date
    and left(l.fecha_inicio, 10)::date < b.end_date
),
selected_pairs as (
  select c.lanzamiento_id, c.estudiante_id
  from public.convocatorias as c
  join cycle_launches as l on l.id = c.lanzamiento_id
  where c.estado_inscripcion = 'Seleccionado'
    and c.estudiante_id is not null
  union
  select p.lanzamiento_id, p.estudiante_id
  from public.practicas as p
  join cycle_launches as l on l.id = p.lanzamiento_id
  where p.tipo_actividad = 'pps'
    and p.estudiante_id is not null
),
capacity_by_launch as (
  select
    l.id,
    l.modalidad_cupo,
    coalesce(l.cupos_disponibles, 0) as stored_capacity,
    count(sp.estudiante_id)::integer as selected_students,
    case
      when l.modalidad_cupo = 'realizado' then count(sp.estudiante_id)::integer
      else coalesce(l.cupos_disponibles, 0)
    end as operational_capacity
  from cycle_launches as l
  left join selected_pairs as sp on sp.lanzamiento_id = l.id
  group by l.id, l.modalidad_cupo, l.cupos_disponibles
),
demand as (
  select
    count(*)::integer as applications,
    count(distinct c.estudiante_id)::integer as applicants
  from public.convocatorias as c
  join cycle_launches as l on l.id = c.lanzamiento_id
),
flows as (
  select
    (
      select count(distinct p.estudiante_id)::integer
      from public.practicas as p
      cross join bounds as b
      where p.tipo_actividad = 'pps'
        and p.estudiante_id is not null
        and p.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
        and left(p.fecha_inicio, 10)::date >= b.start_date
        and left(p.fecha_inicio, 10)::date < b.end_date
    ) as pps_started,
    (
      select count(distinct e.id)::integer
      from public.estudiantes as e
      cross join bounds as b
      where e.estado = 'Finalizado'
        and e.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}'
        and left(e.fecha_finalizacion, 10)::date >= b.start_date
        and left(e.fecha_finalizacion, 10)::date < b.end_date
    ) as finalized
),
selection_quality as (
  select
    count(*)::integer as selected_rows,
    count(*) filter (where c.selected_at is not null)::integer as selected_at_rows
  from public.convocatorias as c
  join cycle_launches as l on l.id = c.lanzamiento_id
  where c.estado_inscripcion = 'Seleccionado'
),
practice_quality as (
  select
    count(*)::integer as total_rows,
    count(*) filter (where p.lanzamiento_id is not null)::integer as linked_rows
  from public.practicas as p
  cross join bounds as b
  where p.tipo_actividad = 'pps'
    and p.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
    and left(p.fecha_inicio, 10)::date >= b.start_date
    and left(p.fecha_inicio, 10)::date < b.end_date
),
launch_quality as (
  select
    count(*)::integer as total_rows,
    count(*) filter (where l.institucion_id is not null)::integer as linked_rows
  from cycle_launches as l
),
current_stocks as (
  select
    (select count(*)::integer from public.estudiantes where estado = 'Activo') as active_students,
    (
      select count(distinct p.estudiante_id)::integer
      from public.practicas as p
      join public.estudiantes as e on e.id = p.estudiante_id
      where e.estado = 'Activo'
        and p.tipo_actividad = 'pps'
        and lower(coalesce(p.estado, '')) in ('en curso', 'en proceso')
    ) as active_students_with_current_pps
)
select jsonb_build_object(
  'metric_version', 'analytics-v1',
  'year', p_year,
  'cutoff', least(p_cutoff, make_date(p_year, 12, 31)),
  'as_of', statement_timestamp(),
  'flows', jsonb_build_object(
    'pps_started', f.pps_started,
    'finalized', f.finalized,
    'applications', d.applications,
    'applicants', d.applicants,
    'demand_available', p_year >= 2025
  ),
  'capacity', jsonb_build_object(
    'fixed_offered', coalesce(sum(c.operational_capacity) filter (where c.modalidad_cupo = 'fijo'), 0),
    'realized', coalesce(sum(c.operational_capacity) filter (where c.modalidad_cupo = 'realizado'), 0),
    'operational', coalesce(sum(c.operational_capacity), 0),
    'launches', count(c.id),
    'fixed_over_capacity_launches', count(*) filter (
      where c.modalidad_cupo = 'fijo' and c.selected_students > c.stored_capacity
    )
  ),
  'stocks', jsonb_build_object(
    'as_of', statement_timestamp(),
    'active_students', s.active_students,
    'active_students_with_current_pps', s.active_students_with_current_pps,
    'historically_comparable', false
  ),
  'quality', jsonb_build_object(
    'selected_at_n', sq.selected_at_rows,
    'selected_total_n', sq.selected_rows,
    'selected_at_coverage_pct', case
      when sq.selected_rows = 0 then null
      else round(100.0 * sq.selected_at_rows / sq.selected_rows, 1)
    end,
    'practice_launch_link_coverage_pct', case
      when pq.total_rows = 0 then null
      else round(100.0 * pq.linked_rows / pq.total_rows, 1)
    end,
    'launch_institution_link_coverage_pct', case
      when lq.total_rows = 0 then null
      else round(100.0 * lq.linked_rows / lq.total_rows, 1)
    end
  )
)
from flows as f
cross join demand as d
cross join selection_quality as sq
cross join practice_quality as pq
cross join launch_quality as lq
cross join current_stocks as s
left join capacity_by_launch as c on true
group by
  f.pps_started,
  f.finalized,
  d.applications,
  d.applicants,
  sq.selected_at_rows,
  sq.selected_rows,
  pq.total_rows,
  pq.linked_rows,
  lq.total_rows,
  lq.linked_rows,
  s.active_students,
  s.active_students_with_current_pps;
$$;

comment on function public.get_analytics_v1(integer, date) is
  'Contrato analytics-v1: flujos, capacidad, stocks actuales y calidad con corte explícito.';

revoke all on function public.get_analytics_v1(integer, date) from public, anon;
grant execute on function public.get_analytics_v1(integer, date) to authenticated;

commit;
