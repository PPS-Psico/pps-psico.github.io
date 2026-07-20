-- Observabilidad de analytics: chequeo diario, historial y alerta interna staff.

begin;

create table if not exists public.analytics_health_checks (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default statement_timestamp(),
  source text not null check (source in ('scheduled', 'deployment', 'manual')),
  health_version text not null,
  status text not null check (status in ('healthy', 'warning', 'critical')),
  expected_snapshot_date date,
  latest_snapshot_date date,
  latest_snapshot_status text,
  issue_count integer not null default 0 check (issue_count >= 0),
  issues jsonb not null default '[]'::jsonb check (jsonb_typeof(issues) = 'array'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index if not exists analytics_health_checks_checked_at_idx
  on public.analytics_health_checks (checked_at desc);

alter table public.analytics_health_checks enable row level security;

revoke all on table public.analytics_health_checks from anon, authenticated;
grant select on table public.analytics_health_checks to authenticated;
revoke all on sequence public.analytics_health_checks_id_seq from anon, authenticated;

drop policy if exists "Staff read analytics health checks"
  on public.analytics_health_checks;
create policy "Staff read analytics health checks"
  on public.analytics_health_checks for select to authenticated
  using ((select public.is_admin()));

comment on table public.analytics_health_checks is
  'Historial de salud de analytics, snapshots y calidad de vínculos. Sólo lectura staff.';

create or replace function private.evaluate_analytics_health(
  p_checked_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_checked_at timestamptz := coalesce(p_checked_at, clock_timestamp());
  v_utc timestamp := v_checked_at at time zone 'UTC';
  v_cutoff date := v_utc::date;
  v_expected_snapshot_date date;
  v_validated_snapshot_date date;
  v_latest_snapshot_date date;
  v_latest_snapshot_taken_at timestamptz;
  v_expected_snapshot_rows integer := 0;
  v_latest_run_status text;
  v_latest_run_started_at timestamptz;
  v_latest_run_finished_at timestamptz;
  v_latest_run_error text;
  v_cron_active boolean := false;
  v_cron_schedule text;
  v_payload jsonb;
  v_issues jsonb := '[]'::jsonb;
  v_status text := 'healthy';
  v_practice_link_coverage numeric;
  v_institution_link_coverage numeric;
  v_selected_at_coverage numeric;
  v_fixed_over_capacity integer;
begin
  -- El snapshot corre 09:00 UTC. Recién se exige el día actual después de una
  -- hora de gracia para evitar alertas durante una ejecución normal.
  v_expected_snapshot_date := case
    when v_utc::time >= time '10:00' then v_cutoff
    else v_cutoff - 1
  end;

  select j.active, j.schedule
  into v_cron_active, v_cron_schedule
  from cron.job as j
  where j.jobname = 'analytics-v1-daily-snapshot'
  limit 1;

  select s.snapshot_date, max(s.taken_at)
  into v_latest_snapshot_date, v_latest_snapshot_taken_at
  from public.analytics_metric_snapshots as s
  group by s.snapshot_date
  order by s.snapshot_date desc
  limit 1;

  v_validated_snapshot_date := case
    when v_latest_snapshot_date >= v_expected_snapshot_date then v_latest_snapshot_date
    else v_expected_snapshot_date
  end;

  select count(*)::integer
  into v_expected_snapshot_rows
  from public.analytics_metric_snapshots as s
  where s.snapshot_date = v_validated_snapshot_date
    and s.metric_version = 'analytics-v1';

  select r.status, r.started_at, r.finished_at, r.error_message
  into v_latest_run_status, v_latest_run_started_at, v_latest_run_finished_at, v_latest_run_error
  from public.analytics_snapshot_runs as r
  order by r.id desc
  limit 1;

  v_payload := public.get_analytics_v1(extract(year from v_cutoff)::integer, v_cutoff);
  v_practice_link_coverage := (v_payload #>> '{quality,practice_launch_link_coverage_pct}')::numeric;
  v_institution_link_coverage := (v_payload #>> '{quality,launch_institution_link_coverage_pct}')::numeric;
  v_selected_at_coverage := (v_payload #>> '{quality,selected_at_coverage_pct}')::numeric;
  v_fixed_over_capacity := coalesce(
    (v_payload #>> '{capacity,fixed_over_capacity_launches}')::integer,
    0
  );

  if not coalesce(v_cron_active, false) then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'snapshot_cron_inactive',
      'message', 'El cron diario de snapshots no existe o está inactivo.'
    ));
  end if;

  if v_latest_run_status = 'error' then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'latest_snapshot_run_failed',
      'message', 'La última ejecución del snapshot terminó con error.',
      'detail', v_latest_run_error
    ));
  elsif v_latest_run_status = 'running'
        and v_latest_run_started_at < v_checked_at - interval '30 minutes' then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'snapshot_run_stuck',
      'message', 'La ejecución del snapshot lleva más de 30 minutos en estado running.'
    ));
  end if;

  if v_latest_snapshot_date is null
     or v_latest_snapshot_date < v_expected_snapshot_date then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'snapshot_stale',
      'message', 'No existe un snapshot suficientemente reciente.',
      'expected_date', v_expected_snapshot_date,
      'latest_date', v_latest_snapshot_date
    ));
  elsif v_expected_snapshot_rows <> 2 then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'snapshot_row_count_mismatch',
      'message', 'El snapshot esperado no contiene exactamente las dos métricas de stock.',
      'expected_rows', 2,
      'actual_rows', v_expected_snapshot_rows
    ));
  end if;

  if v_practice_link_coverage is null or v_practice_link_coverage < 95 then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'practice_launch_coverage_low',
      'message', 'La cobertura práctica–lanzamiento está por debajo de 95%.',
      'value', v_practice_link_coverage,
      'threshold', 95
    ));
  end if;

  if v_institution_link_coverage is null or v_institution_link_coverage < 95 then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'launch_institution_coverage_low',
      'message', 'La cobertura lanzamiento–institución está por debajo de 95%.',
      'value', v_institution_link_coverage,
      'threshold', 95
    ));
  end if;

  if v_fixed_over_capacity > 0 then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'fixed_capacity_exceeded',
      'message', 'Hay lanzamientos de cupo fijo con más seleccionados que plazas registradas.',
      'launches', v_fixed_over_capacity
    ));
  end if;

  if v_selected_at_coverage is null or v_selected_at_coverage < 90 then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'severity', 'info',
      'code', 'selected_at_experimental',
      'message', 'selected_at continúa como indicador experimental.',
      'value', v_selected_at_coverage,
      'promotion_threshold', 90
    ));
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_issues) as issue
    where issue ->> 'severity' = 'critical'
  ) then
    v_status := 'critical';
  elsif exists (
    select 1
    from jsonb_array_elements(v_issues) as issue
    where issue ->> 'severity' = 'warning'
  ) then
    v_status := 'warning';
  end if;

  return jsonb_build_object(
    'health_version', 'analytics-health-v1',
    'checked_at', v_checked_at,
    'status', v_status,
    'expected_snapshot_date', v_expected_snapshot_date,
    'latest_snapshot_date', v_latest_snapshot_date,
    'latest_snapshot_status', v_latest_run_status,
    'issue_count', jsonb_array_length(v_issues),
    'issues', v_issues,
    'details', jsonb_build_object(
      'cron', jsonb_build_object(
        'active', coalesce(v_cron_active, false),
        'schedule', v_cron_schedule
      ),
      'snapshot', jsonb_build_object(
        'expected_rows', 2,
        'actual_rows', v_expected_snapshot_rows,
        'validated_date', v_validated_snapshot_date,
        'latest_taken_at', v_latest_snapshot_taken_at,
        'latest_run_started_at', v_latest_run_started_at,
        'latest_run_finished_at', v_latest_run_finished_at,
        'latest_run_error', v_latest_run_error
      ),
      'quality', jsonb_build_object(
        'practice_launch_link_coverage_pct', v_practice_link_coverage,
        'launch_institution_link_coverage_pct', v_institution_link_coverage,
        'selected_at_coverage_pct', v_selected_at_coverage,
        'fixed_over_capacity_launches', v_fixed_over_capacity
      ),
      'thresholds', jsonb_build_object(
        'link_coverage_warning_below_pct', 95,
        'selected_at_promotion_pct', 90,
        'snapshot_grace_until_utc', '10:00'
      )
    )
  );
