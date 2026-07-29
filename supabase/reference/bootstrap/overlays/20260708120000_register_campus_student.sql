-- Alta de estudiantes NUEVOS desde el campus Moodle.
--
-- El flujo viejo exigía que coordinación precargara el legajo en `estudiantes`
-- (register_new_student solo ACTUALIZA filas existentes). Con el onboarding
-- desde Moodle, un estudiante matriculado en la materia puede crear su fila:
-- nombre, apellido, correo y DNI llegan del perfil de Moodle (FilterCodes);
-- legajo y celular los completa en el formulario.
--
-- Seguridad:
--  - Solo usuarios autenticados (recién creados vía signUp) pueden llamarla,
--    y solo para vincular SU propio user_id.
--  - Legajo y DNI únicos: si alguno ya existe, se corta con error claro
--    (esos casos deben ir por register_new_student o por login normal).
--  - Validación de formato para no insertar basura.

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
set search_path to 'public'
as $function$
declare
  caller_id uuid;
  legajo_clean text;
  correo_clean text;
  nombre_clean text;
  apellido_clean text;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'Debes iniciar sesion para crear tu perfil.';
  end if;

  if caller_id <> userid_input then
    raise exception 'El usuario autenticado no coincide con el usuario a vincular.';
  end if;

  legajo_clean := regexp_replace(coalesce(legajo_input, ''), '\D', '', 'g');
  if length(legajo_clean) < 4 or length(legajo_clean) > 8 then
    raise exception 'El legajo debe tener entre 4 y 8 digitos.';
  end if;

  if dni_input is null or dni_input < 100000 or dni_input > 999999999 then
    raise exception 'El DNI no tiene un formato valido.';
  end if;

  correo_clean := lower(trim(coalesce(correo_input, '')));
  if correo_clean !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'El correo no tiene un formato valido.';
  end if;

  nombre_clean := nullif(trim(coalesce(nombre_input, '')), '');
  apellido_clean := nullif(trim(coalesce(apellido_input, '')), '');

  if exists (select 1 from public.estudiantes where trim(legajo) = legajo_clean) then
    raise exception 'El legajo ya existe en el sistema. Usa el flujo de vinculacion.';
  end if;

  if exists (select 1 from public.estudiantes where dni = dni_input) then
    raise exception 'El DNI ya esta registrado con otro legajo. Contacta a coordinacion.';
  end if;

  if exists (select 1 from public.estudiantes where user_id = userid_input) then
    raise exception 'Este usuario ya tiene un perfil de estudiante vinculado.';
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
    legajo_clean,
    userid_input,
    dni_input,
    correo_clean,
    nullif(trim(coalesce(telefono_input, '')), ''),
    coalesce(
      nullif(trim(concat_ws(' ', nombre_clean, apellido_clean)), ''),
      'Estudiante ' || legajo_clean
    ),
    nombre_clean,
    apellido_clean,
    'Activo'
  );
end;
$function$;

revoke execute on function public.register_campus_student(text, uuid, bigint, text, text, text, text) from public, anon;
grant execute on function public.register_campus_student(text, uuid, bigint, text, text, text, text) to authenticated, service_role;
