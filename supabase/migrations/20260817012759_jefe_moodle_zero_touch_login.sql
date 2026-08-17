-- Zero-touch Moodle entry for the three area heads. The browser never chooses
-- an area or a privileged role: a short-lived Moodle ticket must match the
-- server-side DNI + Moodle user id allowlist before an Auth identity can be
-- linked to the pre-existing Jefe profile.

create table if not exists private.jefe_moodle_identities (
  dni bigint primary key,
  moodle_user_id bigint not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.jefe_moodle_identities is
  'Allowlist de identidad Moodle para ingreso automático de jefaturas. Una fila por persona; las áreas permanecen separadas en jefe_area_assignments.';

revoke all on table private.jefe_moodle_identities from public, anon, authenticated;
grant select, insert, update, delete on table private.jefe_moodle_identities to service_role;

insert into private.jefe_moodle_identities (dni, moodle_user_id)
values
  (13842270, 9386),
  (34052382, 2338),
  (26777403, 394)
on conflict (dni) do update
set
  moodle_user_id = excluded.moodle_user_id,
  updated_at = now();

create or replace function private.get_moodle_jefe_login_candidate_v1(
  token_hash_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.moodle_signup_tickets%rowtype;
  v_student public.estudiantes%rowtype;
  v_auth_user_id uuid;
  v_auth_confirmed_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Moodle jefe login service required';
  end if;

  if token_hash_input !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select ticket.*
  into v_ticket
  from public.moodle_signup_tickets ticket
  where ticket.token_hash = token_hash_input;

  if v_ticket.id is null
    or v_ticket.course_id <> 3615
    or v_ticket.used_at is not null
    or v_ticket.expires_at <= now()
    or v_ticket.moodle_username !~ '^\d{6,12}$'
  then
    return null;
  end if;

  select student.*
  into v_student
  from private.jefe_moodle_identities identity
  join public.estudiantes student on student.dni::bigint = identity.dni
  where identity.dni = v_ticket.moodle_username::bigint
    and identity.moodle_user_id = v_ticket.moodle_user_id
    and student.role = 'Jefe'
    and lower(trim(coalesce(student.nombre_separado, ''))) = lower(trim(v_ticket.firstname))
    and lower(trim(coalesce(student.apellido_separado, ''))) = lower(trim(v_ticket.lastname))
  order by student.created_at desc nulls last
  limit 1;

  if v_student.id is null
    or (
      nullif(lower(trim(coalesce(v_student.correo, ''))), '') is not null
      and lower(trim(v_student.correo)) <> lower(trim(v_ticket.email))
    )
  then
    return null;
  end if;

  select users.id, users.email_confirmed_at
  into v_auth_user_id, v_auth_confirmed_at
  from auth.users users
  where lower(trim(users.email)) = lower(trim(v_ticket.email))
  limit 1;

  if v_auth_user_id is not null and exists (
    select 1
    from public.estudiantes other_student
    where other_student.user_id = v_auth_user_id
      and other_student.id <> v_student.id
  ) then
    return null;
  end if;

  if v_student.user_id is not null
    and (
      v_auth_user_id is distinct from v_student.user_id
      or v_auth_confirmed_at is null
    )
  then
    return null;
  end if;

  return jsonb_build_object(
    'student_id', v_student.id,
    'profile_user_id', v_student.user_id,
    'auth_user_id', v_auth_user_id,
    'auth_confirmed', v_auth_confirmed_at is not null,
    'email', lower(trim(v_ticket.email)),
    'dni', v_student.dni::bigint,
    'moodle_user_id', v_ticket.moodle_user_id
  );
end;
$$;

create or replace function private.complete_moodle_jefe_login_v1(
  token_hash_input text,
  userid_input uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.moodle_signup_tickets%rowtype;
  v_student public.estudiantes%rowtype;
  v_student_id uuid;
  v_auth_email text;
  v_auth_confirmed_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Moodle jefe login service required';
  end if;

  if token_hash_input !~ '^[0-9a-f]{64}$' or userid_input is null then
    raise exception 'Invalid Moodle jefe login data';
  end if;

  select ticket.*
  into v_ticket
  from public.moodle_signup_tickets ticket
  where ticket.token_hash = token_hash_input
  for update;

  if v_ticket.id is null
    or v_ticket.course_id <> 3615
    or v_ticket.used_at is not null
    or v_ticket.expires_at <= now()
    or v_ticket.moodle_username !~ '^\d{6,12}$'
  then
    raise exception 'Invalid or expired Moodle jefe login ticket';
  end if;

  select student.*
  into v_student
  from private.jefe_moodle_identities identity
  join public.estudiantes student on student.dni::bigint = identity.dni
  where identity.dni = v_ticket.moodle_username::bigint
    and identity.moodle_user_id = v_ticket.moodle_user_id
    and student.role = 'Jefe'
    and lower(trim(coalesce(student.nombre_separado, ''))) = lower(trim(v_ticket.firstname))
    and lower(trim(coalesce(student.apellido_separado, ''))) = lower(trim(v_ticket.lastname))
  order by student.created_at desc nulls last
  limit 1
  for update of student;

  if v_student.id is null
    or (
      nullif(lower(trim(coalesce(v_student.correo, ''))), '') is not null
      and lower(trim(v_student.correo)) <> lower(trim(v_ticket.email))
    )
  then
    raise exception 'Moodle jefe identity mismatch';
  end if;

  select lower(trim(users.email)), users.email_confirmed_at
  into v_auth_email, v_auth_confirmed_at
  from auth.users users
  where users.id = userid_input;

  if v_auth_email is null
    or v_auth_confirmed_at is null
    or v_auth_email <> lower(trim(v_ticket.email))
  then
    raise exception 'Invalid Moodle jefe Auth identity';
  end if;

  if v_student.user_id is not null and v_student.user_id <> userid_input then
    raise exception 'Jefe profile already linked to another account';
  end if;

  if exists (
    select 1
    from public.estudiantes other_student
    where other_student.user_id = userid_input
      and other_student.id <> v_student.id
  ) then
    raise exception 'Auth account already linked to another profile';
  end if;

  update public.estudiantes
  set
    user_id = userid_input,
    correo = coalesce(nullif(trim(correo), ''), v_auth_email),
    estado = case when estado is distinct from 'Finalizado' then 'Activo' else estado end,
    must_change_password = false
  where id = v_student.id
    and role = 'Jefe'
    and (user_id is null or user_id = userid_input)
  returning id into v_student_id;

  if v_student_id is null then
    raise exception 'Jefe profile could not be linked';
  end if;

  update public.moodle_signup_tickets
  set
    used_at = now(),
    auth_user_id = userid_input
  where id = v_ticket.id
    and used_at is null;

  if not found then
    raise exception 'Moodle jefe login ticket was already consumed';
  end if;

  return v_student_id;
end;
$$;

create or replace function public.get_moodle_jefe_login_candidate_v1(
  token_hash_input text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_moodle_jefe_login_candidate_v1(token_hash_input);
$$;

create or replace function public.complete_moodle_jefe_login_v1(
  token_hash_input text,
  userid_input uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.complete_moodle_jefe_login_v1(token_hash_input, userid_input);
$$;

revoke all on function private.get_moodle_jefe_login_candidate_v1(text)
  from public, anon, authenticated;
revoke all on function private.complete_moodle_jefe_login_v1(text, uuid)
  from public, anon, authenticated;
revoke all on function public.get_moodle_jefe_login_candidate_v1(text)
  from public, anon, authenticated;
revoke all on function public.complete_moodle_jefe_login_v1(text, uuid)
  from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.get_moodle_jefe_login_candidate_v1(text) to service_role;
grant execute on function private.complete_moodle_jefe_login_v1(text, uuid) to service_role;
grant execute on function public.get_moodle_jefe_login_candidate_v1(text) to service_role;
grant execute on function public.complete_moodle_jefe_login_v1(text, uuid) to service_role;

comment on function public.get_moodle_jefe_login_candidate_v1(text) is
  'Service-only preflight for zero-touch Moodle login of an allowlisted Jefe.';
comment on function public.complete_moodle_jefe_login_v1(text, uuid) is
  'Service-only atomic profile link and ticket consumption for zero-touch Moodle login of an allowlisted Jefe.';
