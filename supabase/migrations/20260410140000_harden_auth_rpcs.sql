-- Harden public auth-related RPCs by moving identity checks server-side
-- and tightening EXECUTE grants for privileged functions.

create or replace function public.verify_student_identity(
  legajo_input text,
  dni_input bigint,
  correo_input text,
  telefono_input text default null
)
returns table(
  id uuid,
  nombre text,
  legajo text,
  dni numeric,
  correo text,
  telefono text,
  user_id uuid,
  must_change_password boolean,
  role text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    e.id,
    e.nombre,
    e.legajo,
    e.dni,
    e.correo,
    e.telefono,
    e.user_id,
    e.must_change_password,
    e.role
  from public.estudiantes e
  where e.legajo = legajo_input
    and regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') =
        regexp_replace(coalesce(dni_input::text, ''), '\D', '', 'g')
    and lower(trim(coalesce(e.correo, ''))) = lower(trim(coalesce(correo_input, '')))
    and (
      nullif(trim(coalesce(telefono_input, '')), '') is null
      or nullif(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), '') is null
      or regexp_replace(coalesce(telefono_input, ''), '\D', '', 'g')
         like '%' || right(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), 6)
    );
end;
$function$;

create or replace function public.reset_student_password_verified(
  legajo_input text,
  dni_input bigint,
  correo_input text,
  telefono_input text default null,
  new_password text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  target_email text;
  target_user_id uuid;
begin
  if new_password is null or length(trim(new_password)) < 6 then
    raise exception 'La nueva contraseña debe tener al menos 6 caracteres.';
  end if;

  select e.correo
    into target_email
  from public.estudiantes e
  where e.legajo = legajo_input
    and regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') =
        regexp_replace(coalesce(dni_input::text, ''), '\D', '', 'g')
    and lower(trim(coalesce(e.correo, ''))) = lower(trim(coalesce(correo_input, '')))
    and (
      nullif(trim(coalesce(telefono_input, '')), '') is null
      or nullif(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), '') is null
      or regexp_replace(coalesce(telefono_input, ''), '\D', '', 'g')
         like '%' || right(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), 6)
    )
  limit 1;

  if target_email is null then
    raise exception 'Los datos ingresados no coinciden con nuestros registros.';
  end if;

  select id
    into target_user_id
  from auth.users
  where email = lower(trim(target_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No existe un usuario registrado con el correo %', target_email;
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now(),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{provider}',
        '"email"'
      )
  where id = target_user_id;

  update public.estudiantes
  set user_id = target_user_id
  where legajo = legajo_input;
end;
$function$;

create or replace function public.register_new_student(
  legajo_input text,
  userid_input uuid,
  dni_input bigint,
  correo_input text,
  telefono_input text
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
    raise exception 'Debes iniciar sesión para vincular tu usuario.';
  end if;

  if caller_id <> userid_input then
    raise exception 'El usuario autenticado no coincide con el usuario a vincular.';
  end if;

  update public.estudiantes
  set user_id = userid_input,
      correo = lower(trim(correo_input)),
      telefono = nullif(trim(telefono_input), '')
  where legajo = legajo_input
    and regexp_replace(coalesce(dni::text, ''), '\D', '', 'g') =
        regexp_replace(coalesce(dni_input::text, ''), '\D', '', 'g');

  if not found then
    raise exception 'No se pudo vincular el legajo con los datos provistos.';
  end if;
end;
$function$;

revoke execute on function public.admin_reset_password(text, text) from public, anon, authenticated;
grant execute on function public.admin_reset_password(text, text) to service_role;

revoke execute on function public.get_student_details_by_legajo(text) from public, anon, authenticated;
grant execute on function public.get_student_details_by_legajo(text) to service_role;

revoke execute on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated, service_role;

revoke execute on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated, service_role;

revoke execute on function public.get_student_email_by_legajo(text) from public;
grant execute on function public.get_student_email_by_legajo(text) to anon, authenticated, service_role;

revoke execute on function public.get_student_for_signup(text) from public;
grant execute on function public.get_student_for_signup(text) to anon, authenticated, service_role;

revoke execute on function public.register_new_student(text, uuid, bigint, text, text) from public, anon;
grant execute on function public.register_new_student(text, uuid, bigint, text, text) to authenticated, service_role;

revoke execute on function public.verify_student_identity(text, bigint, text, text) from public;
grant execute on function public.verify_student_identity(text, bigint, text, text) to anon, authenticated, service_role;

revoke execute on function public.reset_student_password_verified(text, bigint, text, text, text) from public;
grant execute on function public.reset_student_password_verified(text, bigint, text, text, text) to anon, authenticated, service_role;
