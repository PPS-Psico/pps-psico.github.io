-- Cierra la exposición anónima de PII sin romper el frontend ya publicado.
-- La forma tabular se conserva temporalmente, pero todas las columnas
-- personales se devuelven en NULL y ya no se consulta auth.users por correo.
create or replace function public.get_student_signup_status(
  legajo_input text,
  correo_input text default null
)
returns table(
  id uuid,
  nombre text,
  nombre_separado text,
  apellido_separado text,
  legajo text,
  dni numeric,
  correo text,
  telefono text,
  user_id uuid,
  estado text,
  signup_status text,
  status_message text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_status text;
begin
  perform correo_input;

  select e.user_id
  into v_user_id
  from public.estudiantes e
  where trim(e.legajo) = trim(legajo_input)
  order by e.created_at desc nulls last
  limit 1;

  if not found then
    v_status := 'not_found';
  elsif v_user_id is not null then
    v_status := 'linked';
  else
    v_status := 'available';
  end if;

  return query
  select
    null::uuid,
    null::text,
    null::text,
    null::text,
    null::text,
    null::numeric,
    null::text,
    null::text,
    null::uuid,
    null::text,
    v_status,
    'No pudimos completar el alta con los datos ingresados.'::text;
end;
$function$;

comment on function public.get_student_signup_status(text, text) is
  'Preflight de compatibilidad sin PII. Debe retirarse cuando el frontend publicado deje de consumirlo.';

revoke execute on function public.get_student_signup_status(text, text) from public;
grant execute on function public.get_student_signup_status(text, text)
  to anon, authenticated, service_role;

-- Vincula únicamente cuando la cuenta autenticada coincide con la identidad
-- precargada. DNI y correo dejan de ser valores sobrescribibles por el cliente.
create or replace function public.register_new_student(
  legajo_input text,
  userid_input uuid,
  dni_input bigint default null,
  correo_input text default null,
  telefono_input text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_id uuid;
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_legajo text;
  v_input_email text;
  v_student public.estudiantes%rowtype;
begin
  v_caller_id := auth.uid();
  v_legajo := regexp_replace(coalesce(legajo_input, ''), '\D', '', 'g');
  v_input_email := lower(trim(coalesce(correo_input, '')));

  if v_caller_id is null or v_caller_id <> userid_input then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  if length(v_legajo) < 4 or length(v_legajo) > 8
    or dni_input is null or dni_input < 100000 or dni_input > 999999999
    or v_input_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    or nullif(trim(coalesce(telefono_input, '')), '') is null
  then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  select lower(trim(u.email)), u.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users u
  where u.id = v_caller_id;

  if v_auth_email is null
    or v_email_confirmed_at is null
    or v_auth_email <> v_input_email
  then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('student-signup:' || v_legajo, 0)
  );

  select e.*
  into v_student
  from public.estudiantes e
  where trim(e.legajo) = v_legajo
  order by e.created_at desc nulls last
  limit 1
  for update;

  if v_student.id is null
    or (v_student.user_id is not null and v_student.user_id <> v_caller_id)
    or v_student.dni is null
    or v_student.dni <> dni_input
    or nullif(lower(trim(coalesce(v_student.correo, ''))), '') is null
    or lower(trim(v_student.correo)) <> v_auth_email
  then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  update public.estudiantes
  set
    user_id = v_caller_id,
    estado = case when estado is distinct from 'Finalizado' then 'Activo' else estado end,
    correo = v_auth_email,
    telefono = trim(telefono_input)
  where id = v_student.id
    and (user_id is null or user_id = v_caller_id);

  if not found then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;
end;
$function$;

comment on function public.register_new_student(text, uuid, bigint, text, text) is
  'Vincula una fila precargada solo si DNI y correo confirmado de Auth coinciden.';

revoke execute on function public.register_new_student(text, uuid, bigint, text, text)
  from public, anon;
grant execute on function public.register_new_student(text, uuid, bigint, text, text)
  to authenticated, service_role;

-- El onboarding Campus decide INSERT o vinculación dentro de una única
-- transacción. La coincidencia con una fila existente siempre es estricta.
create or replace function public.register_campus_student(
  legajo_input text,
  userid_input uuid,
  dni_input bigint,
  correo_input text,
  telefono_input text default null,
  nombre_input text default null,
  apellido_input text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_id uuid;
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_legajo text;
  v_input_email text;
  v_nombre text;
  v_apellido text;
  v_student public.estudiantes%rowtype;
begin
  v_caller_id := auth.uid();
  v_legajo := regexp_replace(coalesce(legajo_input, ''), '\D', '', 'g');
  v_input_email := lower(trim(coalesce(correo_input, '')));
  v_nombre := nullif(trim(coalesce(nombre_input, '')), '');
  v_apellido := nullif(trim(coalesce(apellido_input, '')), '');

  if v_caller_id is null or v_caller_id <> userid_input then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  if length(v_legajo) < 4 or length(v_legajo) > 8
    or dni_input is null or dni_input < 100000 or dni_input > 999999999
    or v_input_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    or nullif(trim(coalesce(telefono_input, '')), '') is null
  then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  select lower(trim(u.email)), u.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users u
  where u.id = v_caller_id;

  if v_auth_email is null
    or v_email_confirmed_at is null
    or v_auth_email <> v_input_email
  then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('student-signup:' || v_legajo, 0)
  );

  if exists (
    select 1 from public.estudiantes e where e.user_id = v_caller_id
  ) then
    raise exception 'No pudimos validar los datos para completar el alta.';
  end if;

  select e.*
  into v_student
  from public.estudiantes e
  where trim(e.legajo) = v_legajo
  order by e.created_at desc nulls last
  limit 1
  for update;

  if v_student.id is not null then
    if v_student.user_id is not null
      or v_student.dni is null
      or v_student.dni <> dni_input
      or nullif(lower(trim(coalesce(v_student.correo, ''))), '') is null
      or lower(trim(v_student.correo)) <> v_auth_email
    then
      raise exception 'No pudimos validar los datos para completar el alta.';
    end if;

    update public.estudiantes
    set
      user_id = v_caller_id,
      estado = case when estado is distinct from 'Finalizado' then 'Activo' else estado end,
      correo = v_auth_email,
      telefono = trim(telefono_input)
    where id = v_student.id
      and user_id is null;

    if not found then
      raise exception 'No pudimos validar los datos para completar el alta.';
    end if;

    return;
  end if;

  if exists (select 1 from public.estudiantes e where e.dni = dni_input) then
    raise exception 'No pudimos validar los datos para completar el alta.';
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
    estado
  ) values (
    v_legajo,
    v_caller_id,
    dni_input,
    v_auth_email,
    trim(telefono_input),
    coalesce(
      nullif(trim(concat_ws(' ', v_nombre, v_apellido)), ''),
      'Estudiante ' || v_legajo
    ),
    v_nombre,
    v_apellido,
    'Activo'
  );
end;
$function$;
comment on function public.register_campus_student(text, uuid, bigint, text, text, text, text) is
  'Alta Campus atómica: vincula con coincidencia estricta o crea una fila nueva.';

revoke execute on function public.register_campus_student(text, uuid, bigint, text, text, text, text)
  from public, anon;
grant execute on function public.register_campus_student(text, uuid, bigint, text, text, text, text)
  to authenticated, service_role;
