-- Moodle Task Automation v2.
--
-- This migration creates the canonical contract and a safe RPC boundary. It
-- never edits Moodle by itself: an authenticated coordinator agent must claim
-- a dedicated intent, perform the browser operation and confirm the complete
-- observed configuration with the same lease token.

create schema if not exists private;

-- Repair the historical mojibake in the shared normalizer. Unicode escapes
-- keep the migration encoding-independent and correctly handle "Clínica" and
-- every other accented orientation used by the live data.
create or replace function private.moodle_orientation_key(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  with normalized as (
    select translate(
      lower(coalesce(p_value, '')),
      U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1',
      'aeiouun'
    ) as value
  )
  select case
    when value like '%educ%' then 'educacional'
    when value like '%clinic%' then 'clinica'
    when value like '%comunit%' then 'comunitaria'
    when value like '%labor%' or value like '%organiz%' then 'laboral'
    else null
  end
  from normalized;
$$;
revoke all on function private.moodle_orientation_key(text)
  from public, anon, authenticated;

create table public.moodle_task_intents (
  id uuid primary key default gen_random_uuid(),
  lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete cascade,
  orientacion_key text not null
    check (orientacion_key in ('clinica', 'laboral', 'comunitaria', 'educacional', 'otra')),
  mode text not null check (mode in ('legacy_shared', 'dedicated')),
  stable_key text not null unique,
  desired_name text not null,
  description_template_version text not null default 'v1',
  desired_description_html text,
  desired_open_at timestamptz,
  desired_due_at timestamptz,
  desired_cutoff_at timestamptz,
  desired_grade_mode text not null default 'direct_10'
    check (desired_grade_mode in ('percentage', 'direct_10', 'pass_fail')),
  desired_grade_max numeric not null default 10 check (desired_grade_max > 0),
  desired_section_key text,
  desired_visibility text not null default 'visible'
    check (desired_visibility in ('visible', 'hidden')),
  desired_config_hash text not null,
  provisioning_status text not null default 'pending'
    check (provisioning_status in (
      'pending', 'claimed', 'reconciling', 'verified', 'needs_attention',
      'error', 'disabled', 'cancelled'
    )),
  monitoring_status text not null default 'not_started'
    check (monitoring_status in ('not_started', 'hot', 'cold', 'settled', 'needs_attention')),
  next_reconcile_at timestamptz,
  next_scan_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_message text,
  last_attempt_at timestamptz,
  last_verified_at timestamptz,
  last_observed_at timestamptz,
  observed_config_hash text,
  observed_config jsonb,
  provisioning_evidence jsonb,
  aula_entrega_id bigint references public.aula_entregas(id) on delete set null,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moodle_task_intents_unit_key unique (lanzamiento_id, orientacion_key),
  constraint moodle_task_intents_lease_shape check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  ),
  constraint moodle_task_intents_verified_link check (
    provisioning_status <> 'verified' or aula_entrega_id is not null
  )
);

comment on table public.moodle_task_intents is
  'Declaracion canonica de una unidad de entrega: lanzamiento PPS + orientacion.';
comment on column public.moodle_task_intents.stable_key is
  'Clave interna inmutable. Solo en mode=dedicated debe coincidir con ID number de Moodle.';
comment on column public.moodle_task_intents.mode is
  'legacy_shared adopta una tarea existente sin reconfigurarla; dedicated exige una tarea exclusiva.';

create index moodle_task_intents_reconcile_idx
  on public.moodle_task_intents (next_reconcile_at, created_at)
  where provisioning_status in ('pending', 'error', 'claimed', 'reconciling');
create index moodle_task_intents_scan_idx
  on public.moodle_task_intents (next_scan_at, updated_at)
  where monitoring_status in ('hot', 'cold');
create index moodle_task_intents_aula_entrega_idx
  on public.moodle_task_intents (aula_entrega_id)
  where aula_entrega_id is not null;

create table public.moodle_task_expected_participants (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.moodle_task_intents(id) on delete cascade,
  practica_id uuid not null references public.practicas(id) on delete cascade,
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  membership_status text not null default 'expected'
    check (membership_status in ('expected', 'withdrawn', 'institution_failed', 'waived', 'replaced')),
  active_from timestamptz not null default now(),
  active_to timestamptz,
  source text not null default 'selection'
    check (source in ('selection', 'replacement', 'backfill', 'manual')),
  reason_code text,
  reason_note text,
  replaces_participant_id uuid references public.moodle_task_expected_participants(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moodle_task_expected_active_window check (active_to is null or active_to >= active_from)
);

comment on table public.moodle_task_expected_participants is
  'Padron historico de quienes deben entregar en una unidad; no se deduce de la lista actual de Moodle.';

create unique index moodle_task_expected_active_idx
  on public.moodle_task_expected_participants (intent_id, practica_id)
  where active_to is null;
create index moodle_task_expected_intent_status_idx
  on public.moodle_task_expected_participants (intent_id, membership_status, active_to);
create index moodle_task_expected_student_idx
  on public.moodle_task_expected_participants (estudiante_id, intent_id);

create table private.moodle_agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('provision', 'observe', 'repair_drift', 'adopt_legacy')),
  agent_version text not null,
  template_version text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial_error', 'failed')),
  items_total integer not null default 0 check (items_total >= 0),
  items_verified integer not null default 0 check (items_verified >= 0),
  items_skipped integer not null default 0 check (items_skipped >= 0),
  items_failed integer not null default 0 check (items_failed >= 0),
  actor_session_id text,
  error_summary text,
  created_at timestamptz not null default now()
);

