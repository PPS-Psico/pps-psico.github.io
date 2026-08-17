-- Keep the operational snapshot aligned with the canonical active-practice vocabulary.
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
  v_areas text[];
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

  v_areas := private.require_jefe_areas_v1();
  v_effective_cutoff := least(
    coalesce(p_cutoff, current_date),
    make_date(p_year, 12, 31)
  );

  select jsonb_build_object(
    'name', coalesce(nullif(trim(e.nombre), ''), 'Jefatura'),
    'dni', e.dni::bigint,
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('key', a.area_key, 'label', a.area_label) order by a.sort_order)
      from private.jefe_area_assignments a
      where a.dni = e.dni::bigint
        and a.area_key = any(v_areas)
    ), '[]'::jsonb)
  )
  into v_profile
  from public.estudiantes e
  where e.user_id = auth.uid()
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  into v_reports
  from private.jefe_report_rows_v1(v_areas) r;

  select jsonb_build_object(
    'pending', count(*) filter (where r.report_status = 'pending'),
    'critical', count(*) filter (where r.report_status = 'pending' and r.urgency = 'critical'),
    'soon', count(*) filter (where r.report_status = 'pending' and r.urgency = 'soon'),
    'on_time', count(*) filter (where r.report_status = 'pending' and r.urgency in ('on_time', 'undated')),
    'waiting', count(*) filter (where r.report_status = 'waiting'),
    'corrected', count(*) filter (where r.report_status = 'corrected')
  )
  into v_queue
  from private.jefe_report_rows_v1(v_areas) r;

  with offers as (
    select * from private.jefe_annual_offers_v1(v_areas, p_year, v_effective_cutoff)
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
      coalesce(sum(o.fixed_capacity), 0)::integer + coalesce(sum(o.realized_capacity), 0)::integer as registered_capacity
    from unnest(v_areas) a(area_key)
    join private.jefe_area_assignments aa
      on aa.area_key = a.area_key
     and aa.dni = (select e.dni::bigint from public.estudiantes e where e.user_id = auth.uid() limit 1)
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
        select 1 from unnest(v_areas) area_key
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
    'institutions', coalesce((select jsonb_agg(to_jsonb(i) order by i.offer_count desc, i.institution_name) from institutions i), '[]'::jsonb),
    'students_started', (select students from started),
    'applications', (select applications from demand),
    'applicants', (select applicants from demand),
    'months', coalesce((select jsonb_agg(to_jsonb(m) order by m.month_number) from months m), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(to_jsonb(a)) from areas a), '[]'::jsonb)
  )
  into v_panorama;

  select jsonb_build_object(
    'as_of', (now() at time zone 'America/Argentina/Buenos_Aires')::date,
    'active_practices', count(distinct p.id) filter (where lower(coalesce(p.estado, '')) in ('activo', 'activa', 'en curso', 'en_curso', 'en proceso', 'en_proceso')),
    'open_offers', (
      select count(*)
      from public.lanzamientos_pps l
      where l.tipo_actividad = 'pps'
        and lower(coalesce(l.estado_convocatoria, '')) = 'abierta'
        and exists (
          select 1 from unnest(v_areas) area_key
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
    select 1 from unnest(v_areas) area_key
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

