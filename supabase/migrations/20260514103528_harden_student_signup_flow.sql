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
set search_path to 'public', 'auth'
as $function$
declare
  student_row public.estudiantes%rowtype;
  requested_email text;
  email_to_check text;
  email_user_id uuid;
begin
  requested_email := nullif(lower(trim(coalesce(correo_input, ''))), '');

  select *
    into student_row
  from public.estudiantes e
  where trim(e.legajo) = trim(legajo_input)
  order by e.created_at desc nulls last
  limit 1;

  if student_row.id is null then
    return query
    select
      null::uuid,
      null::text,
      null::text,
      null::text,
      trim(legajo_input)::text,
      null::numeric,
      null::text,
      null::text,
      null::uuid,
      null::text,
      'not_found'::text,
      'El legajo no figura como estudiante habilitado.'::text;
    return;
  end if;

  if student_row.user_id is not null then
    return query
    select
      student_row.id,
      student_row.nombre,
      student_row.nombre_separado,
      student_row.apellido_separado,
      student_row.legajo,
      student_row.dni,
      student_row.correo,
      student_row.telefono,
      student_row.user_id,
      student_row.estado,
      'linked'::text,
      'Este legajo ya tiene una cuenta vinculada.'::text;
    return;
  end if;

  email_to_check := requested_email;

  if email_to_check is not null then
    select u.id
      into email_user_id
    from auth.users u
    where lower(trim(u.email)) = email_to_check
    limit 1;
  end if;

  if email_user_id is not null then
    return query
    select
      student_row.id,
      student_row.nombre,
      student_row.nombre_separado,
      student_row.apellido_separado,
      student_row.legajo,
      student_row.dni,
      student_row.correo,
      student_row.telefono,
      student_row.user_id,
      student_row.estado,
      'email_in_use'::text,
      'El correo indicado ya tiene una cuenta creada.'::text;
    return;
  end if;

  return query
  select
    student_row.id,
    student_row.nombre,
    student_row.nombre_separado,
    student_row.apellido_separado,
    student_row.legajo,
    student_row.dni,
    student_row.correo,
    student_row.telefono,
    student_row.user_id,
    student_row.estado,
    'available'::text,
    'El legajo esta habilitado para crear cuenta.'::text;
end;
$function$;

drop function if exists public.get_student_for_signup(text);

create or replace function public.get_student_for_signup(legajo_input text)
returns table(
  id uuid,
  nombre text,
  nombre_separado text,
  apellido_separado text,
  legajo text,
  dni numeric,
  correo text,
  telefono text,
  user_id uuid
)
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  return query
  select
    s.id,
    s.nombre,
    s.nombre_separado,
    s.apellido_separado,
    s.legajo,
    s.dni,
    s.correo,
    s.telefono,
    s.user_id
  from public.get_student_signup_status(legajo_input, null) s
  where s.signup_status = 'available';
end;
$function$;

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
set search_path to 'public'
as $function$
declare
  caller_id uuid;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'Debes iniciar sesion para vincular tu usuario.';
  end if;

  if caller_id <> userid_input then
    raise exception 'El usuario autenticado no coincide con el usuario a vincular.';
  end if;

  if not exists (select 1 from public.estudiantes where trim(legajo) = trim(legajo_input)) then
    raise exception 'No se encontro un estudiante con ese legajo.';
  end if;

  update public.estudiantes
  set user_id = userid_input,
      estado = case
        when estado is distinct from 'Finalizado' then 'Activo'
        else estado
      end,
      correo = case
        when correo_input is not null and trim(correo_input) <> '' then lower(trim(correo_input))
        else correo
      end,
      telefono = case
        when telefono_input is not null and trim(telefono_input) <> '' then nullif(trim(telefono_input), '')
        else telefono
      end,
      dni = case
        when dni_input is not null and dni_input > 0 then dni_input
        else dni
      end
  where trim(legajo) = trim(legajo_input)
    and (user_id is null or user_id = userid_input);

  if not found then
    raise exception 'El estudiante ya tiene una cuenta vinculada o el legajo no existe.';
  end if;
end;
$function$;

revoke execute on function public.get_student_signup_status(text, text) from public;
grant execute on function public.get_student_signup_status(text, text) to anon, authenticated, service_role;

revoke execute on function public.get_student_for_signup(text) from public;
grant execute on function public.get_student_for_signup(text) to anon, authenticated, service_role;

revoke execute on function public.register_new_student(text, uuid, bigint, text, text) from public, anon;
grant execute on function public.register_new_student(text, uuid, bigint, text, text) to authenticated, service_role;
