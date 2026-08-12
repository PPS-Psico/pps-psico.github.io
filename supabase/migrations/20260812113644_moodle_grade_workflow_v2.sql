begin;

-- ---------------------------------------------------------------------------
-- 1. La escala deja de inferirse a partir del valor observado.
-- ---------------------------------------------------------------------------

alter table public.aula_entregas
  add column if not exists grade_conversion_mode text;

update public.aula_entregas
set grade_conversion_mode = case
  -- Estas cinco tareas ya tienen evidencia historica de notas 8/9 cargadas
  -- directamente sobre una configuracion Moodle cuyo maximo figura como 100.
  when moodle_id in ('795721', '805659', '806963', '1009867', '1102510')
    then 'direct_10'
  else 'percentage'
end
where grade_conversion_mode is null;

alter table public.aula_entregas
  alter column grade_conversion_mode set default 'percentage',
  alter column grade_conversion_mode set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'aula_entregas_grade_conversion_mode_check'
      and conrelid = 'public.aula_entregas'::regclass
  ) then
    alter table public.aula_entregas
      add constraint aula_entregas_grade_conversion_mode_check
      check (grade_conversion_mode in ('percentage', 'direct_10', 'pass_fail'));
  end if;
end;
$$;

comment on column public.aula_entregas.grade_conversion_mode is
  'Regla explicita para convertir la calificacion Moodle: percentage normaliza grade/max a 10; direct_10 conserva el valor; pass_fail produce Aprobado/Desaprobado.';

-- ---------------------------------------------------------------------------
-- 2. Estado de informe, nota academica y procedencia dejan de compartir texto.
--    practicas.nota se mantiene como compatibilidad mientras migra el resto.
-- ---------------------------------------------------------------------------

alter table public.practicas
  add column if not exists informe_estado text,
  add column if not exists nota_moodle numeric(5,2),
  add column if not exists nota_fuente text,
  add column if not exists nota_actualizada_at timestamptz,
  add column if not exists nota_moodle_cmid bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'practicas_informe_estado_check'
      and conrelid = 'public.practicas'::regclass
  ) then
    alter table public.practicas
      add constraint practicas_informe_estado_check
      check (informe_estado is null or informe_estado in (
        'a_revisar', 'sin_entrega', 'entregado', 'calificado'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'practicas_nota_moodle_range_check'
      and conrelid = 'public.practicas'::regclass
  ) then
    alter table public.practicas
      add constraint practicas_nota_moodle_range_check
      check (nota_moodle is null or nota_moodle between 0 and 10);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'practicas_nota_fuente_check'
      and conrelid = 'public.practicas'::regclass
  ) then
    alter table public.practicas
      add constraint practicas_nota_fuente_check
      check (nota_fuente is null or nota_fuente in (
        'moodle_session_observed', 'moodle_export_verified',
        'moodle_api_verified', 'legacy', 'admin'
      ));
  end if;
end;
$$;

create index if not exists practicas_student_informe_estado_idx
  on public.practicas (estudiante_id, informe_estado)
  where informe_estado is not null;

comment on column public.practicas.informe_estado is
  'Estado canonico del informe, separado de la calificacion: a_revisar, sin_entrega, entregado o calificado.';
comment on column public.practicas.nota_moodle is
  'Calificacion Moodle resuelta en escala 0-10 mediante la regla explicita de la tarea.';
comment on column public.practicas.nota_fuente is
  'Procedencia de la calificacion academica actualmente aplicada.';

-- ---------------------------------------------------------------------------
-- 3. Snapshot doble: mejor estado confirmado + ultima observacion real.
-- ---------------------------------------------------------------------------

-- El trigger legacy devuelve OLD ante una nota terminal y por eso tambien
-- impediria completar las columnas nuevas. Se recrea endurecido mas abajo,
-- dentro de esta misma transaccion.
drop trigger if exists preserve_moodle_grade_snapshot_progress_trigger
  on public.moodle_grade_snapshots;

