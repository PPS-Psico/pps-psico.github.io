-- Endurece la recuperación de contraseña por correo:
--   * emisión y rate limits atómicos;
--   * correo de Auth verificado, ligado al token mediante SHA-256;
--   * un único enlace vigente por estudiante;
--   * token quemado al primer canje, incluso ante errores ambiguos;
--   * retención acotada y sin IP en claro;
--   * límite específico para los correos iniciados por estudiantes.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Estado y trazabilidad segura de los tokens
-- ---------------------------------------------------------------------------

alter table public.password_reset_tokens
  add column if not exists status text,
  add column if not exists delivery_email_hash text,
  add column if not exists requested_ip_hash text,
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failure_code text;

update public.password_reset_tokens
set status = case
  when completed_at is not null or used_at is not null then 'completed'
  when expires_at <= now() then 'expired'
  else 'sent'
end
where status is null;

-- La IP histórica no se necesita para recuperar una cuenta y no debe
-- conservarse en claro. Los pedidos nuevos guardan solamente un hash con sal.
update public.password_reset_tokens
set requested_ip = null
where requested_ip is not null;

alter table public.password_reset_tokens
  alter column status set default 'pending',
  alter column status set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'password_reset_tokens_status_check'
      and conrelid = 'public.password_reset_tokens'::regclass
  ) then
    alter table public.password_reset_tokens
      add constraint password_reset_tokens_status_check
      check (
        status in (
          'pending',
          'sent',
          'claimed',
          'completed',
          'failed',
          'superseded',
          'expired'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'password_reset_tokens_token_hash_format_check'
      and conrelid = 'public.password_reset_tokens'::regclass
  ) then
    alter table public.password_reset_tokens
      add constraint password_reset_tokens_token_hash_format_check
      check (token_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'password_reset_tokens_delivery_hash_check'
      and conrelid = 'public.password_reset_tokens'::regclass
  ) then
    alter table public.password_reset_tokens
      add constraint password_reset_tokens_delivery_hash_check
      check (
        status in ('failed', 'expired')
        or delivery_email_hash ~ '^[0-9a-f]{64}$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'password_reset_tokens_user_id_fkey'
      and conrelid = 'public.password_reset_tokens'::regclass
  ) then
    alter table public.password_reset_tokens
      add constraint password_reset_tokens_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;
end
$migration$;

alter table public.password_reset_tokens
  validate constraint password_reset_tokens_user_id_fkey;

drop index if exists public.idx_password_reset_tokens_lookup;

create unique index if not exists password_reset_tokens_one_sent_per_student_idx
  on public.password_reset_tokens (estudiante_id)
  where status = 'sent' and used_at is null;

create index if not exists password_reset_tokens_ip_window_idx
  on public.password_reset_tokens (requested_ip_hash, created_at desc)
  where requested_ip_hash is not null;

create index if not exists password_reset_tokens_pending_idx
  on public.password_reset_tokens (created_at)
  where status = 'pending';

comment on column public.password_reset_tokens.status is
  'pending: reservado; sent: SMTP aceptó el mensaje; claimed: primer canje; completed/failed/superseded/expired: terminal.';
comment on column public.password_reset_tokens.delivery_email_hash is
  'SHA-256 del correo confirmado de auth.users usado para entregar el enlace.';
comment on column public.password_reset_tokens.requested_ip_hash is
  'SHA-256 con sal de la IP observada por Edge; nunca se almacena la IP en claro.';
comment on column public.password_reset_tokens.requested_ip is
  'Obsoleto. Se conserva temporalmente por compatibilidad y debe permanecer NULL.';

-- ---------------------------------------------------------------------------
-- Implementación privilegiada en esquema no expuesto
-- ---------------------------------------------------------------------------

create or replace function private.create_password_reset_request(
  p_estudiante_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_delivery_email_hash text,
  p_requested_ip_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_request_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_delivery_email_hash !~ '^[0-9a-f]{64}$'
    or p_requested_ip_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= statement_timestamp()
    or p_expires_at > statement_timestamp() + interval '65 minutes'
  then
    raise exception 'invalid password reset request';
  end if;

  if not exists (
    select 1
    from public.estudiantes e
    where e.id = p_estudiante_id
      and e.user_id = p_user_id
  ) then
    return null;
  end if;

  -- Una única exclusión global vuelve atómicos los tres contadores. El lock se
  -- mantiene sólo durante estas consultas/INSERT, nunca durante SMTP.
  perform pg_advisory_xact_lock(hashtextextended('password-reset-issuance', 0));

  update public.password_reset_tokens
  set
    status = 'failed',
    used_at = coalesce(used_at, statement_timestamp()),
    failure_code = 'delivery_timeout'
  where status = 'pending'
    and created_at < statement_timestamp() - interval '15 minutes';

  -- Protección del proveedor: 20 pendientes/enviados en 10 minutos o 100 por
  -- hora como máximo para todo el sistema.
  if (
    select count(*)
    from public.password_reset_tokens
    where created_at > statement_timestamp() - interval '10 minutes'
      and status in ('pending', 'sent')
  ) >= 20
  or (
    select count(*)
    from public.password_reset_tokens
    where created_at > statement_timestamp() - interval '1 hour'
      and status in ('pending', 'sent', 'claimed', 'completed', 'superseded')
  ) >= 100
  then
    return null;
  end if;

  -- Por IP se cuentan también los fallos para que provocar errores SMTP no
  -- permita eludir el límite.
  if (
    select count(*)
    from public.password_reset_tokens
    where requested_ip_hash = p_requested_ip_hash
      and created_at > statement_timestamp() - interval '1 hour'
  ) >= 15
  then
    return null;
  end if;

  -- Tres correos aceptados o pendientes por alumno y hora.
  if (
    select count(*)
    from public.password_reset_tokens
    where estudiante_id = p_estudiante_id
      and created_at > statement_timestamp() - interval '1 hour'
      and status in ('pending', 'sent', 'claimed', 'completed', 'superseded')
  ) >= 3
  then
    return null;
  end if;

  insert into public.password_reset_tokens (
    estudiante_id,
    user_id,
    token_hash,
    delivery_email_hash,
    requested_ip_hash,
    expires_at,
    status
  )
  values (
    p_estudiante_id,
    p_user_id,
    p_token_hash,
    p_delivery_email_hash,
    p_requested_ip_hash,
    p_expires_at,
    'pending'
  )
  returning id into v_request_id;

  return v_request_id;
end
$function$;

create or replace function private.finalize_password_reset_delivery(
  p_request_id uuid,
  p_delivered boolean,
  p_failure_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_estudiante_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('password-reset-issuance', 0));

  select estudiante_id
  into v_estudiante_id
  from public.password_reset_tokens
  where id = p_request_id
    and status = 'pending'
  for update;

  if v_estudiante_id is null then
    return false;
  end if;

  if not p_delivered then
    update public.password_reset_tokens
    set
      status = 'failed',
      used_at = statement_timestamp(),
      failure_code = left(coalesce(p_failure_code, 'delivery_failed'), 80)
    where id = p_request_id;
    return true;
  end if;

  -- El enlace nuevo se vuelve vigente sólo después de la aceptación SMTP.
  update public.password_reset_tokens
  set
    status = 'superseded',
    used_at = statement_timestamp(),
    failure_code = 'newer_link_sent'
  where estudiante_id = v_estudiante_id
    and id <> p_request_id
    and status = 'sent'
    and used_at is null;

  update public.password_reset_tokens
  set status = 'sent'
  where id = p_request_id
    and status = 'pending';

  return found;
end
$function$;

create or replace function private.claim_password_reset_token(
  p_token_hash text
)
returns table (
  request_id uuid,
  estudiante_id uuid,
  user_id uuid,
  delivery_email_hash text
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
  update public.password_reset_tokens t
  set
    status = 'claimed',
    claimed_at = statement_timestamp(),
    used_at = statement_timestamp()
  from public.estudiantes e
  where t.token_hash = p_token_hash
    and t.status = 'sent'
    and t.used_at is null
    and t.expires_at > statement_timestamp()
    and e.id = t.estudiante_id
    and e.user_id = t.user_id
  returning t.id, t.estudiante_id, t.user_id, t.delivery_email_hash;
end
$function$;

create or replace function private.complete_password_reset(
  p_request_id uuid,
  p_success boolean,
  p_failure_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_estudiante_id uuid;
  v_user_id uuid;
begin
  select estudiante_id, user_id
  into v_estudiante_id, v_user_id
  from public.password_reset_tokens
  where id = p_request_id
    and status = 'claimed'
  for update;

  if v_estudiante_id is null then
    return false;
  end if;

  if not p_success then
    update public.password_reset_tokens
    set
      status = 'failed',
      failure_code = left(coalesce(p_failure_code, 'password_update_failed'), 80)
    where id = p_request_id;
    return true;
  end if;

  update public.password_reset_tokens
  set
    status = 'completed',
    completed_at = statement_timestamp(),
    failure_code = null
  where id = p_request_id;

  -- Cualquier correo concurrente o anterior deja de servir tras un reset
  -- exitoso, incluso si su envío termina unos milisegundos después.
  update public.password_reset_tokens
  set
    status = 'superseded',
    used_at = coalesce(used_at, statement_timestamp()),
    failure_code = 'password_already_reset'
  where user_id = v_user_id
    and id <> p_request_id
    and status in ('pending', 'sent');

  update public.estudiantes
  set must_change_password = false
  where id = v_estudiante_id
    and user_id = v_user_id;

  return true;
end
$function$;

-- Wrappers SECURITY INVOKER en el esquema expuesto. Sólo service_role puede
-- ejecutarlos; la lógica SECURITY DEFINER permanece en `private`.
create or replace function public.create_password_reset_request(
  p_estudiante_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_delivery_email_hash text,
  p_requested_ip_hash text,
  p_expires_at timestamptz
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.create_password_reset_request(
    p_estudiante_id,
    p_user_id,
    p_token_hash,
    p_delivery_email_hash,
    p_requested_ip_hash,
    p_expires_at
  );
$function$;

create or replace function public.finalize_password_reset_delivery(
  p_request_id uuid,
  p_delivered boolean,
  p_failure_code text default null
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.finalize_password_reset_delivery(
    p_request_id,
    p_delivered,
    p_failure_code
  );
$function$;

create or replace function public.claim_password_reset_token(
  p_token_hash text
)
returns table (
  request_id uuid,
  estudiante_id uuid,
  user_id uuid,
  delivery_email_hash text
)
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private.claim_password_reset_token(p_token_hash);
$function$;

create or replace function public.complete_password_reset(
  p_request_id uuid,
  p_success boolean,
  p_failure_code text default null
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.complete_password_reset(
    p_request_id,
    p_success,
    p_failure_code
  );
$function$;

revoke all on function private.create_password_reset_request(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function private.finalize_password_reset_delivery(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function private.claim_password_reset_token(text)
  from public, anon, authenticated;
revoke all on function private.complete_password_reset(uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function private.create_password_reset_request(uuid, uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function private.finalize_password_reset_delivery(uuid, boolean, text)
  to service_role;
grant execute on function private.claim_password_reset_token(text)
  to service_role;
grant execute on function private.complete_password_reset(uuid, boolean, text)
  to service_role;

revoke all on function public.create_password_reset_request(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.finalize_password_reset_delivery(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.claim_password_reset_token(text)
  from public, anon, authenticated;
revoke all on function public.complete_password_reset(uuid, boolean, text)
  from public, anon, authenticated;

grant execute on function public.create_password_reset_request(uuid, uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function public.finalize_password_reset_delivery(uuid, boolean, text)
  to service_role;
grant execute on function public.claim_password_reset_token(text)
  to service_role;
grant execute on function public.complete_password_reset(uuid, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Rate limit para send-email cuando lo inicia un alumno
-- ---------------------------------------------------------------------------

create table if not exists private.student_email_send_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'reserved'
    check (status in ('reserved', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

revoke all on table private.student_email_send_events
  from public, anon, authenticated, service_role;

create index if not exists student_email_send_events_user_window_idx
  on private.student_email_send_events (user_id, created_at desc);

create or replace function private.reserve_student_email_send(
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_event_id uuid;
begin
  if not exists (
    select 1
    from public.estudiantes e
    where e.user_id = p_user_id
      and coalesce(e.role, 'Alumno') = 'Alumno'
  ) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('student-email-send', 0));

  update private.student_email_send_events
  set
    status = 'failed',
    completed_at = statement_timestamp()
  where status = 'reserved'
    and created_at < statement_timestamp() - interval '15 minutes';

  if (
    select count(*)
    from private.student_email_send_events
    where user_id = p_user_id
      and created_at > statement_timestamp() - interval '1 hour'
      and status in ('reserved', 'sent')
  ) >= 5
  or (
    select count(*)
    from private.student_email_send_events
    where user_id = p_user_id
      and created_at > statement_timestamp() - interval '1 day'
      and status in ('reserved', 'sent')
  ) >= 20
  or (
    select count(*)
    from private.student_email_send_events
    where created_at > statement_timestamp() - interval '1 hour'
      and status in ('reserved', 'sent')
  ) >= 50
  then
    return null;
  end if;

  insert into private.student_email_send_events (user_id)
  values (p_user_id)
  returning id into v_event_id;

  return v_event_id;
end
$function$;

create or replace function private.finish_student_email_send(
  p_event_id uuid,
  p_sent boolean
)
returns boolean
language sql
security definer
set search_path = pg_catalog
as $function$
  update private.student_email_send_events
  set
    status = case when p_sent then 'sent' else 'failed' end,
    completed_at = statement_timestamp()
  where id = p_event_id
    and status = 'reserved'
  returning true;
$function$;

create or replace function public.reserve_student_email_send(
  p_user_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.reserve_student_email_send(p_user_id);
$function$;

create or replace function public.finish_student_email_send(
  p_event_id uuid,
  p_sent boolean
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.finish_student_email_send(p_event_id, p_sent);
$function$;

revoke all on function private.reserve_student_email_send(uuid)
  from public, anon, authenticated;
revoke all on function private.finish_student_email_send(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.reserve_student_email_send(uuid)
  from public, anon, authenticated;
revoke all on function public.finish_student_email_send(uuid, boolean)
  from public, anon, authenticated;

grant execute on function private.reserve_student_email_send(uuid)
  to service_role;
grant execute on function private.finish_student_email_send(uuid, boolean)
  to service_role;
grant execute on function public.reserve_student_email_send(uuid)
  to service_role;
grant execute on function public.finish_student_email_send(uuid, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- Retención y cierre definitivo de la verificación por PII estática
-- ---------------------------------------------------------------------------

create or replace function private.cleanup_password_reset_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  update public.password_reset_tokens
  set
    status = 'expired',
    used_at = coalesce(used_at, statement_timestamp()),
    requested_ip_hash = null
  where status in ('pending', 'sent')
    and expires_at <= statement_timestamp();

  update public.password_reset_tokens
  set requested_ip_hash = null
  where requested_ip_hash is not null
    and created_at < statement_timestamp() - interval '7 days';

  delete from public.password_reset_tokens
  where created_at < statement_timestamp() - interval '30 days'
    and status in ('completed', 'failed', 'superseded', 'expired');

  delete from private.student_email_send_events
  where created_at < statement_timestamp() - interval '30 days';
end
$function$;

revoke all on function private.cleanup_password_reset_data()
  from public, anon, authenticated, service_role;

do $migration$
declare
  v_job_id bigint;
begin
  if to_regnamespace('cron') is not null then
    select jobid
    into v_job_id
    from cron.job
    where jobname = 'cleanup-password-reset-data'
    limit 1;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;

    perform cron.schedule(
      'cleanup-password-reset-data',
      '17 3 * * *',
      'select private.cleanup_password_reset_data();'
    );
  end if;
end
$migration$;

revoke execute on function public.reset_student_password_verified(text, bigint, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.verify_student_identity(text, bigint, text, text)
  from public, anon, authenticated;
revoke execute on function public.get_student_email_by_legajo(text)
  from public, anon, authenticated;
revoke execute on function public.get_student_for_signup(text)
  from public, anon, authenticated;
