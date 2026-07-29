-- LOCAL-ONLY REPLAY OVERLAY. DO NOT DEPLOY.
-- Recovered from the tracked metrics_rpcs.sql snapshot introduced alongside
-- the April metrics RPCs. Production still contains this body as
-- get_activos_list_impl(integer), but its creation is absent from the ledger.

create or replace function public.get_activos_list(p_year integer)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  with first_activities as (
    select estudiante_id, min(dt) as first_activity
    from (
      select estudiante_id, created_at as dt
      from public.convocatorias where estudiante_id is not null
      union all
      select estudiante_id, coalesce(public.safe_date_cast(fecha_inicio), created_at)
      from public.practicas where estudiante_id is not null
    ) sub
    group by estudiante_id
  ), grad_dates as (
    select id, public.safe_date_cast(fecha_finalizacion) as gd
    from public.estudiantes
    where lower(estado) = 'finalizado'
      and fecha_finalizacion is not null
      and fecha_finalizacion != ''
  )
  select coalesce(json_agg(json_build_object(
    'id', e.id, 'nombre', e.nombre, 'legajo', e.legajo,
    'correo', e.correo, 'estado', e.estado
  )), '[]'::json)
  into result
  from first_activities fa
  join public.estudiantes e on e.id = fa.estudiante_id
  left join grad_dates g on g.id = fa.estudiante_id
  where extract(year from fa.first_activity) <= p_year
    and (g.gd is null or extract(year from g.gd) >= p_year);

  return result;
end;
$$;


create or replace function public.get_metrics_years()
returns json
language sql
security definer
as $$
  select coalesce(
    json_agg(y order by y desc),
    json_build_array(extract(year from now())::int)
  )
  from (
    select distinct y
    from (
      select extract(year from coalesce(public.safe_date_cast(fecha_inicio), created_at))::int as y
      from public.lanzamientos_pps
      union
      select extract(year from now())::int
    ) years
    where y is not null
  ) available_years;
$$;
