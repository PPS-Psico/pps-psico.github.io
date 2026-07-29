
CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  legajo_input text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.verification_attempts FROM anon, authenticated, public;
GRANT ALL ON TABLE public.verification_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_old_verification_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.verification_attempts WHERE created_at < now() - interval '30 minutes';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_verification_attempts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_verification_attempts() TO service_role;

CREATE OR REPLACE FUNCTION public.verify_student_identity(
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

REVOKE EXECUTE ON FUNCTION public.verify_student_identity(text, bigint, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_student_identity(text, bigint, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reset_student_password_verified(
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

REVOKE EXECUTE ON FUNCTION public.reset_student_password_verified(text, bigint, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reset_student_password_verified(text, bigint, text, text, text) TO anon, authenticated, service_role;
