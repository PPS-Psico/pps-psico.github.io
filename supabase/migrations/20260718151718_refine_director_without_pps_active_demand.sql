-- Refina la cohorte "sin PPS" del informe de Direccion.
--
-- Conserva solamente estudiantes sin practicas que demostraron demanda activa:
-- al menos una postulacion a una oferta PPS durante el ciclo informado y hasta
-- la fecha de corte. Los conteos de postulaciones del listado pasan a ser
-- anuales, no historicos.

begin;

create or replace function private.get_director_report_active_demand_v1_impl(
  p_year integer,
  p_snapshot_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_snapshot_date date := least(coalesce(p_snapshot_date, current_date), current_date);
  v_period_start date := make_date(p_year, 1, 1);
  v_period_end_exclusive date;
  v_result jsonb;
  v_without_pps_students jsonb := '[]'::jsonb;
  v_without_pps_count integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Acceso restringido al personal autorizado'
      using errcode = '42501';
  end if;

  v_period_end_exclusive := case
    when p_year = extract(year from v_snapshot_date)::integer
      then v_snapshot_date + 1
    else make_date(p_year + 1, 1, 1)
  end;

  v_result := private.get_director_report_v1_impl(p_year, v_snapshot_date);

  with report_candidates as (
    select
      (candidate ->> 'student_id')::uuid as student_id,
      candidate
    from jsonb_array_elements(
      coalesce(v_result -> 'without_pps_students', '[]'::jsonb)
    ) as candidates(candidate)
  ),
  annual_applications as (
    select
      c.estudiante_id,
      count(*)::integer as application_count,
      count(*) filter (
        where c.estado_inscripcion = 'Inscripto'
      )::integer as pending_applications
    from public.convocatorias as c
    join public.lanzamientos_pps as l on l.id = c.lanzamiento_id
    where (c.created_at at time zone 'America/Argentina/Buenos_Aires')::date
        >= v_period_start
      and (c.created_at at time zone 'America/Argentina/Buenos_Aires')::date
        < v_period_end_exclusive
      and coalesce(l.tipo_actividad, 'pps') = 'pps'
    group by c.estudiante_id
  ),
  active_without_pps as (
    select
      jsonb_set(
        jsonb_set(
          rc.candidate,
          '{application_count}',
          to_jsonb(aa.application_count),
          true
        ),
        '{pending_applications}',
        to_jsonb(aa.pending_applications),
        true
      ) as candidate
    from report_candidates as rc
    join annual_applications as aa on aa.estudiante_id = rc.student_id
  )
  select
    count(*)::integer,
    coalesce(
      jsonb_agg(candidate order by candidate ->> 'full_name', candidate ->> 'legajo'),
      '[]'::jsonb
    )
  into v_without_pps_count, v_without_pps_students
  from active_without_pps;

  v_result := jsonb_set(
    v_result,
    '{student_summary,without_pps}',
    to_jsonb(v_without_pps_count),
    true
  );
  v_result := jsonb_set(
    v_result,
    '{without_pps_students}',
    v_without_pps_students,
    true
  );
  v_result := jsonb_set(
    v_result,
    '{criteria,without_pps_active_demand}',
    jsonb_build_object(
      'requires_annual_application', true,
      'application_date_from', v_period_start,
      'application_date_to', v_period_end_exclusive - 1,
      'activity_type', 'pps'
    ),
    true
  );

  return v_result;
end;
$$;

revoke all on function private.get_director_report_active_demand_v1_impl(integer, date)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.get_director_report_active_demand_v1_impl(integer, date)
  to authenticated;

create or replace function public.get_director_report_v1(
  p_year integer,
  p_snapshot_date date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Acceso restringido al personal autorizado'
      using errcode = '42501';
  end if;

  return private.get_director_report_active_demand_v1_impl(p_year, p_snapshot_date);
end;
$$;

revoke all on function public.get_director_report_v1(integer, date)
  from public, anon, authenticated;
grant execute on function public.get_director_report_v1(integer, date)
  to authenticated;

comment on function public.get_director_report_v1(integer, date) is
  'Informe nominal restringido para Direccion: sin PPS requiere postulacion PPS en el ciclo.';

commit;