create table private.moodle_agent_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.moodle_agent_runs(id) on delete cascade,
  intent_id uuid references public.moodle_task_intents(id) on delete set null,
  step text not null check (step in ('claim', 'find', 'create', 'configure', 'verify', 'persist', 'scan')),
  status text not null check (status in ('success', 'error', 'skipped')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  cmid_observed bigint,
  hash_before text,
  hash_after text,
  error_code text,
  error_message text,
  evidence_payload jsonb,
  created_at timestamptz not null default now()
);

create index moodle_agent_run_items_run_idx on private.moodle_agent_run_items (run_id, created_at);
create index moodle_agent_run_items_intent_idx
  on private.moodle_agent_run_items (intent_id, created_at) where intent_id is not null;

alter table public.moodle_task_intents enable row level security;
alter table public.moodle_task_expected_participants enable row level security;
alter table private.moodle_agent_runs enable row level security;
alter table private.moodle_agent_run_items enable row level security;

revoke all on table public.moodle_task_intents from public, anon, authenticated;
revoke all on table public.moodle_task_expected_participants from public, anon, authenticated;
grant select on table public.moodle_task_intents to authenticated;
grant select on table public.moodle_task_expected_participants to authenticated;
grant all on table public.moodle_task_intents to service_role;
grant all on table public.moodle_task_expected_participants to service_role;
revoke all on table private.moodle_agent_runs from public, anon, authenticated;
revoke all on table private.moodle_agent_run_items from public, anon, authenticated;
grant all on table private.moodle_agent_runs to service_role;
grant all on table private.moodle_agent_run_items to service_role;

create or replace function private.moodle_v2_is_coordinator()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or exists (
      select 1 from public.estudiantes e
      where e.user_id = (select auth.uid()) and e.role in ('SuperUser', 'AdminTester')
    );
$$;
revoke all on function private.moodle_v2_is_coordinator() from public, anon, authenticated;
grant execute on function private.moodle_v2_is_coordinator() to authenticated, service_role;

create or replace function private.moodle_v2_can_read_unit(
  p_lanzamiento_id uuid,
  p_orientacion_key text
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.moodle_v2_is_coordinator()
    or exists (
      select 1 from public.estudiantes e
      where e.user_id = (select auth.uid()) and e.role = 'Directivo'
    )
    or exists (
      select 1
      from public.estudiantes e
      join private.jefe_area_assignments a on a.dni = e.dni::bigint
      where e.user_id = (select auth.uid())
        and e.role = 'Jefe'
        and a.area_key = p_orientacion_key
    )
    or exists (
      select 1
      from public.practicas p
      join public.estudiantes e on e.id = p.estudiante_id
      left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
      where e.user_id = (select auth.uid())
        and p.lanzamiento_id = p_lanzamiento_id
        and private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) = p_orientacion_key
    );
$$;
revoke all on function private.moodle_v2_can_read_unit(uuid, text) from public, anon, authenticated;
grant execute on function private.moodle_v2_can_read_unit(uuid, text) to authenticated, service_role;

create policy "Scoped read Moodle task intents"
  on public.moodle_task_intents for select to authenticated
  using (private.moodle_v2_can_read_unit(lanzamiento_id, orientacion_key));
create policy "Scoped read Moodle expected participants"
  on public.moodle_task_expected_participants for select to authenticated
  using (
    exists (
      select 1 from public.moodle_task_intents i
      where i.id = intent_id
        and private.moodle_v2_can_read_unit(i.lanzamiento_id, i.orientacion_key)
    )
    or exists (
      select 1 from public.estudiantes e
      where e.id = estudiante_id and e.user_id = (select auth.uid())
    )
  );

create or replace function private.moodle_v2_config_hash(
  p_stable_key text, p_name text, p_description_html text,
  p_open_at timestamptz, p_due_at timestamptz, p_cutoff_at timestamptz,
  p_grade_mode text, p_grade_max numeric, p_section_key text,
  p_visibility text, p_template_version text
)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select md5(jsonb_build_object(
    'stable_key', p_stable_key, 'name', p_name,
    'description_html', p_description_html, 'open_at', p_open_at,
    'due_at', p_due_at, 'cutoff_at', p_cutoff_at,
    'grade_mode', p_grade_mode, 'grade_max', p_grade_max,
    'section_key', p_section_key, 'visibility', p_visibility,
    'template_version', p_template_version
  )::text);
