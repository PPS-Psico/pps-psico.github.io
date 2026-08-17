-- Vista previa real y de solo lectura del panel Jefe para el entorno de
-- simulacion. El calculo comun queda en una funcion privada parametrizada; el
-- RPC publico solo acepta jefaturas configuradas y vuelve a validar en DB que
-- quien llama sea SuperUser/AdminTester (incluye la cuenta admin legacy).

create or replace function private.build_jefe_dashboard_v1(
  p_dni bigint,
  p_areas text[],
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
  v_profile jsonb;
  v_reports jsonb;
  v_queue jsonb;
  v_panorama jsonb;
  v_current jsonb;
  v_effective_cutoff date;
begin
  if p_year < 2024 or p_year > extract(year from current_date)::integer + 1 then
    raise exception 'Year out of range';
  end if;

  if p_dni is null or coalesce(cardinality(p_areas), 0) = 0 then
    raise exception 'Jefe identity and areas are required' using errcode = '22023';
  end if;

  v_effective_cutoff := least(
    coalesce(p_cutoff, current_date),
    make_date(p_year, 12, 31)
  );

  select jsonb_build_object(
    'name', coalesce(nullif(trim(e.nombre), ''), 'Jefatura'),
    'dni', p_dni,
    'areas', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', a.area_key, 'label', a.area_label)
        order by a.sort_order
      )
      from private.jefe_area_assignments a
      where a.dni = p_dni
        and a.area_key = any(p_areas)
    ), '[]'::jsonb)
  )
  into v_profile
  from public.estudiantes e
  where e.dni::bigint = p_dni
  order by (e.role = 'Jefe') desc, e.created_at desc nulls last
  limit 1;

  if v_profile is null then
    raise exception 'Jefe profile not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  into v_reports
  from private.jefe_report_rows_v1(p_areas) r;

  select jsonb_build_object(
    'pending', count(*) filter (where r.report_status = 'pending'),
    'critical', count(*) filter (where r.report_status = 'pending' and r.urgency = 'critical'),
    'soon', count(*) filter (where r.report_status = 'pending' and r.urgency = 'soon'),
    'on_time', count(*) filter (where r.report_status = 'pending' and r.urgency in ('on_time', 'undated')),
    'waiting', count(*) filter (where r.report_status = 'waiting'),
    'corrected', count(*) filter (where r.report_status = 'corrected')
  )
  into v_queue
  from private.jefe_report_rows_v1(p_areas) r;

  with offers as (
    select * from private.jefe_annual_offers_v1(p_areas, p_year, v_effective_cutoff)
  ), institutions as (
    select
      o.institution_name,
      count(*)::integer as offer_count,
      coalesce(sum(o.fixed_capacity), 0)::integer as fixed_capacity,
      coalesce(sum(o.realized_capacity), 0)::integer as realized_capacity
    from offers o
    group by o.institution_name
  ), months as (
    select
      m.month_number,
      count(o.offer_id)::integer as offers
    from generate_series(1, 12) as m(month_number)
    left join offers o on extract(month from o.announced_at)::integer = m.month_number
    group by m.month_number
    order by m.month_number
  ), areas as (
    select
      a.area_key,
      aa.area_label,
      count(o.offer_id)::integer as offers,
      coalesce(sum(o.fixed_capacity), 0)::integer
        + coalesce(sum(o.realized_capacity), 0)::integer as registered_capacity
    from unnest(p_areas) a(area_key)
    join private.jefe_area_assignments aa
      on aa.area_key = a.area_key
     and aa.dni = p_dni
    left join offers o on private.jefe_text_has_area(o.orientation, a.area_key)
    group by a.area_key, aa.area_label, aa.sort_order
    order by aa.sort_order
  ), started as (
    select count(distinct p.estudiante_id)::integer as students
    from public.practicas p
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    cross join lateral (
      select case
        when p.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}$' then p.fecha_inicio::date
        when l.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}$' then l.fecha_inicio::date
        else null
      end as start_date
    ) d
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and d.start_date is not null
      and extract(year from d.start_date)::integer = p_year
      and d.start_date <= v_effective_cutoff
      and exists (
        select 1 from unnest(p_areas) area_key
        where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
      )
  ), demand as (
    select
      count(c.id)::integer as applications,
      count(distinct c.estudiante_id)::integer as applicants
    from public.convocatorias c
    join public.lanzamientos_pps l on l.id = c.lanzamiento_id
    where l.tipo_actividad = 'pps'
      and exists (
        select 1
        from offers o
        where o.offer_id = l.id::text
      )
  )
  select jsonb_build_object(
    'year', p_year,
    'cutoff', v_effective_cutoff,
    'source', case when p_year = 2024 then 'historical_documented' else 'operational_live' end,
    'offers', (select count(*) from offers),
    'capacity', jsonb_build_object(
      'total', (select coalesce(sum(fixed_capacity), 0) + coalesce(sum(realized_capacity), 0) from offers),
      'fixed', (select coalesce(sum(fixed_capacity), 0) from offers),
      'realized', (select coalesce(sum(realized_capacity), 0) from offers),
      'unknown_offers', (select count(*) from offers where capacity_mode = 'desconocido')
    ),
    'institutions_count', (select count(*) from institutions),
    'institutions', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.offer_count desc, i.institution_name)
      from institutions i
    ), '[]'::jsonb),
    'students_started', (select students from started),
    'applications', (select applications from demand),
    'applicants', (select applicants from demand),
    'months', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.month_number) from months m
    ), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(to_jsonb(a)) from areas a), '[]'::jsonb)
  )
  into v_panorama;

  select jsonb_build_object(
    'as_of', (now() at time zone 'America/Argentina/Buenos_Aires')::date,
    'active_practices', count(distinct p.id) filter (
      where lower(coalesce(p.estado, '')) in (
        'activo', 'activa', 'en curso', 'en_curso', 'en proceso', 'en_proceso'
      )
    ),
    'open_offers', (
      select count(*)
      from public.lanzamientos_pps l
      where l.tipo_actividad = 'pps'
        and lower(coalesce(l.estado_convocatoria, '')) = 'abierta'
        and exists (
          select 1 from unnest(p_areas) area_key
          where private.jefe_text_has_area(l.orientacion, area_key)
        )
    ),
    'pending_reports', (v_queue ->> 'pending')::integer,
    'critical_reports', (v_queue ->> 'critical')::integer
  )
  into v_current
  from public.practicas p
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  where exists (
    select 1 from unnest(p_areas) area_key
    where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
  );

  return jsonb_build_object(
    'generated_at', now(),
    'profile', v_profile,
    'queue', v_queue,
    'reports', v_reports,
    'panorama', v_panorama,
    'current', v_current
  );
