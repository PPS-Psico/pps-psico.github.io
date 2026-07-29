-- Harden reporting/security-definer functions that are still too open.

create or replace function public.get_user_creation_dates()
returns table(user_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if (select auth.role()) <> 'service_role'
     and not exists (
       select 1
       from public.estudiantes e
       where e.user_id = (select auth.uid())
         and e.role = any (array['SuperUser'::text, 'Jefe'::text, 'Directivo'::text, 'AdminTester'::text, 'Reportero'::text])
     ) then
    raise exception 'forbidden';
  end if;

  return query
  select au.id, au.created_at
  from auth.users au;
end;
$$;

create or replace function public.get_dashboard_metrics(target_year integer)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
    start_date date := make_date(target_year, 1, 1);
    end_date date := make_date(target_year, 12, 31);
    snapshot_date date := least(current_date, end_date);
    active_students_ids uuid[] := '{}';
    kpi_active jsonb := '{}'::jsonb;
    kpi_in_pps jsonb := '{}'::jsonb;
    kpi_near_finish jsonb := '{}'::jsonb;
    kpi_zero_pps jsonb := '{}'::jsonb;
    kpi_pps_this_year jsonb := '{}'::jsonb;
    kpi_no_pps_this_year jsonb := '{}'::jsonb;
    kpi_ready jsonb := '{}'::jsonb;
    kpi_finished jsonb := '{}'::jsonb;
    kpi_launches jsonb := '[]'::jsonb;
    kpi_new_agreements jsonb := '[]'::jsonb;
    kpi_active_inst jsonb := '[]'::jsonb;
    total_cupos int := 0;
    total_cupos_relevamiento int := 0;
    monthly_launches jsonb := '[]'::jsonb;
begin
    if (select auth.role()) <> 'service_role'
       and not exists (
         select 1
         from public.estudiantes e
         where e.user_id = (select auth.uid())
           and e.role = any (array['SuperUser'::text, 'Jefe'::text, 'Directivo'::text, 'AdminTester'::text, 'Reportero'::text])
       ) then
      raise exception 'forbidden';
    end if;

    with active_base as (
        select id, legajo, nombre
        from estudiantes
        where created_at::date <= snapshot_date
        and (
            (finalizaron is not true) or
            (fecha_finalizacion is not null and fecha_finalizacion::date >= start_date)
        )
    )
    select
        coalesce(array_agg(id), '{}'),
        jsonb_build_object(
            'value', count(*),
            'list', coalesce(jsonb_agg(jsonb_build_object('legajo', legajo, 'nombre', nombre)), '[]'::jsonb)
        )
    into active_students_ids, kpi_active
    from active_base;

    select jsonb_build_object(
        'value', count(distinct e.id),
        'list', coalesce(jsonb_agg(distinct jsonb_build_object(
            'legajo', e.legajo,
            'nombre', e.nombre,
            'institucion', p.nombre_institucion,
            'fechaFin', p.fecha_finalizacion
        )), '[]'::jsonb)
    )
    into kpi_in_pps
    from practicas p
    join estudiantes e on p.estudiante_id = e.id
    where e.id = any(active_students_ids)
    and (p.estado ilike 'En curso' or p.estado ilike 'En proceso');

    with hours_sum as (
        select estudiante_id, sum(coalesce(horas_realizadas, 0)) as total_horas
        from practicas
        group by estudiante_id
    )
    select jsonb_build_object(
        'value', count(*),
        'list', coalesce(jsonb_agg(jsonb_build_object(
            'legajo', e.legajo,
            'nombre', e.nombre,
            'totalHoras', h.total_horas
        )), '[]'::jsonb)
    )
    into kpi_near_finish
    from hours_sum h
    join estudiantes e on h.estudiante_id = e.id
    where e.id = any(active_students_ids)
    and h.total_horas >= 230 and h.total_horas < 250;

    select jsonb_build_object(
        'value', count(*),
        'list', coalesce(jsonb_agg(jsonb_build_object('legajo', legajo, 'nombre', nombre)), '[]'::jsonb)
    )
    into kpi_zero_pps
    from estudiantes e
    where e.id = any(active_students_ids)
    and not exists (select 1 from practicas p where p.estudiante_id = e.id);

    select jsonb_build_object(
        'value', count(distinct e.id),
        'list', coalesce(jsonb_agg(distinct jsonb_build_object('legajo', e.legajo, 'nombre', e.nombre)), '[]'::jsonb)
    )
    into kpi_pps_this_year
    from practicas p
    join estudiantes e on p.estudiante_id = e.id
    where p.fecha_inicio::date >= start_date and p.fecha_inicio::date <= end_date;

    with pps_this_year_ids as (
        select distinct estudiante_id from practicas
        where fecha_inicio::date >= start_date and fecha_inicio::date <= end_date
    )
    select jsonb_build_object(
        'value', count(*),
        'list', coalesce(jsonb_agg(jsonb_build_object('legajo', legajo, 'nombre', nombre)), '[]'::jsonb)
    )
    into kpi_no_pps_this_year
    from estudiantes e
    where e.id = any(active_students_ids)
    and e.id not in (select estudiante_id from pps_this_year_ids);

    with student_totals as (
        select estudiante_id, sum(coalesce(horas_realizadas, 0)) as total
        from practicas
        group by estudiante_id
    )
    select jsonb_build_object(
        'value', count(*),
        'list', coalesce(jsonb_agg(jsonb_build_object('legajo', e.legajo, 'nombre', e.nombre, 'totalHoras', t.total)), '[]'::jsonb)
    )
    into kpi_ready
    from student_totals t
    join estudiantes e on t.estudiante_id = e.id
    where e.id = any(active_students_ids)
    and t.total >= 250;

    select jsonb_build_object(
        'value', count(*),
        'list', coalesce(jsonb_agg(jsonb_build_object('legajo', legajo, 'nombre', nombre)), '[]'::jsonb)
    )
    into kpi_finished
    from estudiantes
    where finalizaron is true
    and fecha_finalizacion::date >= start_date and fecha_finalizacion::date <= end_date;

    select jsonb_build_object(
        'value', count(*),
        'list', coalesce(jsonb_agg(jsonb_build_object(
            'nombre', nombre_pps,
            'cupos', cupos_disponibles,
            'legajo', to_char(fecha_inicio::date, 'DD/MM/YYYY')
        )), '[]'::jsonb)
    )
    into kpi_launches
    from lanzamientos_pps
    where fecha_inicio::date >= start_date and fecha_inicio::date <= end_date;

    select jsonb_build_object(
        'value', count(distinct i.id),
        'list', coalesce(jsonb_agg(distinct jsonb_build_object('nombre', i.nombre, 'cupos', 0)), '[]'::jsonb)
    )
    into kpi_new_agreements
    from instituciones i
    join lanzamientos_pps l on l.nombre_pps ilike (i.nombre || '%')
    where i.convenio_nuevo is true
    and l.fecha_inicio::date >= start_date and l.fecha_inicio::date <= end_date;

    select jsonb_build_object(
        'value', count(distinct split_part(nombre_pps, ' - ', 1)),
        'list', coalesce(jsonb_agg(distinct jsonb_build_object(
            'nombre', split_part(nombre_pps, ' - ', 1),
            'legajo', orientacion,
            'cupos', 0
        )), '[]'::jsonb)
    )
    into kpi_active_inst
    from lanzamientos_pps
    where fecha_inicio::date >= start_date and fecha_inicio::date <= end_date;

    select coalesce(sum(cupos_disponibles), 0) into total_cupos
    from lanzamientos_pps
    where fecha_inicio::date >= start_date and fecha_inicio::date <= end_date;

    select coalesce(sum(cupos_disponibles), 0) into total_cupos_relevamiento
    from lanzamientos_pps
    where fecha_inicio::date >= start_date and fecha_inicio::date <= end_date
    and nombre_pps ilike '%relevamiento%';

    select coalesce(jsonb_agg(jsonb_build_object(
        'groupName', split_part(nombre_pps, ' - ', 1),
        'totalCupos', cupos_disponibles,
        'variants', jsonb_build_array(jsonb_build_object('id', id, 'name', nombre_pps, 'cupos', cupos_disponibles))
    )), '[]'::jsonb)
    into monthly_launches
    from lanzamientos_pps
    where date_part('month', fecha_inicio::date) = date_part('month', current_date)
    and date_part('year', fecha_inicio::date) = date_part('year', current_date);

    return jsonb_build_object(
        'alumnosActivos', kpi_active,
        'alumnosEnPPS', kpi_in_pps,
        'alumnosProximosAFinalizar', kpi_near_finish,
        'alumnosSinNingunaPPS', kpi_zero_pps,
        'alumnosConPpsEsteAno', kpi_pps_this_year,
        'alumnosActivosSinPpsEsteAno', kpi_no_pps_this_year,
        'alumnosParaAcreditar', kpi_ready,
        'alumnosFinalizados', kpi_finished,
        'ppsLanzadas', kpi_launches,
        'nuevosConvenios', kpi_new_agreements,
        'activeInstitutions', kpi_active_inst,
        'cuposOfrecidos', jsonb_build_object('value', total_cupos),
        'cuposTotalesConRelevamiento', jsonb_build_object('value', total_cupos_relevamiento),
        'lanzamientosMesActual', monthly_launches
    );
end;
$$;

alter function public.increment_snooze_count(uuid) set search_path = 'public';

revoke execute on function public.get_user_creation_dates() from public, anon;
revoke execute on function public.get_dashboard_metrics(integer) from public, anon;

grant execute on function public.get_user_creation_dates() to authenticated, service_role;
grant execute on function public.get_dashboard_metrics(integer) to authenticated, service_role;
