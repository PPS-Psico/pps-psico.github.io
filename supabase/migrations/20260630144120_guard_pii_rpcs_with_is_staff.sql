-- FASE 2: bloquea que un alumno logueado (rol PG `authenticated`) lea PII de otros
-- alumnos vía las RPCs de listados. Patrón rename+wrapper: la lógica original queda
-- intacta en `<fn>_impl` (sin EXECUTE para anon/authenticated); el wrapper homónimo
-- valida is_staff() y delega. NO se toca get_seleccionados_for_launch (la usan alumnos
-- para "ver convocados").

-- 1) get_ingresantes_list(integer) → json
alter function public.get_ingresantes_list(integer) rename to get_ingresantes_list_impl;
create function public.get_ingresantes_list(p_year integer)
returns json language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return public.get_ingresantes_list_impl(p_year);
end $w$;

-- 2) get_estudiantes_en_pps_list(integer) → json
alter function public.get_estudiantes_en_pps_list(integer) rename to get_estudiantes_en_pps_list_impl;
create function public.get_estudiantes_en_pps_list(p_year integer)
returns json language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return public.get_estudiantes_en_pps_list_impl(p_year);
end $w$;

-- 3) get_heredados_list(integer) → json
alter function public.get_heredados_list(integer) rename to get_heredados_list_impl;
create function public.get_heredados_list(p_year integer)
returns json language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return public.get_heredados_list_impl(p_year);
end $w$;

-- 4) get_activos_list(integer) → json
alter function public.get_activos_list(integer) rename to get_activos_list_impl;
create function public.get_activos_list(p_year integer)
returns json language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return public.get_activos_list_impl(p_year);
end $w$;

-- 5) get_finalizados_list(integer) → TABLE(id,nombre,legajo)
alter function public.get_finalizados_list(integer) rename to get_finalizados_list_impl;
create function public.get_finalizados_list(p_year integer)
returns table(id uuid, nombre text, legajo text) language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select * from public.get_finalizados_list_impl(p_year);
end $w$;

-- 6) get_haciendo_pps_list(integer) → TABLE(id,nombre,legajo)
alter function public.get_haciendo_pps_list(integer) rename to get_haciendo_pps_list_impl;
create function public.get_haciendo_pps_list(p_year integer)
returns table(id uuid, nombre text, legajo text) language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select * from public.get_haciendo_pps_list_impl(p_year);
end $w$;

-- 7) get_proximos_finalizar_list(integer) → TABLE(id,nombre,legajo,horas_total)
alter function public.get_proximos_finalizar_list(integer) rename to get_proximos_finalizar_list_impl;
create function public.get_proximos_finalizar_list(p_year integer)
returns table(id uuid, nombre text, legajo text, horas_total numeric) language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select * from public.get_proximos_finalizar_list_impl(p_year);
end $w$;

-- 8) get_sin_pps_list(integer) → TABLE(id,nombre,legajo,correo)
alter function public.get_sin_pps_list(integer) rename to get_sin_pps_list_impl;
create function public.get_sin_pps_list(p_year integer)
returns table(id uuid, nombre text, legajo text, correo text) language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select * from public.get_sin_pps_list_impl(p_year);
end $w$;

-- 9) get_convenios_list(integer, text) → TABLE(nombre,tipo,fecha_firma,fecha_vencimiento)
alter function public.get_convenios_list(integer, text) rename to get_convenios_list_impl;
create function public.get_convenios_list(p_year integer, p_kind text)
returns table(nombre text, tipo text, fecha_firma date, fecha_vencimiento date) language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select * from public.get_convenios_list_impl(p_year, p_kind);
end $w$;

-- 10) get_postulantes_seleccionados(uuid) → TABLE(nombre,legajo,horario)
alter function public.get_postulantes_seleccionados(uuid) rename to get_postulantes_seleccionados_impl;
create function public.get_postulantes_seleccionados(lanzamiento_uuid uuid)
returns table(nombre text, legajo text, horario text) language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select * from public.get_postulantes_seleccionados_impl(lanzamiento_uuid);
end $w$;

-- 11) get_seleccionados(uuid) → TABLE(nombre,legajo,horario)
alter function public.get_seleccionados(uuid) rename to get_seleccionados_impl;
create function public.get_seleccionados(lanzamiento_id_input uuid)
returns table(nombre text, legajo text, horario text) language plpgsql security definer set search_path to 'public' as $w$
begin
  if not public.is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query select * from public.get_seleccionados_impl(lanzamiento_id_input);
end $w$;

-- Grants: los _impl quedan sin acceso para anon/authenticated (solo owner/service_role).
-- Los wrappers (funciones nuevas) revocan PUBLIC/anon y se otorgan a authenticated.
do $$
declare
  impls text[] := array[
    'public.get_ingresantes_list_impl(integer)',
    'public.get_estudiantes_en_pps_list_impl(integer)',
    'public.get_heredados_list_impl(integer)',
    'public.get_activos_list_impl(integer)',
    'public.get_finalizados_list_impl(integer)',
    'public.get_haciendo_pps_list_impl(integer)',
    'public.get_proximos_finalizar_list_impl(integer)',
    'public.get_sin_pps_list_impl(integer)',
    'public.get_convenios_list_impl(integer, text)',
    'public.get_postulantes_seleccionados_impl(uuid)',
    'public.get_seleccionados_impl(uuid)'
  ];
  wrappers text[] := array[
    'public.get_ingresantes_list(integer)',
    'public.get_estudiantes_en_pps_list(integer)',
    'public.get_heredados_list(integer)',
    'public.get_activos_list(integer)',
    'public.get_finalizados_list(integer)',
    'public.get_haciendo_pps_list(integer)',
    'public.get_proximos_finalizar_list(integer)',
    'public.get_sin_pps_list(integer)',
    'public.get_convenios_list(integer, text)',
    'public.get_postulantes_seleccionados(uuid)',
    'public.get_seleccionados(uuid)'
  ];
  f text;
begin
  foreach f in array impls loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array wrappers loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
