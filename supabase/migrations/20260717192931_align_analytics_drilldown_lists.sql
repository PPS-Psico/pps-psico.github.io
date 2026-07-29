-- Alinea los detalles de los KPI con analytics-v1.

begin;

create or replace function public.get_estudiantes_en_pps_list_impl(p_year integer)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      make_date(p_year, 1, 1) as start_date,
      case
        when p_year = extract(year from current_date)::integer then current_date + 1
        else make_date(p_year + 1, 1, 1)
      end as end_date
  ),
  ids as (
    select distinct p.estudiante_id
    from public.practicas as p
    cross join bounds as b
    where p.tipo_actividad = 'pps'
      and p.estudiante_id is not null
      and p.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
      and left(p.fecha_inicio, 10)::date >= b.start_date
      and left(p.fecha_inicio, 10)::date < b.end_date
  )
  select coalesce(
    json_agg(
      json_build_object('nombre', e.nombre, 'legajo', e.legajo)
      order by e.nombre
    ),
    '[]'::json
  )
  from ids
  join public.estudiantes as e on e.id = ids.estudiante_id;
$$;

create or replace function public.get_finalizados_list_impl(p_year integer)
returns table(id uuid, nombre text, legajo text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nombre, e.legajo
  from public.estudiantes as e
  where e.estado = 'Finalizado'
    and e.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}'
    and left(e.fecha_finalizacion, 10)::date >= make_date(p_year, 1, 1)
    and left(e.fecha_finalizacion, 10)::date < case
      when p_year = extract(year from current_date)::integer then current_date + 1
      else make_date(p_year + 1, 1, 1)
    end
  order by e.nombre;
$$;

-- Los clientes deben entrar por los wrappers que validan public.is_staff().
revoke all on function public.get_estudiantes_en_pps_list_impl(integer)
  from public, anon, authenticated;
revoke all on function public.get_finalizados_list_impl(integer)
  from public, anon, authenticated;

commit;
