-- Contrato no destructivo para la reconstruccion historica de oferta 2024.
-- Ejecutar sobre el proyecto que contiene la fuente whatsapp-pps-2024.

begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select e.user_id::text
    from public.estudiantes as e
    where e.user_id is not null
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester', 'Reportero')
    order by e.role, e.id
    limit 1
  ),
  true
);

do $$
declare
  v_payload jsonb;
  v_ytd jsonb;
  v_list jsonb;
begin
  v_payload := public.get_analytics_v2(2024, date '2024-12-31');
  v_ytd := public.get_analytics_v2(2024, date '2024-07-17');
  v_list := public.get_historical_launch_offer_list(2024, date '2024-12-31');

  if v_payload ->> 'metric_version' <> 'analytics-v2' then
    raise exception 'Version inesperada: %', v_payload ->> 'metric_version';
  end if;

  if (v_payload #>> '{capacity,launches}')::integer <> 42 then
    raise exception 'La oferta canonica 2024 debe contener 42 ofertas';
  end if;

  if (v_payload #>> '{capacity,operational}')::integer <> 270 then
    raise exception 'La capacidad finita documentada 2024 debe ser 270';
  end if;

  if (v_payload #>> '{capacity,capacity_complete}')::boolean then
    raise exception 'La capacidad 2024 no puede marcarse completa';
  end if;

  if (v_payload #>> '{capacity,unknown_or_realized_offers}')::integer <> 6 then
    raise exception 'Deben conservarse 6 ofertas sin total finito';
  end if;

  if (v_ytd #>> '{capacity,launches}')::integer <> 24
     or (v_ytd #>> '{capacity,operational}')::integer <> 118 then
    raise exception 'El corte 2024-07-17 debe devolver 24 ofertas y 118 vacantes finitas';
  end if;

  if jsonb_array_length(v_list -> 'rows') <> 42 then
    raise exception 'El drilldown debe reconciliar con las 42 ofertas del KPI';
  end if;

  if (select count(*) from private.historical_launch_offers
      where source_year = 2024 and review_status = 'needs_review') <> 0 then
    raise exception 'No deben quedar ofertas históricas 2024 pendientes de revisión';
  end if;

  if (select count(distinct o.offer_id)
      from private.historical_launch_offers o
      join private.historical_launch_members m on m.offer_id = o.offer_id
      where o.source_year = 2024) <> 42 then
    raise exception 'Las 42 ofertas históricas deben tener conciliación legacy';
  end if;

  if (select count(*) from public.practicas
      where tipo_actividad = 'pps'
        and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'
        and lanzamiento_id is null) <> 0 then
    raise exception 'No deben quedar prácticas PPS 2024 sin lanzamiento';
  end if;

  if (select count(*) from public.lanzamientos_pps
      where tipo_actividad = 'pps'
        and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'
        and institucion_id is not null) <> 80 then
    raise exception 'Los 80 lanzamientos PPS 2024 deben tener institución';
  end if;

  if has_table_privilege('authenticated', 'private.historical_launch_offers', 'select')
     or has_table_privilege('anon', 'private.historical_launch_offers', 'select') then
    raise exception 'Las tablas historicas privadas no deben ser consultables por clientes';
  end if;

  if has_function_privilege('anon', 'public.get_analytics_v2(integer,date)', 'execute') then
    raise exception 'analytics-v2 no debe estar disponible para anon';
  end if;
end;
$$;

rollback;
