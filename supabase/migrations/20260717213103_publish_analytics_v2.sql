-- Publica la reconstruccion historica sin exponer las tablas privadas.
-- analytics-v2 reemplaza, cuando existe fuente documental, las filas legacy
-- por una oferta canonica y conserva los valores legacy como diagnostico.

begin;

create or replace function private.get_historical_launch_metrics(
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
  v_cutoff date := least(coalesce(p_cutoff, current_date), make_date(p_year, 12, 31));
  v_available boolean;
  v_payload jsonb;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select exists (
    select 1
    from private.historical_launch_sources as s
    where s.coverage_start <= make_date(p_year, 12, 31)
      and s.coverage_end >= make_date(p_year, 1, 1)
  ) into v_available;

  if not v_available then
    return jsonb_build_object(
      'available', false,
      'year', p_year,
      'cutoff', v_cutoff
    );
  end if;

  with eligible_offers as (
    select o.*
    from private.historical_launch_offers as o
    where o.source_year = p_year
      and o.count_in_offer_metrics
      and o.announcement_at::date <= v_cutoff
  ),
  offer_totals as (
    select
      count(*)::integer as offers,
      count(*) filter (where capacity_mode = 'fijo')::integer as finite_offers,
      coalesce(sum(offered_capacity) filter (where capacity_mode = 'fijo'), 0)::integer
        as finite_capacity,
      count(*) filter (where capacity_mode <> 'fijo')::integer
        as unknown_or_realized_offers,
      count(*) filter (where review_status = 'verified')::integer as verified_offers,
      count(*) filter (where review_status = 'needs_review')::integer as review_needed
    from eligible_offers
  ),
  reconciliation as (
    select
      count(distinct eo.offer_id) filter (where m.offer_id is not null)::integer as mapped_offers,
      count(m.lanzamiento_id)::integer as member_links
    from eligible_offers as eo
    left join private.historical_launch_members as m on m.offer_id = eo.offer_id
  ),
  slot_totals as (
    select count(s.slot_id)::integer as slots
    from eligible_offers as eo
    join private.historical_launch_slots as s on s.offer_id = eo.offer_id
  ),
  event_totals as (
    select count(e.event_id)::integer as relaunches
    from eligible_offers as eo
    join private.historical_launch_events as e on e.offer_id = eo.offer_id
    where e.event_type = 'relaunch'
      and e.event_at::date <= v_cutoff
  ),
  orientation_totals as (
    select coalesce(jsonb_object_agg(x.orientation, x.offers order by x.orientation), '{}'::jsonb)
      as orientation_offers
    from (
      select orientation, count(*)::integer as offers
      from eligible_offers
      group by orientation
    ) as x
  ),
  source_ids as (
    select coalesce(jsonb_agg(x.source_id order by x.source_id), '[]'::jsonb) as ids
    from (
      select distinct source_id
      from eligible_offers
    ) as x
  )
  select jsonb_build_object(
    'available', true,
    'source', 'historical_documented_offers',
    'source_ids', si.ids,
    'year', p_year,
    'cutoff', v_cutoff,
    'date_basis', 'announcement_at',
    'offers', ot.offers,
    'finite_offers', ot.finite_offers,
    'finite_capacity', ot.finite_capacity,
    'unknown_or_realized_offers', ot.unknown_or_realized_offers,
    'finite_offer_coverage_pct', case
      when ot.offers = 0 then null
      else round(100.0 * ot.finite_offers / ot.offers, 1)
    end,
    'capacity_complete', ot.offers > 0 and ot.unknown_or_realized_offers = 0,
    'relaunches', coalesce(et.relaunches, 0),
    'slots', coalesce(st.slots, 0),
    'mapped_offers', coalesce(r.mapped_offers, 0),
    'missing_legacy_offers', ot.offers - coalesce(r.mapped_offers, 0),
    'legacy_member_links', coalesce(r.member_links, 0),
    'verified_offers', ot.verified_offers,
    'review_needed', ot.review_needed,
    'orientation_offers', ori.orientation_offers
  )
  into v_payload
  from offer_totals as ot
  cross join reconciliation as r
  cross join slot_totals as st
  cross join event_totals as et
  cross join orientation_totals as ori
  cross join source_ids as si;

  return v_payload;
end;
$$;

create or replace function private.get_historical_launch_offer_list(
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
  v_cutoff date := least(coalesce(p_cutoff, current_date), make_date(p_year, 12, 31));
  v_available boolean;
  v_rows jsonb;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select exists (
    select 1
    from private.historical_launch_sources as s
    where s.coverage_start <= make_date(p_year, 12, 31)
      and s.coverage_end >= make_date(p_year, 1, 1)
  ) into v_available;

  if not v_available then
    return jsonb_build_object(
      'available', false,
      'year', p_year,
      'cutoff', v_cutoff,
      'rows', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'offer_id', o.offer_id,
        'canonical_name', o.canonical_name,
        'orientation', o.orientation,
        'announcement_at', o.announcement_at,
        'capacity_mode', o.capacity_mode,
        'offered_capacity', o.offered_capacity,
        'credited_hours_text', o.credited_hours_text,
        'start_date_note', o.start_date_note,
        'review_status', o.review_status,
        'source_confidence', o.source_confidence,
        'mapped_legacy_rows', (
          select count(*)::integer
          from private.historical_launch_members as m
          where m.offer_id = o.offer_id
        ),
        'relaunches', (
          select count(*)::integer
          from private.historical_launch_events as e
          where e.offer_id = o.offer_id
            and e.event_type = 'relaunch'
            and e.event_at::date <= v_cutoff
        )
      )
      order by o.announcement_at, o.offer_id
    ),
    '[]'::jsonb
  )
  into v_rows
  from private.historical_launch_offers as o
  where o.source_year = p_year
    and o.count_in_offer_metrics
    and o.announcement_at::date <= v_cutoff;

  return jsonb_build_object(
    'available', true,
    'source', 'historical_documented_offers',
    'year', p_year,
    'cutoff', v_cutoff,
    'date_basis', 'announcement_at',
    'rows', v_rows
  );
