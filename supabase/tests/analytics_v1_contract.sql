-- Prueba de contrato no destructiva. Ejecutar con psql/Supabase SQL runner.

begin;

do $$
declare
  v_payload jsonb;
  v_operational numeric;
  v_fixed numeric;
  v_realized numeric;
begin
  v_payload := public.get_analytics_v1(2026, date '2026-07-17');

  if v_payload ->> 'metric_version' <> 'analytics-v1' then
    raise exception 'Versión inesperada: %', v_payload ->> 'metric_version';
  end if;

  v_operational := (v_payload #>> '{capacity,operational}')::numeric;
  v_fixed := (v_payload #>> '{capacity,fixed_offered}')::numeric;
  v_realized := (v_payload #>> '{capacity,realized}')::numeric;

  if v_operational <> v_fixed + v_realized then
    raise exception 'Capacidad no reconcilia: % <> % + %', v_operational, v_fixed, v_realized;
  end if;

  if (v_payload #>> '{flows,finalized}')::integer < 0
     or (v_payload #>> '{flows,pps_started}')::integer < 0 then
    raise exception 'Un flujo no puede ser negativo';
  end if;

  if (v_payload #>> '{quality,selected_at_coverage_pct}')::numeric not between 0 and 100 then
    raise exception 'Cobertura selected_at fuera de rango';
  end if;
end;
$$;

rollback;
