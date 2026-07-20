-- Snapshots normalizados de stocks; no persiste el JSON completo del RPC legado.

begin;

create table if not exists public.analytics_metric_snapshots (
  id bigint generated always as identity primary key,
  snapshot_date date not null,
  taken_at timestamptz not null default statement_timestamp(),
  metric_version text not null,
  metric_key text not null,
  dimension_key text not null default 'all',
  value numeric not null,
  numerator numeric,
  denominator numeric,
  quality jsonb not null default '{}'::jsonb,
  unique (snapshot_date, metric_version, metric_key, dimension_key)
);

create table if not exists public.analytics_snapshot_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default statement_timestamp(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'error')),
  rows_written integer not null default 0,
  error_message text
);

alter table public.analytics_metric_snapshots enable row level security;
alter table public.analytics_snapshot_runs enable row level security;

drop policy if exists "Staff read analytics metric snapshots"
  on public.analytics_metric_snapshots;
create policy "Staff read analytics metric snapshots"
  on public.analytics_metric_snapshots for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Staff read analytics snapshot runs"
  on public.analytics_snapshot_runs;
create policy "Staff read analytics snapshot runs"
  on public.analytics_snapshot_runs for select to authenticated
  using ((select public.is_admin()));

comment on table public.analytics_metric_snapshots is
  'Snapshots diarios normalizados de stocks analytics-v1 para comparación histórica futura.';
comment on table public.analytics_snapshot_runs is
  'Bitácora operativa del job diario de snapshots.';

create or replace function private.take_analytics_v1_snapshot()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_quality jsonb;
  v_version text;
  v_run_id bigint;
begin
  insert into public.analytics_snapshot_runs (status)
  values ('running')
  returning id into v_run_id;

  begin
    v_payload := public.get_analytics_v1(
      extract(year from current_date)::integer,
      current_date
    );
    v_quality := coalesce(v_payload -> 'quality', '{}'::jsonb);
    v_version := coalesce(v_payload ->> 'metric_version', 'analytics-v1');

    insert into public.analytics_metric_snapshots (
      snapshot_date, metric_version, metric_key, value, numerator, quality
    ) values
      (
        current_date,
        v_version,
        'active_students',
        (v_payload #>> '{stocks,active_students}')::numeric,
        (v_payload #>> '{stocks,active_students}')::numeric,
        v_quality
      ),
      (
        current_date,
        v_version,
        'active_students_with_current_pps',
        (v_payload #>> '{stocks,active_students_with_current_pps}')::numeric,
        (v_payload #>> '{stocks,active_students_with_current_pps}')::numeric,
        v_quality
      )
    on conflict (snapshot_date, metric_version, metric_key, dimension_key)
    do update set
      taken_at = statement_timestamp(),
      value = excluded.value,
      numerator = excluded.numerator,
      denominator = excluded.denominator,
      quality = excluded.quality;

    update public.analytics_snapshot_runs
    set status = 'success', finished_at = statement_timestamp(), rows_written = 2
    where id = v_run_id;
  exception when others then
    update public.analytics_snapshot_runs
    set status = 'error', finished_at = statement_timestamp(), error_message = sqlerrm
    where id = v_run_id;
    raise;
  end;
end;
$$;

revoke all on function private.take_analytics_v1_snapshot() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'analytics-v1-daily-snapshot';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'analytics-v1-daily-snapshot',
  '0 9 * * *',
  'select private.take_analytics_v1_snapshot()'
);

select private.take_analytics_v1_snapshot();

commit;