$$;
revoke all on function private.moodle_v2_config_hash(
  text, text, text, timestamptz, timestamptz, timestamptz,
  text, numeric, text, text, text
) from public, anon, authenticated;

-- Reconcile creates one unit per confirmed legacy link. From 2027 onward it
-- creates dedicated units only after the launch is active, once per normalized
-- practice orientation. Unknown orientations are never defaulted.
create or replace function private.reconcile_moodle_task_intents_v1_impl(p_launch_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_unit record;
  v_intent_id uuid;
  v_intent_count integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_participants_synced integer := 0;
  v_participants_closed integer := 0;
  v_rows integer;
  v_existing boolean;
  v_finish_date date;
  v_open_at timestamptz;
  v_due_at timestamptz;
  v_stable_key text;
  v_desired_name text;
  v_desired_hash text;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;

  for v_unit in
    with confirmed_legacy as (
      select l.id as lanzamiento_id, l.nombre_pps, l.fecha_inicio, l.fecha_finalizacion,
        lm.orientacion_key, 'legacy_shared'::text as mode, lm.aula_entrega_id,
        ae.moodle_name, ae.institucion as task_institution, ae.grade_conversion_mode,
        coalesce(ae.moodle_grade_max, 10) as grade_max, lm.validated_at
      from public.lanzamiento_moodle_tareas lm
      join public.lanzamientos_pps l on l.id = lm.lanzamiento_id
      join public.aula_entregas ae on ae.id = lm.aula_entrega_id and ae.activo
      where lm.validation_status = 'confirmed'
        and (p_launch_id is null or l.id = p_launch_id)
        and coalesce(substring(l.fecha_inicio from '^(\d{4})')::integer, 0) < 2027
    ), dedicated_units as (
      select distinct on (l.id, unit.orientacion_key)
        l.id as lanzamiento_id, l.nombre_pps, l.fecha_inicio, l.fecha_finalizacion,
        unit.orientacion_key, 'dedicated'::text as mode, null::bigint as aula_entrega_id,
        null::text as moodle_name, null::text as task_institution,
        'direct_10'::text as grade_conversion_mode, 10::numeric as grade_max,
        null::timestamptz as validated_at
      from public.lanzamientos_pps l
      cross join lateral (
        select private.moodle_orientation_key(p.especialidad) as orientacion_key
        from public.practicas p where p.lanzamiento_id = l.id
        union select private.moodle_orientation_key(l.orientacion)
      ) unit
      where coalesce(substring(l.fecha_inicio from '^(\d{4})')::integer, 0) >= 2027
        and lower(coalesce(l.estado_convocatoria, '')) in ('activa', 'archivado')
        and unit.orientacion_key is not null
        and (p_launch_id is null or l.id = p_launch_id)
      order by l.id, unit.orientacion_key
    )
    select * from confirmed_legacy union all select * from dedicated_units
  loop
    v_finish_date := case when v_unit.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}$'
      then v_unit.fecha_finalizacion::date else null end;
    v_open_at := case when v_finish_date is not null then
      (v_finish_date - 7 + time '00:00:00') at time zone 'America/Argentina/Buenos_Aires' end;
    v_due_at := case when v_finish_date is not null then
      (v_finish_date + 30 + time '23:59:59') at time zone 'America/Argentina/Buenos_Aires' end;
    v_stable_key := 'PPS:' || v_unit.lanzamiento_id::text || ':' || v_unit.orientacion_key;
    v_desired_name := case when v_unit.mode = 'legacy_shared' then
      coalesce(nullif(trim(v_unit.moodle_name), ''), nullif(trim(v_unit.task_institution), ''), 'Informe PPS')
    else concat('Informe final PPS · ', coalesce(nullif(trim(v_unit.nombre_pps), ''), 'PPS'),
      ' · ', initcap(v_unit.orientacion_key)) end;
    v_desired_hash := private.moodle_v2_config_hash(
      v_stable_key, v_desired_name, null, v_open_at, v_due_at, null,
      v_unit.grade_conversion_mode, v_unit.grade_max,
      'informes-' || v_unit.orientacion_key, 'visible', 'v1'
    );

    select exists (select 1 from public.moodle_task_intents i
      where i.lanzamiento_id = v_unit.lanzamiento_id
        and i.orientacion_key = v_unit.orientacion_key) into v_existing;

    insert into public.moodle_task_intents (
      lanzamiento_id, orientacion_key, mode, stable_key, desired_name,
      desired_open_at, desired_due_at, desired_grade_mode, desired_grade_max,
      desired_section_key, desired_visibility, desired_config_hash,
      provisioning_status, monitoring_status, next_reconcile_at, next_scan_at,
      aula_entrega_id, last_verified_at
    ) values (
      v_unit.lanzamiento_id, v_unit.orientacion_key, v_unit.mode, v_stable_key,
      v_desired_name, v_open_at, v_due_at, v_unit.grade_conversion_mode,
      v_unit.grade_max, 'informes-' || v_unit.orientacion_key, 'visible',
      v_desired_hash, case when v_unit.mode = 'legacy_shared' then 'verified' else 'pending' end,
      case when v_open_at is not null and now() >= v_open_at then 'hot' else 'not_started' end,
      case when v_unit.mode = 'dedicated' then now() end,
      case when v_open_at is not null then greatest(now(), v_open_at) end,
      v_unit.aula_entrega_id,
      case when v_unit.mode = 'legacy_shared' then coalesce(v_unit.validated_at, now()) end
    )
    on conflict (lanzamiento_id, orientacion_key) do update set
      mode = excluded.mode,
      desired_name = excluded.desired_name,
      desired_open_at = excluded.desired_open_at,
      desired_due_at = excluded.desired_due_at,
      desired_grade_mode = excluded.desired_grade_mode,
      desired_grade_max = excluded.desired_grade_max,
      desired_section_key = excluded.desired_section_key,
      desired_visibility = excluded.desired_visibility,
      desired_config_hash = excluded.desired_config_hash,
      provisioning_status = case
        when excluded.mode = 'legacy_shared' then 'verified'
        when public.moodle_task_intents.provisioning_status = 'verified'
          and public.moodle_task_intents.desired_config_hash is distinct from excluded.desired_config_hash
          then 'needs_attention'
        else public.moodle_task_intents.provisioning_status end,
      monitoring_status = case when public.moodle_task_intents.monitoring_status = 'settled'
        then 'settled' else excluded.monitoring_status end,
      next_reconcile_at = case when excluded.mode = 'dedicated'
        and public.moodle_task_intents.provisioning_status in ('pending', 'error')
        then coalesce(public.moodle_task_intents.next_reconcile_at, now())
        else public.moodle_task_intents.next_reconcile_at end,
      next_scan_at = coalesce(public.moodle_task_intents.next_scan_at, excluded.next_scan_at),
      aula_entrega_id = coalesce(excluded.aula_entrega_id, public.moodle_task_intents.aula_entrega_id),
      last_verified_at = case when excluded.mode = 'legacy_shared'
        then coalesce(public.moodle_task_intents.last_verified_at, excluded.last_verified_at)
        else public.moodle_task_intents.last_verified_at end,
      updated_at = now()
    returning id into v_intent_id;

    if v_existing then v_updated := v_updated + 1; else v_created := v_created + 1; end if;
    select count(*) into v_intent_count from public.moodle_task_intents i
      where i.lanzamiento_id = v_unit.lanzamiento_id and i.provisioning_status <> 'cancelled';

    insert into public.moodle_task_expected_participants (
      intent_id, practica_id, estudiante_id, membership_status, active_from, source
    )
    select v_intent_id, p.id, p.estudiante_id,
      case
        when lower(coalesce(p.estado, '')) in ('desaprobada', 'desaprobado') then 'institution_failed'
        when lower(coalesce(p.estado, '')) in ('cancelada', 'cancelado', 'abandonada', 'abandonado') then 'withdrawn'
        else 'expected' end,
      coalesce(p.created_at, now()),
      case when v_unit.mode = 'legacy_shared' then 'backfill' else 'selection' end
    from public.practicas p
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    where p.lanzamiento_id = v_unit.lanzamiento_id and p.estudiante_id is not null
      and (
        private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) = v_unit.orientacion_key
        or (private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) is null
          and v_intent_count = 1)
      )
    on conflict (intent_id, practica_id) where active_to is null do update set
      estudiante_id = excluded.estudiante_id,
      membership_status = case when public.moodle_task_expected_participants.source = 'manual'
        then public.moodle_task_expected_participants.membership_status
        else excluded.membership_status end,
      updated_at = now();
    get diagnostics v_rows = row_count;
    v_participants_synced := v_participants_synced + v_rows;

    update public.moodle_task_expected_participants ep
    set membership_status = 'withdrawn', active_to = now(),
      reason_code = coalesce(ep.reason_code, 'NO_LONGER_IN_UNIT'), updated_at = now()
    where ep.intent_id = v_intent_id and ep.active_to is null and ep.membership_status = 'expected'
      and not exists (
        select 1 from public.practicas p
        left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
        where p.id = ep.practica_id and p.estudiante_id = ep.estudiante_id
          and p.lanzamiento_id = v_unit.lanzamiento_id
          and (
            private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) = v_unit.orientacion_key
            or (private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) is null
              and v_intent_count = 1)
          )
      );
    get diagnostics v_rows = row_count;
    v_participants_closed := v_participants_closed + v_rows;
  end loop;

  return jsonb_build_object(
    'intents_created', v_created, 'intents_updated', v_updated,
    'participants_synced', v_participants_synced,
    'participants_closed', v_participants_closed
  );