end;
$$;

revoke all on function private.get_historical_launch_metrics(integer, date)
  from public, anon, authenticated;
revoke all on function private.get_historical_launch_offer_list(integer, date)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.get_historical_launch_metrics(integer, date) to authenticated;
grant execute on function private.get_historical_launch_offer_list(integer, date) to authenticated;

create or replace function public.get_analytics_v2(
  p_year integer,
  p_cutoff date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_base jsonb;
  v_historical jsonb;
  v_capacity jsonb;
  v_quality jsonb;
begin
  v_base := public.get_analytics_v1(p_year, p_cutoff);
  v_historical := private.get_historical_launch_metrics(p_year, p_cutoff);

  if coalesce((v_historical ->> 'available')::boolean, false) then
    v_capacity := coalesce(v_base -> 'capacity', '{}'::jsonb) || jsonb_build_object(
      'fixed_offered', (v_historical ->> 'finite_capacity')::integer,
      'realized', null,
      'operational', (v_historical ->> 'finite_capacity')::integer,
      'launches', (v_historical ->> 'offers')::integer,
      'fixed_over_capacity_launches', null,
      'fixed_over_capacity_available', false,
      'source', 'historical_documented_offers',
      'date_basis', 'announcement_at',
      'capacity_complete', (v_historical ->> 'capacity_complete')::boolean,
      'comparable', false,
      'finite_offer_coverage_pct', v_historical -> 'finite_offer_coverage_pct',
      'documented_finite_offers', (v_historical ->> 'finite_offers')::integer,
      'unknown_or_realized_offers', (v_historical ->> 'unknown_or_realized_offers')::integer,
      'legacy_operational', v_base #> '{capacity,operational}',
      'legacy_launch_rows', v_base #> '{capacity,launches}'
    );
  else
    v_capacity := coalesce(v_base -> 'capacity', '{}'::jsonb) || jsonb_build_object(
      'fixed_over_capacity_available', true,
      'source', 'operational_launches',
      'date_basis', 'launch_start_date',
      'capacity_complete', true,
      'comparable', true,
      'finite_offer_coverage_pct', null,
      'documented_finite_offers', null,
      'unknown_or_realized_offers', 0
    );
  end if;

  v_quality := coalesce(v_base -> 'quality', '{}'::jsonb) || jsonb_build_object(
    'historical_offer_reconstruction_available',
      coalesce((v_historical ->> 'available')::boolean, false),
    'historical_offer_review_needed', case
      when coalesce((v_historical ->> 'available')::boolean, false)
        then (v_historical ->> 'review_needed')::integer
      else null
    end,
    'historical_offer_mapping_coverage_pct', case
      when coalesce((v_historical ->> 'offers')::integer, 0) = 0 then null
      else round(
        100.0 * (v_historical ->> 'mapped_offers')::integer
        / (v_historical ->> 'offers')::integer,
        1
      )
    end
  );

  return v_base || jsonb_build_object(
    'metric_version', 'analytics-v2',
    'capacity', v_capacity,
    'quality', v_quality,
    'historical_offers', v_historical
  );
end;
$$;

create or replace function public.get_historical_launch_offer_list(
  p_year integer,
  p_cutoff date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_historical_launch_offer_list(p_year, p_cutoff);
$$;

comment on function private.get_historical_launch_metrics(integer, date) is
  'Agrega oferta historica privada para usuarios staff autenticados.';
comment on function private.get_historical_launch_offer_list(integer, date) is
  'Lista minima de oferta historica sin evidencia cruda ni datos personales.';
comment on function public.get_analytics_v2(integer, date) is
  'Contrato analytics-v2: analytics-v1 mas oferta historica canonica y metadatos de comparabilidad.';
comment on function public.get_historical_launch_offer_list(integer, date) is
  'Wrapper API para el drilldown canonico de ofertas historicas.';

revoke all on function public.get_analytics_v2(integer, date) from public, anon;
revoke all on function public.get_historical_launch_offer_list(integer, date) from public, anon;
grant execute on function public.get_analytics_v2(integer, date) to authenticated;
grant execute on function public.get_historical_launch_offer_list(integer, date) to authenticated;

commit;