alter table public.moodle_grade_snapshots
  add column if not exists last_observation_id uuid,
  add column if not exists last_task_status text,
  add column if not exists last_submitted boolean,
  add column if not exists last_grade_value numeric,
  add column if not exists last_grade_max numeric,
  add column if not exists last_grade_display text,
  add column if not exists last_graded_at_display text,
  add column if not exists last_observed_at timestamptz,
  add column if not exists last_received_at timestamptz,
  add column if not exists last_confidence text,
  add column if not exists scan_closed boolean not null default false,
  add column if not exists grade_revision integer not null default 1,
  add column if not exists reopened_at timestamptz;

update public.moodle_grade_snapshots
set last_observation_id = coalesce(last_observation_id, latest_observation_id),
    last_task_status = coalesce(last_task_status, task_status),
    last_submitted = coalesce(last_submitted, submitted),
    last_grade_value = coalesce(last_grade_value, grade_value),
    last_grade_max = coalesce(last_grade_max, grade_max),
    last_grade_display = coalesce(last_grade_display, grade_display),
    last_graded_at_display = coalesce(last_graded_at_display, graded_at_display),
    last_observed_at = coalesce(last_observed_at, observed_at),
    last_received_at = coalesce(last_received_at, received_at),
    last_confidence = coalesce(last_confidence, confidence),
    scan_closed = task_status = 'graded';