end;
$$;
revoke all on function private.reconcile_moodle_task_intents_v1_impl(uuid) from public, anon, authenticated;
grant execute on function private.reconcile_moodle_task_intents_v1_impl(uuid) to authenticated, service_role;

create or replace function public.reconcile_moodle_task_intents_v1(p_launch_id uuid default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.reconcile_moodle_task_intents_v1_impl(p_launch_id); $$;
revoke all on function public.reconcile_moodle_task_intents_v1(uuid) from public, anon;
grant execute on function public.reconcile_moodle_task_intents_v1(uuid) to authenticated, service_role;

-- Keep the declaration/padron transactional with the events that define it.
-- The external agent remains responsible only for the Moodle browser write.
create or replace function private.trigger_reconcile_moodle_task_intents_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_launch_id uuid;
begin
  if not private.moodle_v2_is_coordinator() then
    return new;
  end if;

  if tg_table_name = 'lanzamientos_pps' then
    v_launch_id := new.id;
    if lower(coalesce(new.estado_convocatoria, '')) not in ('activa', 'archivado') then
      return new;
    end if;
  else
    v_launch_id := new.lanzamiento_id;
  end if;

  perform private.reconcile_moodle_task_intents_v1_impl(v_launch_id);
  return new;
end;
$$;
revoke all on function private.trigger_reconcile_moodle_task_intents_v1()
  from public, anon, authenticated;

drop trigger if exists reconcile_moodle_intents_after_launch_change on public.lanzamientos_pps;
create trigger reconcile_moodle_intents_after_launch_change
after insert or update of estado_convocatoria, fecha_inicio, fecha_finalizacion, orientacion
on public.lanzamientos_pps
for each row execute function private.trigger_reconcile_moodle_task_intents_v1();

drop trigger if exists reconcile_moodle_intents_after_practice_change on public.practicas;
create trigger reconcile_moodle_intents_after_practice_change
after insert or update of lanzamiento_id, estudiante_id, especialidad, estado
on public.practicas
for each row
when (new.lanzamiento_id is not null)
execute function private.trigger_reconcile_moodle_task_intents_v1();

drop trigger if exists reconcile_moodle_intents_after_link_change on public.lanzamiento_moodle_tareas;
create trigger reconcile_moodle_intents_after_link_change
after insert or update of aula_entrega_id, orientacion_key, validation_status
on public.lanzamiento_moodle_tareas
for each row execute function private.trigger_reconcile_moodle_task_intents_v1();

create or replace function private.claim_moodle_task_intent_lease_v1_impl(
  p_batch_size integer, p_lease_seconds integer, p_worker_token uuid
)
returns setof public.moodle_task_intents
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;
  if p_batch_size < 1 or p_batch_size > 20 then
    raise exception 'Batch size must be between 1 and 20' using errcode = '22023'; end if;
  if p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'Lease seconds must be between 30 and 1800' using errcode = '22023'; end if;
  if p_worker_token is null then
    raise exception 'Worker token is required' using errcode = '22023'; end if;

  return query
  with candidates as (
    select i.id from public.moodle_task_intents i
    where i.mode = 'dedicated' and coalesce(i.next_reconcile_at, now()) <= now()
      and (i.provisioning_status in ('pending', 'error')
        or (i.provisioning_status in ('claimed', 'reconciling') and i.lease_expires_at < now()))
    order by i.next_reconcile_at nulls first, i.created_at
    limit p_batch_size for update skip locked
  )
  update public.moodle_task_intents i
  set provisioning_status = 'claimed', lease_token = p_worker_token,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    last_attempt_at = now(), attempt_count = i.attempt_count + 1,
    last_error_code = null, last_error_message = null, updated_at = now()
  from candidates c where i.id = c.id returning i.*;
end;
$$;
revoke all on function private.claim_moodle_task_intent_lease_v1_impl(integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function private.claim_moodle_task_intent_lease_v1_impl(integer, integer, uuid)
  to authenticated, service_role;

create or replace function public.claim_moodle_task_intent_lease_v1(
  p_batch_size integer default 5,
  p_lease_seconds integer default 300,
  p_worker_token uuid default gen_random_uuid()
)
returns setof public.moodle_task_intents language sql security invoker set search_path = ''
as $$
  select * from private.claim_moodle_task_intent_lease_v1_impl(
    p_batch_size, p_lease_seconds, p_worker_token
  );
$$;
revoke all on function public.claim_moodle_task_intent_lease_v1(integer, integer, uuid)
  from public, anon;
grant execute on function public.claim_moodle_task_intent_lease_v1(integer, integer, uuid)
  to authenticated, service_role;

-- Confirmation is fail-closed: legacy tasks are never modified, a live lease
-- is mandatory and every material setting must hash exactly as declared.
create or replace function private.confirm_moodle_task_intent_v1_impl(
  p_intent_id uuid, p_lease_token uuid, p_cmid bigint, p_course_id bigint,
  p_observed_stable_key text, p_observed_name text, p_observed_description_html text,
  p_observed_open_at timestamptz, p_observed_due_at timestamptz,
  p_observed_cutoff_at timestamptz, p_observed_grade_mode text,
  p_observed_grade_max numeric, p_observed_section_key text,
  p_observed_visibility text, p_evidence jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_intent public.moodle_task_intents%rowtype;
  v_observed_hash text;
  v_aula_id bigint;
  v_year smallint;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501'; end if;
  if p_cmid <= 0 or p_course_id <= 0 then
    raise exception 'Invalid Moodle identifiers' using errcode = '22023'; end if;

  select * into v_intent from public.moodle_task_intents i
    where i.id = p_intent_id for update;
  if v_intent.id is null then
    raise exception 'Moodle task intent not found' using errcode = 'P0002'; end if;
  if v_intent.mode <> 'dedicated' then
    raise exception 'Legacy shared tasks cannot be provisioned or reconfigured automatically'
      using errcode = '42501'; end if;
  if v_intent.provisioning_status not in ('claimed', 'reconciling')
    or v_intent.lease_token is distinct from p_lease_token
    or v_intent.lease_expires_at <= now() then
    raise exception 'Invalid or expired Moodle task lease' using errcode = '42501'; end if;
  if p_observed_stable_key is distinct from v_intent.stable_key then
    raise exception 'Moodle ID number does not match the stable key' using errcode = '22023'; end if;

  v_observed_hash := private.moodle_v2_config_hash(
    p_observed_stable_key, p_observed_name, p_observed_description_html,
    p_observed_open_at, p_observed_due_at, p_observed_cutoff_at,
    p_observed_grade_mode, p_observed_grade_max, p_observed_section_key,
    p_observed_visibility, v_intent.description_template_version
  );

  if v_observed_hash is distinct from v_intent.desired_config_hash then
    update public.moodle_task_intents set provisioning_status = 'needs_attention',
      observed_config_hash = v_observed_hash,
      observed_config = jsonb_strip_nulls(jsonb_build_object(
        'stable_key', p_observed_stable_key, 'name', p_observed_name,
        'description_html', p_observed_description_html, 'open_at', p_observed_open_at,
        'due_at', p_observed_due_at, 'cutoff_at', p_observed_cutoff_at,
        'grade_mode', p_observed_grade_mode, 'grade_max', p_observed_grade_max,
        'section_key', p_observed_section_key, 'visibility', p_observed_visibility
      )),
      provisioning_evidence = p_evidence, last_observed_at = now(),
      last_error_code = 'CONFIG_DRIFT',
      last_error_message = 'La configuracion observada no coincide con la declarada.',
      lease_token = null, lease_expires_at = null, updated_at = now()
    where id = p_intent_id;
    return jsonb_build_object('verified', false, 'status', 'needs_attention',
      'desired_hash', v_intent.desired_config_hash, 'observed_hash', v_observed_hash);
  end if;

  select coalesce(substring(l.fecha_inicio from '^(\d{4})')::smallint,
    extract(year from current_date)::smallint) into v_year
  from public.lanzamientos_pps l where l.id = v_intent.lanzamiento_id;

  insert into public.aula_entregas (
    course_id, academic_year, moodle_id, institucion, moodle_name, area,
    moodle_grade_max, grade_conversion_mode, source_synced_at, activo
  ) values (
    p_course_id, v_year, p_cmid::text, v_intent.desired_name, p_observed_name,
    v_intent.orientacion_key, p_observed_grade_max, p_observed_grade_mode, now(), true
  )
  on conflict (course_id, moodle_id) do update set
    academic_year = excluded.academic_year, institucion = excluded.institucion,
    moodle_name = excluded.moodle_name, area = excluded.area,
    moodle_grade_max = excluded.moodle_grade_max,
    grade_conversion_mode = excluded.grade_conversion_mode,
    source_synced_at = now(), activo = true
  returning id into v_aula_id;

  insert into public.lanzamiento_moodle_tareas (
    lanzamiento_id, orientacion_key, aula_entrega_id, validation_status,
    link_source, rationale, validated_at, validated_by
  ) values (
    v_intent.lanzamiento_id, v_intent.orientacion_key, v_aula_id, 'confirmed',
    'manual', 'Tarea exclusiva verificada por Moodle Automation v2: ' || v_intent.stable_key,
    now(), (select auth.uid())
  )
  on conflict (lanzamiento_id, orientacion_key) do update set
    aula_entrega_id = excluded.aula_entrega_id, validation_status = 'confirmed',
    link_source = 'manual', rationale = excluded.rationale, validated_at = now(),
    validated_by = excluded.validated_by, updated_at = now();

  update public.moodle_task_intents set provisioning_status = 'verified',
    monitoring_status = case when desired_open_at is null or desired_open_at <= now()
      then 'hot' else 'not_started' end,
    aula_entrega_id = v_aula_id, observed_config_hash = v_observed_hash,
    observed_config = jsonb_strip_nulls(jsonb_build_object(
      'stable_key', p_observed_stable_key, 'name', p_observed_name,
      'description_html', p_observed_description_html, 'open_at', p_observed_open_at,
      'due_at', p_observed_due_at, 'cutoff_at', p_observed_cutoff_at,
      'grade_mode', p_observed_grade_mode, 'grade_max', p_observed_grade_max,
      'section_key', p_observed_section_key, 'visibility', p_observed_visibility
    )),
    provisioning_evidence = p_evidence, last_observed_at = now(),
    last_verified_at = now(), next_reconcile_at = null,
    last_error_code = null, last_error_message = null,
    lease_token = null, lease_expires_at = null, updated_at = now()
  where id = p_intent_id;

  return jsonb_build_object('verified', true, 'status', 'verified',
    'intent_id', p_intent_id, 'aula_entrega_id', v_aula_id, 'cmid', p_cmid);
end;
$$;
revoke all on function private.confirm_moodle_task_intent_v1_impl(
  uuid, uuid, bigint, bigint, text, text, text, timestamptz, timestamptz,
  timestamptz, text, numeric, text, text, jsonb
) from public, anon, authenticated;
grant execute on function private.confirm_moodle_task_intent_v1_impl(
  uuid, uuid, bigint, bigint, text, text, text, timestamptz, timestamptz,
  timestamptz, text, numeric, text, text, jsonb
) to authenticated, service_role;

create or replace function public.confirm_moodle_task_intent_v1(
  p_intent_id uuid, p_lease_token uuid, p_cmid bigint, p_course_id bigint,
  p_observed_stable_key text, p_observed_name text, p_observed_description_html text,
  p_observed_open_at timestamptz, p_observed_due_at timestamptz,
  p_observed_cutoff_at timestamptz, p_observed_grade_mode text,
  p_observed_grade_max numeric, p_observed_section_key text,
  p_observed_visibility text, p_evidence jsonb default null
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select private.confirm_moodle_task_intent_v1_impl(
    p_intent_id, p_lease_token, p_cmid, p_course_id, p_observed_stable_key,
    p_observed_name, p_observed_description_html, p_observed_open_at,
    p_observed_due_at, p_observed_cutoff_at, p_observed_grade_mode,
    p_observed_grade_max, p_observed_section_key, p_observed_visibility, p_evidence
  );
$$;
revoke all on function public.confirm_moodle_task_intent_v1(
  uuid, uuid, bigint, bigint, text, text, text, timestamptz, timestamptz,
  timestamptz, text, numeric, text, text, jsonb
) from public, anon;
grant execute on function public.confirm_moodle_task_intent_v1(
  uuid, uuid, bigint, bigint, text, text, text, timestamptz, timestamptz,
  timestamptz, text, numeric, text, text, jsonb
) to authenticated, service_role;

create or replace function private.request_moodle_task_reconcile_v1_impl(p_intent_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501'; end if;
  update public.moodle_task_intents set provisioning_status = 'pending',
    next_reconcile_at = now(), lease_token = null, lease_expires_at = null,
    last_error_code = null, last_error_message = null, updated_at = now()
  where id = p_intent_id and mode = 'dedicated'
    and provisioning_status in ('error', 'needs_attention');
  return found;
end;
$$;
revoke all on function private.request_moodle_task_reconcile_v1_impl(uuid)
  from public, anon, authenticated;
grant execute on function private.request_moodle_task_reconcile_v1_impl(uuid)
  to authenticated, service_role;
create or replace function public.request_moodle_task_reconcile_v1(p_intent_id uuid)
returns boolean language sql security invoker set search_path = ''
as $$ select private.request_moodle_task_reconcile_v1_impl(p_intent_id); $$;
revoke all on function public.request_moodle_task_reconcile_v1(uuid) from public, anon;
grant execute on function public.request_moodle_task_reconcile_v1(uuid) to authenticated, service_role;

create or replace function private.set_moodle_expected_participant_exception_v1_impl(
  p_participant_id uuid, p_new_status text, p_reason_code text, p_reason_note text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501'; end if;
  if p_new_status not in ('expected', 'withdrawn', 'institution_failed', 'waived', 'replaced') then
    raise exception 'Invalid membership status' using errcode = '22023'; end if;
  if p_new_status <> 'expected' and nullif(trim(coalesce(p_reason_code, '')), '') is null then
    raise exception 'A reason code is required for participant exceptions' using errcode = '22023'; end if;
  update public.moodle_task_expected_participants set membership_status = p_new_status,
    reason_code = nullif(trim(p_reason_code), ''), reason_note = nullif(trim(p_reason_note), ''),
    active_to = case when p_new_status in ('withdrawn', 'replaced') then now() else null end,
    updated_at = now() where id = p_participant_id;
  return found;
end;
$$;
revoke all on function private.set_moodle_expected_participant_exception_v1_impl(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function private.set_moodle_expected_participant_exception_v1_impl(uuid, text, text, text)
  to authenticated, service_role;
create or replace function public.set_moodle_expected_participant_exception_v1(
  p_participant_id uuid, p_new_status text, p_reason_code text, p_reason_note text default null
)
returns boolean language sql security invoker set search_path = ''
as $$
  select private.set_moodle_expected_participant_exception_v1_impl(
    p_participant_id, p_new_status, p_reason_code, p_reason_note
  );
$$;
revoke all on function public.set_moodle_expected_participant_exception_v1(uuid, text, text, text)
  from public, anon;
grant execute on function public.set_moodle_expected_participant_exception_v1(uuid, text, text, text)
  to authenticated, service_role;

-- Aggregates use the configured Moodle scale. A passing grade is only settled
-- once the practice has actually ended; submission and approval remain separate.
create or replace function public.get_moodle_task_unit_summaries_v1(
  p_launch_id uuid default null,
  p_orientation text default null
)
returns table (
  intent_id uuid, lanzamiento_id uuid, nombre_pps text, orientacion_key text,
  mode text, stable_key text, provisioning_status text, monitoring_status text,
  cmid bigint, course_id bigint, desired_open_at timestamptz,
  desired_due_at timestamptz, last_verified_at timestamptz, last_error_message text,
  total_expected bigint, total_submitted bigint, total_missing bigint,
  total_under_review bigint, total_revision_required bigint, total_passed bigint,
  total_failed bigint, total_waived bigint, total_settled bigint
)
language sql stable security invoker set search_path = ''
as $$
  with participant_rows as (
    select i.id as intent_id, ep.id as participant_id, ep.membership_status,
      p.informe_estado, s.task_status, s.submitted, s.grade_value, s.grade_max,
      ae.grade_conversion_mode,
      case
        when s.task_status <> 'graded' or s.grade_value is null then false
        when ae.grade_conversion_mode = 'pass_fail' then s.grade_value > 0
        when ae.grade_conversion_mode = 'direct_10' then s.grade_value >= 4
        when coalesce(s.grade_max, 0) > 0 then (s.grade_value / s.grade_max) * 10 >= 4
        else false end as passing_grade,
      case
        when p.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}$' then p.fecha_finalizacion::date
        when l.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}$' then l.fecha_finalizacion::date
        else null end as ended_on
    from public.moodle_task_intents i
    join public.lanzamientos_pps l on l.id = i.lanzamiento_id
    join public.moodle_task_expected_participants ep on ep.intent_id = i.id
    join public.practicas p on p.id = ep.practica_id
    left join public.aula_entregas ae on ae.id = i.aula_entrega_id
    left join public.moodle_grade_snapshots s on s.practica_id = ep.practica_id
      and s.cmid = case when ae.moodle_id ~ '^[0-9]+$' then ae.moodle_id::bigint end
    where ep.membership_status not in ('withdrawn', 'replaced')
  )
  select i.id, i.lanzamiento_id, l.nombre_pps, i.orientacion_key, i.mode,
    i.stable_key, i.provisioning_status, i.monitoring_status,
    case when ae.moodle_id ~ '^[0-9]+$' then ae.moodle_id::bigint end,
    ae.course_id, i.desired_open_at, i.desired_due_at, i.last_verified_at,
    i.last_error_message,
    count(pr.participant_id) filter (where pr.membership_status = 'expected'),
    count(pr.participant_id) filter (where pr.membership_status = 'expected'
      and (coalesce(pr.submitted, false)
        or lower(coalesce(pr.informe_estado, '')) in ('entregado', 'calificado'))),
    count(pr.participant_id) filter (where pr.membership_status = 'expected'
      and not coalesce(pr.submitted, false)
      and lower(coalesce(pr.informe_estado, '')) not in ('entregado', 'calificado')),
    count(pr.participant_id) filter (where pr.membership_status = 'expected'
      and (coalesce(pr.submitted, false) or lower(coalesce(pr.informe_estado, '')) = 'entregado')
      and not pr.passing_grade and pr.task_status is distinct from 'graded'),
    count(pr.participant_id) filter (where pr.membership_status = 'expected'
      and pr.task_status = 'graded' and not pr.passing_grade),
    count(pr.participant_id) filter (where pr.membership_status = 'expected' and pr.passing_grade),
    count(pr.participant_id) filter (where pr.membership_status = 'institution_failed'),
    count(pr.participant_id) filter (where pr.membership_status = 'waived'),
    count(pr.participant_id) filter (
      where pr.membership_status in ('institution_failed', 'waived')
        or (pr.membership_status = 'expected' and pr.passing_grade
          and pr.ended_on is not null
          and pr.ended_on <= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
    )
  from public.moodle_task_intents i
  join public.lanzamientos_pps l on l.id = i.lanzamiento_id
  left join public.aula_entregas ae on ae.id = i.aula_entrega_id
  left join participant_rows pr on pr.intent_id = i.id
  where (p_launch_id is null or i.lanzamiento_id = p_launch_id)
    and (p_orientation is null or i.orientacion_key = p_orientation)
  group by i.id, l.nombre_pps, ae.moodle_id, ae.course_id
  order by i.orientacion_key;
$$;
revoke all on function public.get_moodle_task_unit_summaries_v1(uuid, text) from public, anon;
grant execute on function public.get_moodle_task_unit_summaries_v1(uuid, text)
  to authenticated, service_role;

comment on function public.get_moodle_task_unit_summaries_v1(uuid, text) is
  'Resumen canonico por lanzamiento y orientacion; respeta RLS y la escala explicita de cada tarea.';
