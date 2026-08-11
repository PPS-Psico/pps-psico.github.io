-- Student accounts may only be linked or created with a short-lived proof
-- issued from the Moodle PPS course (course id 3615).

create table public.moodle_signup_tickets (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  course_id bigint not null check (course_id = 3615),
  moodle_user_id bigint not null check (moodle_user_id > 0),
  moodle_username text not null check (moodle_username ~ '^\d{6,12}$'),
  email text not null check (email = lower(trim(email))),
  firstname text not null,
  lastname text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  auth_user_id uuid references auth.users(id) on delete set null,
  check (expires_at > issued_at)
);

comment on table public.moodle_signup_tickets is
  'Comprobantes de alta de un solo uso emitidos desde el aula Moodle PPS 3615. Nunca almacena el token en claro.';

create index moodle_signup_tickets_expiry_idx
  on public.moodle_signup_tickets (expires_at)
  where used_at is null;

alter table public.moodle_signup_tickets enable row level security;
revoke all on table public.moodle_signup_tickets from public, anon, authenticated;
grant select, insert, update, delete on table public.moodle_signup_tickets to service_role;

create or replace function private.complete_moodle_student_signup(
  token_hash_input text,
  userid_input uuid,
  legajo_input text,
  dni_input bigint,
  telefono_input text
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
  v_email_confirmed_at timestamptz;
  v_legajo text;
  v_phone text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Moodle signup service required';
  end if;

  v_legajo := regexp_replace(coalesce(legajo_input, ''), '\D', '', 'g');
  v_phone := nullif(trim(coalesce(telefono_input, '')), '');

  if token_hash_input !~ '^[0-9a-f]{64}$'
    or userid_input is null
    or length(v_legajo) < 4
    or length(v_legajo) > 8
    or dni_input is null
    or dni_input < 100000
    or dni_input > 999999999
    or v_phone is null
  then
    raise exception 'Invalid Moodle signup data';
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
    or v_ticket.moodle_username::bigint <> dni_input
  then
    raise exception 'Invalid or expired Moodle signup ticket';
  end if;

  select lower(trim(users.email)), users.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users users
  where users.id = userid_input;

  if v_auth_email is null
    or v_email_confirmed_at is null
    or v_auth_email <> v_ticket.email
  then
    raise exception 'Invalid Moodle signup identity';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('student-signup:' || v_legajo, 0)
  );

  if exists (
    select 1
    from public.estudiantes student
    where student.user_id = userid_input
  ) then
    raise exception 'Student account already linked';
  end if;

  select student.*
  into v_student
  from public.estudiantes student
  where trim(student.legajo) = v_legajo
  order by student.created_at desc nulls last
  limit 1
  for update;

  if v_student.id is not null then
    if v_student.user_id is not null
      or v_student.dni is null
      or v_student.dni <> dni_input
      or nullif(lower(trim(coalesce(v_student.correo, ''))), '') is null
      or lower(trim(v_student.correo)) <> v_auth_email
    then
      raise exception 'Student identity does not match academic record';
    end if;

    update public.estudiantes
    set
      user_id = userid_input,
      estado = case when estado is distinct from 'Finalizado' then 'Activo' else estado end,
      correo = v_auth_email,
      telefono = v_phone,
      must_change_password = false,
      nombre = coalesce(
        nullif(trim(nombre), ''),
        trim(concat_ws(' ', v_ticket.firstname, v_ticket.lastname))
      ),
      nombre_separado = coalesce(nullif(trim(nombre_separado), ''), v_ticket.firstname),
      apellido_separado = coalesce(nullif(trim(apellido_separado), ''), v_ticket.lastname)
    where id = v_student.id
      and user_id is null
    returning id into v_student_id;

    if v_student_id is null then
      raise exception 'Student account could not be linked';
    end if;
  else
    if exists (
      select 1
      from public.estudiantes student
      where student.dni = dni_input
        or lower(trim(coalesce(student.correo, ''))) = v_auth_email
    ) then
      raise exception 'Student identity already exists';
    end if;

    insert into public.estudiantes (
      legajo,
      user_id,
      dni,
      correo,
      telefono,
      nombre,
      nombre_separado,
      apellido_separado,
      estado,
      role,
      must_change_password
    ) values (
      v_legajo,
      userid_input,
      dni_input,
      v_auth_email,
      v_phone,
      trim(concat_ws(' ', v_ticket.firstname, v_ticket.lastname)),
      v_ticket.firstname,
      v_ticket.lastname,
      'Activo',
      'Alumno',
      false
    )
    returning id into v_student_id;
  end if;

  update public.moodle_signup_tickets
  set
    used_at = now(),
    auth_user_id = userid_input
  where id = v_ticket.id
    and used_at is null;

  if not found then
    raise exception 'Moodle signup ticket was already consumed';
  end if;

  return v_student_id;
end;
$$;

revoke all on function private.complete_moodle_student_signup(text, uuid, text, bigint, text)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.complete_moodle_student_signup(text, uuid, text, bigint, text)
  to service_role;

create or replace function public.complete_moodle_student_signup(
  token_hash_input text,
  userid_input uuid,
  legajo_input text,
  dni_input bigint,
  telefono_input text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.complete_moodle_student_signup(
    token_hash_input,
    userid_input,
    legajo_input,
    dni_input,
    telefono_input
  );
$$;

comment on function public.complete_moodle_student_signup(text, uuid, text, bigint, text) is
  'Service-role-only wrapper that consumes a Moodle PPS signup ticket and links the Auth user atomically.';

revoke all on function public.complete_moodle_student_signup(text, uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.complete_moodle_student_signup(text, uuid, text, bigint, text)
  to service_role;

-- Close the two legacy browser-callable registration paths. Keeping service
-- role execution avoids breaking administrative recovery tooling.
revoke all on function public.register_new_student(text, uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.register_new_student(text, uuid, bigint, text, text)
  to service_role;

revoke all on function public.register_campus_student(text, uuid, bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_campus_student(text, uuid, bigint, text, text, text, text)
  to service_role;
