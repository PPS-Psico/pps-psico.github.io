-- Rate limit por IP en el circuito de identidad/recuperación.
--
-- Problema: el límite existente cuenta intentos POR LEGAJO (5 cada 30 min). Un
-- atacante que enumera legajos distintos nunca lo dispara: con un legajo por
-- víctima le sobra. Y los insumos del reset (legajo, DNI, correo, teléfono) eran
-- cosechables en masa hasta que se cerró `convocatorias`.
--
-- Se agrega un tope POR IP, que sí frena la enumeración. El umbral es
-- deliberadamente alto (40 en 30 min) porque muchos alumnos pueden compartir la
-- IP de la facultad por NAT: el objetivo es cortar el barrido automatizado sin
-- dejar afuera a nadie legítimo. Si la IP no se puede determinar, NO se aplica
-- el límite (si no, todos caerían en el mismo balde 'unknown' y se bloquearían
-- entre sí).
--
-- Nota: esto es mitigación, no la solución. La solución es que la recuperación
-- deje de verificar con PII estática y pase a un enlace de un solo uso al correo
-- institucional. Eso cambia la experiencia del alumno y queda pendiente de
-- decisión.

create index if not exists idx_verification_attempts_ip_created
  on public.verification_attempts (ip_address, created_at desc);

create or replace function public.identity_ip_rate_limited()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_ip text;
  ip_attempts int;
begin
  caller_ip := split_part(
    coalesce(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'x-real-ip',
      'unknown'
    ),
    ',',
    1
  );
  caller_ip := btrim(caller_ip);

  -- Sin IP identificable no se limita: agrupar todo en 'unknown' bloquearía a
  -- usuarios legítimos entre sí.
  if caller_ip is null or caller_ip = '' or caller_ip = 'unknown' then
    return false;
  end if;

  select count(*) into ip_attempts
  from public.verification_attempts
  where ip_address = caller_ip
    and created_at > now() - interval '30 minutes';

  return ip_attempts >= 40;
end;
$$;

comment on function public.identity_ip_rate_limited() is
  'Tope por IP para el circuito de identidad. Complementa el tope por legajo, que no frena la enumeración de legajos distintos.';

revoke execute on function public.identity_ip_rate_limited() from public, anon, authenticated;

create or replace function public.verify_student_identity(
  legajo_input text,
  dni_input bigint,
  correo_input text,
  telefono_input text DEFAULT null
)
RETURNS table(
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_ip text;
  attempt_count int;
BEGIN
  caller_ip := coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'unknown'
  );

  PERFORM public.cleanup_old_verification_attempts();

  IF public.identity_ip_rate_limited() THEN
    RAISE EXCEPTION 'Demasiados intentos desde esta conexión. Espera 30 minutos antes de intentar nuevamente.';
  END IF;

  SELECT count(*) INTO attempt_count
  FROM public.verification_attempts
  WHERE verification_attempts.legajo_input = verify_student_identity.legajo_input
    AND created_at > now() - interval '30 minutes';

  IF attempt_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Espera 30 minutos antes de intentar nuevamente.';
  END IF;

  BEGIN
    INSERT INTO public.verification_attempts (ip_address, legajo_input)
    VALUES (caller_ip, verify_student_identity.legajo_input);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
  SELECT
    e.id,
    e.nombre,
    e.legajo,
    e.dni,
    e.correo,
    e.telefono,
    e.user_id,
    e.must_change_password,
    e.role
  FROM public.estudiantes e
  WHERE e.legajo = legajo_input
    AND regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') =
        regexp_replace(coalesce(dni_input::text, ''), '\D', '', 'g')
    AND lower(trim(coalesce(e.correo, ''))) = lower(trim(coalesce(correo_input, '')))
    AND (
      nullif(trim(coalesce(telefono_input, '')), '') is null
      OR nullif(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), '') is null
      OR regexp_replace(coalesce(telefono_input, ''), '\D', '', 'g')
         LIKE '%' || right(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), 6)
    );
END;
$function$;

create or replace function public.reset_student_password_verified(
  legajo_input text,
  dni_input bigint,
  correo_input text,
  telefono_input text DEFAULT null,
  new_password text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  target_email text;
  target_user_id uuid;
  attempt_count int;
BEGIN
  IF new_password IS null OR length(trim(new_password)) < 6 THEN
    RAISE EXCEPTION 'La nueva contraseña debe tener al menos 6 caracteres.';
  END IF;

  IF public.identity_ip_rate_limited() THEN
    RAISE EXCEPTION 'Demasiados intentos desde esta conexión. Espera 30 minutos antes de intentar nuevamente.';
  END IF;

  SELECT count(*) INTO attempt_count
  FROM public.verification_attempts
  WHERE verification_attempts.legajo_input = reset_student_password_verified.legajo_input
    AND created_at > now() - interval '30 minutes';

  IF attempt_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Espera 30 minutos antes de intentar nuevamente.';
  END IF;

  BEGIN
    INSERT INTO public.verification_attempts (ip_address, legajo_input)
    VALUES (coalesce(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      'unknown'
    ), reset_student_password_verified.legajo_input);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT e.correo
    INTO target_email
  FROM public.estudiantes e
  WHERE e.legajo = legajo_input
    AND regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') =
        regexp_replace(coalesce(dni_input::text, ''), '\D', '', 'g')
    AND lower(trim(coalesce(e.correo, ''))) = lower(trim(coalesce(correo_input, '')))
    AND (
      nullif(trim(coalesce(telefono_input, '')), '') is null
      OR nullif(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), '') is null
      OR regexp_replace(coalesce(telefono_input, ''), '\D', '', 'g')
         LIKE '%' || right(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), 6)
    )
  LIMIT 1;

  IF target_email IS null THEN
    RAISE EXCEPTION 'Los datos ingresados no coinciden con nuestros registros.';
  END IF;

  SELECT id
    INTO target_user_id
  FROM auth.users
  WHERE email = lower(trim(target_email))
  LIMIT 1;

  IF target_user_id IS null THEN
    RAISE EXCEPTION 'No existe un usuario registrado con el correo %', target_email;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now(),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{provider}',
        '"email"'
      )
  WHERE id = target_user_id;

  UPDATE public.estudiantes
  SET user_id = target_user_id
  WHERE legajo = legajo_input;
END;
$function$;
