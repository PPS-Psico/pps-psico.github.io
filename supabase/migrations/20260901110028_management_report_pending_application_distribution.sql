create or replace function private.get_management_pending_application_distribution_v1(
  p_cutoff date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with bounds as (
  select
    least(coalesce(p_cutoff, current_date), current_date) as cutoff,
    extract(
      year from least(coalesce(p_cutoff, current_date), current_date)
    )::integer as cutoff_year
),
eligible_launches as (
  select launch.id
  from public.lanzamientos_pps as launch
  cross join bounds
  where launch.tipo_actividad = 'pps'
    and launch.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
    and left(launch.fecha_inicio, 10)::date between
      make_date(bounds.cutoff_year, 1, 1) and bounds.cutoff
),
attempts_by_student as (
  select
    application.estudiante_id,
    count(distinct application.lanzamiento_id)::integer as applications
  from public.convocatorias as application
  join eligible_launches as launch
    on launch.id = application.lanzamiento_id
  where application.estudiante_id is not null
  group by application.estudiante_id
),
current_year_starters as (
  select distinct practice.estudiante_id
  from public.practicas as practice
  cross join bounds
  where practice.tipo_actividad = 'pps'
    and practice.estudiante_id is not null
    and practice.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
    and left(practice.fecha_inicio, 10)::date between
      make_date(bounds.cutoff_year, 1, 1) and bounds.cutoff
),
pps_holders_by_cutoff as (
  select distinct practice.estudiante_id
  from public.practicas as practice
  cross join bounds
  where practice.tipo_actividad = 'pps'
    and practice.estudiante_id is not null
    and practice.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
    and left(practice.fecha_inicio, 10)::date <= bounds.cutoff
),
pending_students as (
  select
    attempts.estudiante_id,
    attempts.applications,
    holder.estudiante_id is null as without_any_pps
  from attempts_by_student as attempts
  left join current_year_starters as starter
    on starter.estudiante_id = attempts.estudiante_id
  left join pps_holders_by_cutoff as holder
    on holder.estudiante_id = attempts.estudiante_id
  where starter.estudiante_id is null
),
distribution as (
  select
    pending.applications,
    count(*)::integer as students,
    count(*) filter (
      where pending.without_any_pps
    )::integer as without_any_pps
  from pending_students as pending
  group by pending.applications
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'applications', distribution.applications,
      'students', distribution.students,
      'without_any_pps', distribution.without_any_pps
    ) order by distribution.applications
  ),
  '[]'::jsonb
)
from distribution;
$$;

revoke all on function private.get_management_pending_application_distribution_v1(date)
  from public, anon, authenticated, service_role;

create or replace function public.get_management_report_v1(
  p_cutoff date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if not public.is_staff() then
    raise exception 'Acceso restringido al personal autorizado'
      using errcode = '42501';
  end if;

  if p_cutoff is not null and p_cutoff < date '2024-01-01' then
    raise exception 'La fecha de corte debe ser igual o posterior al 01/01/2024'
      using errcode = '22023';
  end if;

  report := private.get_management_report_v1_impl(p_cutoff);

  return jsonb_set(
    report,
    '{access,pending_application_distribution}',
    private.get_management_pending_application_distribution_v1(p_cutoff),
    true
  );
end;
$$;

revoke all on function public.get_management_report_v1(date) from public, anon;
grant execute on function public.get_management_report_v1(date)
  to authenticated, service_role;

comment on function public.get_management_report_v1(date) is
  'Contrato agregado y sin PII para el informe dinámico de gestión PPS desde 2024.';
