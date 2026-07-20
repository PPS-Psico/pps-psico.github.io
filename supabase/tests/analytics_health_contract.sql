-- Contrato no destructivo para observabilidad de analytics.

begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select e.user_id::text
    from public.estudiantes as e
    where e.user_id is not null
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
    order by e.role, e.id
    limit 1
  ),
  true
);

set local role authenticated;

do $$
declare
  v_payload jsonb;
begin
  if nullif(current_setting('request.jwt.claim.sub', true), '') is null then
    raise exception 'La prueba requiere al menos un usuario staff con user_id';
  end if;

  v_payload := public.get_analytics_health();

  if v_payload ->> 'health_version' <> 'analytics-health-v1' then
    raise exception 'Versión de salud inesperada: %', v_payload ->> 'health_version';
  end if;

  if v_payload ->> 'status' = 'critical' then
    raise exception 'El chequeo productivo no debe quedar crítico: %', v_payload -> 'issues';
  end if;

  if (v_payload ->> 'latest_snapshot_date')::date <
     (v_payload ->> 'expected_snapshot_date')::date then
    raise exception 'El snapshot está vencido: %', v_payload;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_payload -> 'issues') as issue
    where issue ->> 'severity' = 'critical'
  ) then
    raise exception 'No deben existir incidencias críticas en estado no crítico';
  end if;

  if has_function_privilege('anon', 'public.get_analytics_health()', 'execute') then
    raise exception 'anon no debe poder ejecutar get_analytics_health';
  end if;

  if has_table_privilege('authenticated', 'public.analytics_health_checks', 'insert')
     or has_table_privilege('authenticated', 'public.analytics_health_checks', 'update')
     or has_table_privilege('authenticated', 'public.analytics_health_checks', 'delete') then
    raise exception 'authenticated no debe escribir el historial de salud';
  end if;

end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1
    from cron.job as j
    where j.jobname = 'analytics-daily-health-check'
      and j.active
      and j.schedule = '5 10 * * *'
  ) then
    raise exception 'El cron diario de salud no está activo con el horario esperado';
  end if;
end;
$$;

rollback;
