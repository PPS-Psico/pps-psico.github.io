-- Modificar register_new_student para funcionar SOLO con legajo
-- Ya no requiere coincidencia de DNI para permitir que admins creen estudiantes
-- con solo legajo/nombre y el estudiante depois complete sus datos

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
  student_exists boolean;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'Debes iniciar sesión para vincular tu usuario.';
  end if;

  if caller_id <> userid_input then
    raise exception 'El usuario autenticado no coincide con el usuario a vincular.';
  end if;

  -- Verificar que el estudiante existe por legajo
  select exists(
    select 1 from public.estudiantes where legajo = legajo_input
  ) into student_exists;

  if not student_exists then
    raise exception 'No se encontró un estudiante con ese legajo.';
  end if;

  -- Vincular usuario y actualizar datos basicos
  -- Solo actualiza correo/telefono si se proporcionan y no son vacios
  update public.estudiantes
  set user_id = userid_input,
      estado = case
        when estado is null or estado = '' then 'Nuevo (Sin cuenta)'
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
  where legajo = legajo_input
    and (user_id is null or user_id = userid_input);

  if not found then
    raise exception 'El estudiante ya tiene una cuenta vinculada o el legajo no existe.';
  end if;
end;
$function$;

-- Actualizar grants
revoke execute on function public.register_new_student(text, uuid, bigint, text, text) from public, anon;
grant execute on function public.register_new_student(text, uuid, bigint, text, text) to authenticated, service_role;