end;
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

  return private.build_jefe_dashboard_v1(v_dni, v_areas, p_year, p_cutoff);
end;
$$;

create or replace function private.require_jefe_preview_access_v1()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.estudiantes e
    where e.user_id = auth.uid()
      and e.role in ('SuperUser', 'AdminTester')
  ) and not exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'admin@uflo.edu.ar'
  ) then
    raise exception 'Testing administrator role required' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.get_jefe_dashboard_preview_v1_impl(
  p_dni bigint,
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
  v_areas text[];
begin
  perform private.require_jefe_preview_access_v1();

  select array_agg(a.area_key order by a.sort_order, a.area_key)
  into v_areas
  from private.jefe_area_assignments a
  where a.dni = p_dni;

  if coalesce(cardinality(v_areas), 0) = 0 then
    raise exception 'Unknown jefe preview identity' using errcode = '22023';
  end if;

  return private.build_jefe_dashboard_v1(p_dni, v_areas, p_year, p_cutoff);
end;
$$;

create or replace function public.get_jefe_dashboard_preview_v1(
  p_dni bigint,
  p_year integer,
  p_cutoff date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_jefe_dashboard_preview_v1_impl(p_dni, p_year, p_cutoff);
$$;

revoke all on function private.build_jefe_dashboard_v1(bigint, text[], integer, date)
  from public, anon, authenticated;
revoke all on function private.require_jefe_preview_access_v1()
  from public, anon, authenticated;
revoke all on function private.get_jefe_dashboard_preview_v1_impl(bigint, integer, date)
  from public, anon, authenticated;
revoke all on function public.get_jefe_dashboard_preview_v1(bigint, integer, date)
  from public, anon;

grant execute on function private.get_jefe_dashboard_preview_v1_impl(bigint, integer, date)
  to authenticated;
grant execute on function public.get_jefe_dashboard_preview_v1(bigint, integer, date)
  to authenticated;

comment on function public.get_jefe_dashboard_preview_v1(bigint, integer, date) is
  'Vista previa solo lectura del panel de una jefatura configurada. Exclusiva para SuperUser/AdminTester.';