end;
$$;

create or replace function private.run_analytics_health_check(
  p_source text default 'scheduled'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_id bigint;
  v_source text := coalesce(p_source, 'scheduled');
begin
  if v_source not in ('scheduled', 'deployment', 'manual') then
    raise exception 'Fuente de chequeo inválida: %', v_source;
  end if;

  begin
    v_result := private.evaluate_analytics_health(clock_timestamp());
  exception when others then
    v_result := jsonb_build_object(
      'health_version', 'analytics-health-v1',
      'checked_at', clock_timestamp(),
      'status', 'critical',
      'expected_snapshot_date', null,
      'latest_snapshot_date', null,
      'latest_snapshot_status', 'error',
      'issue_count', 1,
      'issues', jsonb_build_array(jsonb_build_object(
        'severity', 'critical',
        'code', 'health_evaluation_failed',
        'message', 'Falló la evaluación de salud de analytics.',
        'detail', sqlerrm
      )),
      'details', '{}'::jsonb
    );
  end;

  insert into public.analytics_health_checks (
    checked_at,
    source,
    health_version,
    status,
    expected_snapshot_date,
    latest_snapshot_date,
    latest_snapshot_status,
    issue_count,
    issues,
    details
  ) values (
    (v_result ->> 'checked_at')::timestamptz,
    v_source,
    v_result ->> 'health_version',
    v_result ->> 'status',
    (v_result ->> 'expected_snapshot_date')::date,
    (v_result ->> 'latest_snapshot_date')::date,
    v_result ->> 'latest_snapshot_status',
    (v_result ->> 'issue_count')::integer,
    v_result -> 'issues',
    v_result -> 'details'
  )
  returning id into v_id;

  delete from public.analytics_health_checks
  where checked_at < clock_timestamp() - interval '400 days';

  return v_id;
end;
$$;

create or replace function public.get_analytics_health()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', h.id,
    'checked_at', h.checked_at,
    'source', h.source,
    'health_version', h.health_version,
    'status', h.status,
    'expected_snapshot_date', h.expected_snapshot_date,
    'latest_snapshot_date', h.latest_snapshot_date,
    'latest_snapshot_status', h.latest_snapshot_status,
    'issue_count', h.issue_count,
    'issues', h.issues,
    'details', h.details
  )
  into v_result
  from public.analytics_health_checks as h
  order by h.checked_at desc, h.id desc
  limit 1;

  return coalesce(v_result, jsonb_build_object(
    'health_version', 'analytics-health-v1',
    'status', 'critical',
    'issue_count', 1,
    'issues', jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'health_check_missing',
      'message', 'Todavía no existe un chequeo de salud de analytics.'
    ))
  ));
end;
$$;

revoke all on function private.evaluate_analytics_health(timestamptz)
  from public, anon, authenticated;
revoke all on function private.run_analytics_health_check(text)
  from public, anon, authenticated;
revoke all on function public.get_analytics_health() from public, anon;
grant execute on function public.get_analytics_health() to authenticated;

comment on function private.evaluate_analytics_health(timestamptz) is
  'Evalúa frescura de snapshots y guardrails de calidad sin persistir resultados.';
comment on function private.run_analytics_health_check(text) is
  'Persiste el chequeo de salud diario y retiene 400 días de historial.';
comment on function public.get_analytics_health() is
  'Devuelve el último chequeo de salud sólo a roles staff.';

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'analytics-daily-health-check';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

-- Se ejecuta 65 minutos después del snapshot para respetar la ventana de gracia.
select cron.schedule(
  'analytics-daily-health-check',
  '5 10 * * *',
  $$select private.run_analytics_health_check('scheduled')$$
);

select private.run_analytics_health_check('deployment');

commit;