alter table public.moodle_grade_snapshots
  alter column last_observation_id set not null,
  alter column last_task_status set not null,
  alter column last_submitted set not null,
  alter column last_observed_at set not null,
  alter column last_received_at set not null,
  alter column last_confidence set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'moodle_grade_snapshots_last_observation_fkey'
      and conrelid = 'public.moodle_grade_snapshots'::regclass
  ) then
    alter table public.moodle_grade_snapshots
      add constraint moodle_grade_snapshots_last_observation_fkey
      foreign key (last_observation_id)
      references public.moodle_grade_observations(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'moodle_grade_snapshots_last_status_check'
      and conrelid = 'public.moodle_grade_snapshots'::regclass
  ) then
    alter table public.moodle_grade_snapshots
      add constraint moodle_grade_snapshots_last_status_check
      check (last_task_status in (
        'no_access', 'not_submitted', 'submitted', 'graded', 'parse_error'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'moodle_grade_snapshots_revision_check'
      and conrelid = 'public.moodle_grade_snapshots'::regclass
  ) then
    alter table public.moodle_grade_snapshots
      add constraint moodle_grade_snapshots_revision_check
      check (grade_revision > 0);
  end if;
end;
$$;

create index if not exists moodle_grade_snapshots_last_observed_idx
  on public.moodle_grade_snapshots (estudiante_id, last_observed_at desc);
create index if not exists moodle_grade_snapshots_open_scan_idx
  on public.moodle_grade_snapshots (estudiante_id, practica_id)
  where scan_closed is false;

comment on column public.moodle_grade_snapshots.last_task_status is
  'Ultimo estado realmente observado, aunque sea inferior al mejor estado confirmado conservado en task_status.';
comment on column public.moodle_grade_snapshots.scan_closed is
  'TRUE cuando la revision vigente tiene una nota final y ya no debe consultarse automaticamente.';

-- ---------------------------------------------------------------------------
-- 4. Una fila auditable por corrida del puente.
-- ---------------------------------------------------------------------------

create table if not exists public.moodle_sync_runs (
  request_id uuid primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  observed_at timestamptz,
  bridge_version text not null,
  parser_version text not null,
  outcome text not null default 'pending'
    check (outcome in ('pending', 'success', 'partial', 'noop', 'failed')),
  error_code text,
  requested_count integer not null default 0 check (requested_count >= 0),
  fetched_count integer not null default 0 check (fetched_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  stored_count integer not null default 0 check (stored_count >= 0),
  snapshot_updated_count integer not null default 0 check (snapshot_updated_count >= 0),
  preserved_count integer not null default 0 check (preserved_count >= 0),
  skipped_terminal_count integer not null default 0 check (skipped_terminal_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  details jsonb not null default '{}'::jsonb
);

alter table public.moodle_sync_runs enable row level security;
revoke all on table public.moodle_sync_runs from anon, authenticated;
grant select on table public.moodle_sync_runs to authenticated;
grant select, insert, update on table public.moodle_sync_runs to service_role;

drop policy if exists "Authorized users read Moodle sync runs"
  on public.moodle_sync_runs;
create policy "Authorized users read Moodle sync runs"
  on public.moodle_sync_runs
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.estudiantes e
      where e.id = estudiante_id
        and e.user_id = (select auth.uid())
    )
  );

create index if not exists moodle_sync_runs_student_started_idx
  on public.moodle_sync_runs (estudiante_id, started_at desc);
create index if not exists moodle_sync_runs_problem_idx
  on public.moodle_sync_runs (started_at desc, outcome)
  where outcome in ('partial', 'failed');

-- El ledger tecnico queda reservado a coordinacion; el alumno solo necesita
-- el snapshot actual y sus corridas resumidas.
drop policy if exists "Authorized users read Moodle observations"
  on public.moodle_grade_observations;
create policy "Admins read Moodle observations"
  on public.moodle_grade_observations
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 5. Cierre terminal por revision y reapertura administrativa auditada.
-- ---------------------------------------------------------------------------

alter table private.moodle_grade_applications
  add column if not exists grade_revision integer not null default 1;

alter table private.moodle_grade_applications
  drop constraint if exists moodle_grade_applications_conversion_rule_check;
alter table private.moodle_grade_applications
  add constraint moodle_grade_applications_conversion_rule_check
  check (conversion_rule in (
    'direct_legacy_ten_point', 'normalized_to_ten',
    'explicit_direct_10', 'explicit_percentage', 'explicit_pass_fail'
  ));

create table if not exists private.moodle_grade_finalizations (
  practica_id uuid not null references public.practicas(id) on delete restrict,
  cmid bigint not null,
  grade_revision integer not null check (grade_revision > 0),
  source_observation_id uuid not null unique
    references public.moodle_grade_observations(id) on delete restrict,
  application_id uuid not null unique
    references private.moodle_grade_applications(id) on delete restrict,
  finalized_at timestamptz not null default now(),
  primary key (practica_id, cmid, grade_revision)
);

revoke all on table private.moodle_grade_finalizations
  from public, anon, authenticated;
grant select, insert on table private.moodle_grade_finalizations to service_role;

insert into private.moodle_grade_finalizations (
  practica_id, cmid, grade_revision, source_observation_id, application_id, finalized_at
)
select distinct on (a.practica_id, a.cmid)
  a.practica_id,
  a.cmid,
  1,
  a.source_observation_id,
  a.id,
  a.applied_at
from private.moodle_grade_applications a
order by a.practica_id, a.cmid, a.source_observed_at desc, a.applied_at desc
on conflict (practica_id, cmid, grade_revision) do nothing;

create table if not exists public.moodle_grade_reopen_events (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null references public.practicas(id) on delete restrict,
  cmid bigint not null,
  requested_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reason text not null check (char_length(btrim(reason)) between 8 and 500),
  previous_revision integer not null,
  new_revision integer not null,
  constraint moodle_grade_reopen_revision_check
    check (new_revision = previous_revision + 1)
);

alter table public.moodle_grade_reopen_events enable row level security;
revoke all on table public.moodle_grade_reopen_events from anon, authenticated;
grant select, insert on table public.moodle_grade_reopen_events to authenticated;
grant select, insert on table public.moodle_grade_reopen_events to service_role;

drop policy if exists "Admins manage Moodle grade reopen events"
  on public.moodle_grade_reopen_events;
create policy "Admins manage Moodle grade reopen events"
  on public.moodle_grade_reopen_events
  for select to authenticated
  using ((select public.is_admin()));
create policy "Admins create Moodle grade reopen events"
  on public.moodle_grade_reopen_events
  for insert to authenticated
  with check (
    (select public.is_admin())
    and requested_by = (select auth.uid())
  );

create index if not exists moodle_grade_reopen_practice_idx
  on public.moodle_grade_reopen_events (practica_id, requested_at desc);

create or replace function private.prepare_moodle_grade_reopen_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_revision integer;
  snapshot_closed boolean;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;
  if new.requested_by is distinct from (select auth.uid()) then
    raise exception 'El solicitante no coincide con la sesion autenticada'
      using errcode = '42501';
  end if;

  select s.grade_revision, s.scan_closed
    into snapshot_revision, snapshot_closed
  from public.moodle_grade_snapshots s
  where s.practica_id = new.practica_id
    and s.cmid = new.cmid
  for update;

  if not found then
    raise exception 'No existe un snapshot Moodle para esa practica y tarea'
      using errcode = 'P0002';
  end if;
  if not snapshot_closed then
    raise exception 'La tarea ya esta abierta para sincronizacion'
      using errcode = '23514';
  end if;

  new.previous_revision := snapshot_revision;
  new.new_revision := snapshot_revision + 1;
  new.reason := btrim(new.reason);

  update public.moodle_grade_snapshots
  set scan_closed = false,
      grade_revision = new.new_revision,
      reopened_at = now()
  where practica_id = new.practica_id
    and cmid = new.cmid;

  return new;
end;
$$;

revoke all on function private.prepare_moodle_grade_reopen_event()
  from public, anon, authenticated;

drop trigger if exists prepare_moodle_grade_reopen_event_trigger
  on public.moodle_grade_reopen_events;
create trigger prepare_moodle_grade_reopen_event_trigger
before insert on public.moodle_grade_reopen_events
for each row execute function private.prepare_moodle_grade_reopen_event();

-- ---------------------------------------------------------------------------
-- 6. Snapshot monotono, pero sin ocultar que Moodle cambio despues.
-- ---------------------------------------------------------------------------

create or replace function private.preserve_moodle_grade_snapshot_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Todo INSERT inicializa en paralelo la ultima observacion.
  if tg_op = 'INSERT' then
    new.last_observation_id := new.latest_observation_id;
    new.last_task_status := new.task_status;
    new.last_submitted := new.submitted;
    new.last_grade_value := new.grade_value;
    new.last_grade_max := new.grade_max;
    new.last_grade_display := new.grade_display;
    new.last_graded_at_display := new.graded_at_display;
    new.last_observed_at := new.observed_at;
    new.last_received_at := new.received_at;
    new.last_confidence := new.confidence;
    new.scan_closed := new.task_status = 'graded';
    return new;
  end if;

  -- La parte last_* siempre representa la nueva lectura que intenta entrar.
  new.last_observation_id := new.latest_observation_id;
  new.last_task_status := new.task_status;
  new.last_submitted := new.submitted;
  new.last_grade_value := new.grade_value;
  new.last_grade_max := new.grade_max;
  new.last_grade_display := new.grade_display;
  new.last_graded_at_display := new.graded_at_display;
  new.last_observed_at := new.observed_at;
  new.last_received_at := new.received_at;
  new.last_confidence := new.confidence;
  new.grade_revision := old.grade_revision;
  new.reopened_at := old.reopened_at;

  -- Una revision cerrada nunca cambia. Una reapertura explicita pone
  -- scan_closed=false y habilita exactamente una nueva calificacion.
  if old.scan_closed then
    new.latest_observation_id := old.latest_observation_id;
    new.estudiante_id := old.estudiante_id;
    new.lanzamiento_id := old.lanzamiento_id;
    new.aula_entrega_id := old.aula_entrega_id;
    new.task_status := old.task_status;
    new.submitted := old.submitted;
    new.grade_value := old.grade_value;
    new.grade_max := old.grade_max;
    new.grade_display := old.grade_display;
    new.graded_at_display := old.graded_at_display;
    new.observed_at := old.observed_at;
    new.received_at := old.received_at;
    new.confidence := old.confidence;
    new.scan_closed := true;
    return new;
  end if;

  if old.task_status = 'graded' and new.task_status <> 'graded' then
    new.latest_observation_id := old.latest_observation_id;
    new.estudiante_id := old.estudiante_id;
    new.lanzamiento_id := old.lanzamiento_id;
    new.aula_entrega_id := old.aula_entrega_id;
    new.task_status := old.task_status;
    new.submitted := old.submitted;
    new.grade_value := old.grade_value;
    new.grade_max := old.grade_max;
    new.grade_display := old.grade_display;
    new.graded_at_display := old.graded_at_display;
    new.observed_at := old.observed_at;
    new.received_at := old.received_at;
    new.confidence := old.confidence;
    new.scan_closed := false;
    return new;
  end if;

  if private.moodle_grade_status_rank(new.task_status)
     < private.moodle_grade_status_rank(old.task_status) then
    new.latest_observation_id := old.latest_observation_id;
    new.estudiante_id := old.estudiante_id;
    new.lanzamiento_id := old.lanzamiento_id;
    new.aula_entrega_id := old.aula_entrega_id;
    new.task_status := old.task_status;
    new.submitted := old.submitted;
    new.grade_value := old.grade_value;
    new.grade_max := old.grade_max;
    new.grade_display := old.grade_display;
    new.graded_at_display := old.graded_at_display;
    new.observed_at := old.observed_at;
    new.received_at := old.received_at;
    new.confidence := old.confidence;
  end if;

  new.scan_closed := new.task_status = 'graded';
  return new;
end;
$$;

revoke all on function private.preserve_moodle_grade_snapshot_progress()
  from public, anon, authenticated;

drop trigger if exists preserve_moodle_grade_snapshot_progress_trigger
  on public.moodle_grade_snapshots;
create trigger preserve_moodle_grade_snapshot_progress_trigger
before insert or update on public.moodle_grade_snapshots
for each row execute function private.preserve_moodle_grade_snapshot_progress();

-- ---------------------------------------------------------------------------
-- 7. Aplicacion academica por regla explicita y revision terminal.
-- ---------------------------------------------------------------------------

create or replace function private.apply_moodle_grade_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_note text;
  note_text text;
  normalized_grade numeric;
  conversion_mode text;
  conversion_rule text;
  current_revision integer := 1;
  current_scan_closed boolean := false;
  application_id uuid;
  next_report_status text;
begin
  next_report_status := case new.task_status
    when 'graded' then 'calificado'
    when 'submitted' then 'entregado'
    when 'not_submitted' then 'sin_entrega'
    else 'a_revisar'
  end;

  -- El estado operativo progresa de forma monotona y ya no contamina nota.
  update public.practicas p
  set informe_estado = case
    when p.informe_estado = 'calificado' then p.informe_estado
    when p.informe_estado = 'entregado' and next_report_status in ('sin_entrega', 'a_revisar')
      then p.informe_estado
    when p.informe_estado = 'sin_entrega' and next_report_status = 'a_revisar'
      then p.informe_estado
    else next_report_status
  end
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id;

  if new.task_status <> 'graded'
     or new.grade_value is null
     or new.grade_max is null
     or new.grade_max <= 0 then
    return new;
  end if;

  select s.grade_revision, s.scan_closed
    into current_revision, current_scan_closed
  from public.moodle_grade_snapshots s
  where s.practica_id = new.practica_id
    and s.cmid = new.cmid
  for update;

  if found and current_scan_closed then
    return new;
  end if;

  if exists (
    select 1 from private.moodle_grade_finalizations f
    where f.practica_id = new.practica_id
      and f.cmid = new.cmid
      and f.grade_revision = current_revision
  ) then
    return new;
  end if;

  select a.grade_conversion_mode
    into conversion_mode
  from public.aula_entregas a
  where a.id = new.aula_entrega_id;

  if conversion_mode = 'direct_10' then
    normalized_grade := round(new.grade_value, 2);
    note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');
    conversion_rule := 'explicit_direct_10';
  elsif conversion_mode = 'pass_fail' then
    normalized_grade := null;
    note_text := case when new.grade_value > 0 then 'Aprobado' else 'Desaprobado' end;
    conversion_rule := 'explicit_pass_fail';
  else
    normalized_grade := round((new.grade_value / new.grade_max) * 10, 2);
    note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');
    conversion_rule := 'explicit_percentage';
  end if;

  if normalized_grade is not null and (normalized_grade < 0 or normalized_grade > 10) then
    raise exception 'La nota Moodle normalizada queda fuera del rango 0-10.'
      using errcode = '22003';
  end if;

  select p.nota into current_note
  from public.practicas p
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id
  for update;

  if not found then
    raise exception 'La practica observada no pertenece al estudiante validado.'
      using errcode = '23503';
  end if;

  update public.practicas
  set nota = note_text,
      informe_estado = 'calificado',
      nota_moodle = normalized_grade,
      nota_fuente = new.confidence,
      nota_actualizada_at = new.observed_at,
      nota_moodle_cmid = new.cmid
  where id = new.practica_id;

  insert into private.moodle_grade_applications (
    source_observation_id, source_observed_at, estudiante_id, practica_id,
    cmid, previous_note, applied_note, grade_value, grade_max,
    conversion_rule, confidence, changed, grade_revision
  ) values (
    new.id, new.observed_at, new.estudiante_id, new.practica_id,
    new.cmid, current_note, note_text, new.grade_value, new.grade_max,
    conversion_rule, new.confidence, current_note is distinct from note_text,
    current_revision
  ) returning id into application_id;

  insert into private.moodle_grade_finalizations (
    practica_id, cmid, grade_revision, source_observation_id, application_id
  ) values (
    new.practica_id, new.cmid, current_revision, new.id, application_id
  );

  return new;
end;
$$;

revoke all on function private.apply_moodle_grade_observation()
  from public, anon, authenticated;

-- Backfill de las nuevas columnas sin alterar la nota legacy ya aplicada.
with latest_application as (
  select distinct on (a.practica_id)
    a.practica_id,
    a.cmid,
    a.applied_note,
    a.confidence,
    a.source_observed_at
  from private.moodle_grade_applications a
  order by a.practica_id, a.source_observed_at desc, a.applied_at desc
)
update public.practicas p
set informe_estado = 'calificado',
    nota_moodle = case
      when replace(a.applied_note, ',', '.') ~ '^[0-9]+([.][0-9]+)?$'
        then replace(a.applied_note, ',', '.')::numeric
      else null
    end,
    nota_fuente = a.confidence,
    nota_actualizada_at = a.source_observed_at,
    nota_moodle_cmid = a.cmid
from latest_application a
where p.id = a.practica_id;

with best_snapshot as (
  select distinct on (s.practica_id)
    s.practica_id,
    s.task_status
  from public.moodle_grade_snapshots s
  order by s.practica_id,
    private.moodle_grade_status_rank(s.task_status) desc,
    s.observed_at desc
)
update public.practicas p
set informe_estado = case s.task_status
  when 'graded' then 'calificado'
  when 'submitted' then 'entregado'
  when 'not_submitted' then 'sin_entrega'
  else 'a_revisar'
end
from best_snapshot s
where p.id = s.practica_id
  and p.informe_estado is null;

-- ---------------------------------------------------------------------------
-- 8. Resolucion server-side para Finalizacion/Egreso.
-- ---------------------------------------------------------------------------

create or replace function public.get_finalization_grade_resolution(
  p_finalizacion_id uuid
)
returns table (
  practica_id uuid,
  nota text,
  nota_numeric numeric,
  fuente text,
  observed_at timestamptz,
  moodle_status text,
  cmid bigint,
  grade_display text,
  nota_promedio numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;

  return query
  with request_items as (
    select distinct (item ->> 'practicaId')::uuid as practica_id
    from public.finalizacion_pps f
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(f.detalle_practicas -> 'items') = 'array'
          then f.detalle_practicas -> 'items'
        else '[]'::jsonb
      end
    ) item
    where f.id = p_finalizacion_id
      and item ->> 'practicaId' ~* '^[0-9a-f-]{36}$'
  ), resolved as (
    select
      p.id as practica_id,
      coalesce(
        case when p.nota_moodle is not null
          then rtrim(rtrim(to_char(p.nota_moodle, 'FM999999990.00'), '0'), '.') end,
        nullif(btrim(p.nota), '')
      ) as nota,
      coalesce(
        p.nota_moodle,
        case
          when replace(btrim(coalesce(p.nota, '')), ',', '.') ~ '^[0-9]+([.][0-9]+)?$'
            and replace(btrim(p.nota), ',', '.')::numeric between 0 and 10
          then replace(btrim(p.nota), ',', '.')::numeric
          else null
        end
      ) as nota_numeric,
      coalesce(p.nota_fuente,
        case when nullif(btrim(coalesce(p.nota, '')), '') is not null then 'legacy' end
      ) as fuente,
      p.nota_actualizada_at as observed_at,
      s.task_status as moodle_status,
      p.nota_moodle_cmid as cmid,
      s.grade_display
    from request_items r
    join public.practicas p on p.id = r.practica_id
    left join public.moodle_grade_snapshots s
      on s.practica_id = p.id
     and s.cmid = p.nota_moodle_cmid
  )
  select
    r.practica_id,
    r.nota,
    r.nota_numeric,
    r.fuente,
    r.observed_at,
    r.moodle_status,
    r.cmid,
    r.grade_display,
    round(avg(r.nota_numeric) over (), 0) as nota_promedio
  from resolved r
  order by r.practica_id;
end;
$$;

revoke all on function public.get_finalization_grade_resolution(uuid)
  from public, anon;
grant execute on function public.get_finalization_grade_resolution(uuid)
  to authenticated;

comment on function public.get_finalization_grade_resolution(uuid) is
  'Resuelve para coordinacion las notas actuales de una solicitud desde Practicas/Moodle y calcula el promedio en servidor; nunca confia en el JSON estudiantil.';

-- ---------------------------------------------------------------------------
-- 9. Salud de sincronizacion y backlog de vinculacion para coordinacion.
-- ---------------------------------------------------------------------------

create or replace function private.moodle_orientation_key(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when translate(lower(coalesce(p_value, '')), 'áéíóúüñ', 'aeiouun') like '%educ%'
      then 'educacional'
    when translate(lower(coalesce(p_value, '')), 'áéíóúüñ', 'aeiouun') like '%clinic%'
      then 'clinica'
    when translate(lower(coalesce(p_value, '')), 'áéíóúüñ', 'aeiouun') like '%comunit%'
      then 'comunitaria'
    when translate(lower(coalesce(p_value, '')), 'áéíóúüñ', 'aeiouun') like '%labor%'
      or translate(lower(coalesce(p_value, '')), 'áéíóúüñ', 'aeiouun') like '%organiz%'
      then 'laboral'
    else null
  end;
$$;

revoke all on function private.moodle_orientation_key(text)
  from public, anon, authenticated;

create or replace function public.get_moodle_unlinked_practices(
  p_from_year integer default 2024
)
returns table (
  practica_id uuid,
  estudiante_id uuid,
  estudiante_nombre text,
  institucion text,
  especialidad text,
  fecha_inicio text,
  reason_code text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.estudiante_id,
    nullif(btrim(concat_ws(' ', e.apellido, e.nombre)), ''),
    coalesce(p.nombre_institucion, l.nombre_pps),
    p.especialidad,
    p.fecha_inicio,
    case
      when p.lanzamiento_id is null then 'without_launch'
      when private.moodle_orientation_key(p.especialidad) is null then 'unrecognized_orientation'
      when not exists (
        select 1 from public.lanzamiento_moodle_tareas lm
        join public.aula_entregas a on a.id = lm.aula_entrega_id and a.activo
        where lm.lanzamiento_id = p.lanzamiento_id
          and lm.validation_status = 'confirmed'
      ) then 'launch_without_confirmed_task'
      else 'orientation_without_active_task'
    end
  from public.practicas p
  join public.estudiantes e on e.id = p.estudiante_id
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  where coalesce(substring(p.fecha_inicio from '^(\\d{4})')::integer, 0) >= p_from_year
    and not exists (
      select 1
      from public.practica_moodle_tareas pm
      join public.aula_entregas a on a.id = pm.aula_entrega_id and a.activo
      where pm.practica_id = p.id
        and pm.validation_status = 'confirmed'
    )
    and not exists (
      select 1
      from public.lanzamiento_moodle_tareas lm
      join public.aula_entregas a on a.id = lm.aula_entrega_id and a.activo
      where lm.lanzamiento_id = p.lanzamiento_id
        and lm.validation_status = 'confirmed'
        and lm.orientacion_key = private.moodle_orientation_key(p.especialidad)
    )
  order by p.fecha_inicio desc, e.apellido, e.nombre;
end;
$$;

revoke all on function public.get_moodle_unlinked_practices(integer)
  from public, anon;
grant execute on function public.get_moodle_unlinked_practices(integer)
  to authenticated;

create or replace function public.get_moodle_sync_health()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'linkedStudents', (
      select count(distinct p.estudiante_id)
      from public.practicas p
      where exists (
        select 1 from public.practica_moodle_tareas pm
        join public.aula_entregas a on a.id = pm.aula_entrega_id and a.activo
        where pm.practica_id = p.id and pm.validation_status = 'confirmed'
      ) or exists (
        select 1 from public.lanzamiento_moodle_tareas lm
        join public.aula_entregas a on a.id = lm.aula_entrega_id and a.activo
        where lm.lanzamiento_id = p.lanzamiento_id
          and lm.validation_status = 'confirmed'
          and lm.orientacion_key = private.moodle_orientation_key(p.especialidad)
      )
    ),
    'syncedStudents', (select count(distinct estudiante_id) from public.moodle_grade_snapshots),
    'graded', (select count(*) from public.moodle_grade_snapshots where task_status = 'graded'),
    'submitted', (select count(*) from public.moodle_grade_snapshots where task_status = 'submitted'),
    'notSubmitted', (select count(*) from public.moodle_grade_snapshots where task_status = 'not_submitted'),
    'review', (select count(*) from public.moodle_grade_snapshots where task_status in ('no_access', 'parse_error')),
    'staleSevenDays', (
      select count(*) from public.moodle_grade_snapshots
      where last_observed_at < now() - interval '7 days' and scan_closed is false
    ),
    'partialRunsSevenDays', (
      select count(*) from public.moodle_sync_runs
      where started_at >= now() - interval '7 days' and outcome = 'partial'
    ),
    'failedRunsSevenDays', (
      select count(*) from public.moodle_sync_runs
      where started_at >= now() - interval '7 days' and outcome = 'failed'
    ),
    'unlinkedSince2024', (
      select count(*) from public.get_moodle_unlinked_practices(2024)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_moodle_sync_health()
  from public, anon;
grant execute on function public.get_moodle_sync_health()
  to authenticated;

comment on function public.get_moodle_sync_health() is
  'Resumen operativo para coordinacion: adopcion, estados, corridas fallidas, staleness y vinculaciones pendientes.';

commit;
