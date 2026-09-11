-- Aprobar una baja fallaba con 42702: column reference "estado" is ambiguous.
--
-- resolver_solicitud_baja_pps_v1 declara `returns table(estado text, ...)`, asi
-- que `estado` es tambien una variable de la funcion. El DELETE que saca la
-- practica activa la referencia sin calificar:
--
--     delete from public.practicas
--      where id = v_solicitud.practica_id
--        and estudiante_id = v_solicitud.estudiante_id
--        and estado = 'En curso';        -- <- ambigua
--
-- Con plpgsql.variable_conflict en su valor por defecto (error), eso revienta en
-- tiempo de ejecucion. Las otras referencias del cuerpo si estan calificadas
-- (`p.estado`), por eso el rechazo funcionaba y solo fallaba la aprobacion.
--
-- Alcance: el circuito de bajas nunca se uso en produccion —cero solicitudes de
-- eliminacion en cualquier estado— asi que el error nunca llego a un estudiante.
-- Era un bug latente en el unico camino que ninguna prueba tocaba: el arnes de
-- concurrencia lo encontro al competir aprobando, y las pruebas SQL anteriores
-- usaban 'rechazar' justamente para no disparar efectos.
--
-- Se parchea con pg_get_functiondef + replace, el patron del repo, para no
-- retipear el cuerpo entero. Si el texto esperado no aparece, falla.

do $$
declare
  v_def text;
  v_parcheada text;
begin
  select pg_get_functiondef(
    'public.resolver_solicitud_baja_pps_v1(uuid, text, text, text, text)'::regprocedure
  ) into v_def;

  v_parcheada := replace(
    v_def,
    E'delete from public.practicas\n    where id = v_solicitud.practica_id\n      and estudiante_id = v_solicitud.estudiante_id\n      and estado = ''En curso'';',
    E'delete from public.practicas as p\n    where p.id = v_solicitud.practica_id\n      and p.estudiante_id = v_solicitud.estudiante_id\n      and p.estado = ''En curso'';'
  );

  if v_parcheada = v_def then
    raise exception 'No se pudo calificar la columna estado del DELETE: el cuerpo cambio.';
  end if;

  execute v_parcheada;
end;
$$;

-- Verificacion: que no quede ninguna referencia sin calificar en el cuerpo.
do $$
declare v_src text;
begin
  select prosrc into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'resolver_solicitud_baja_pps_v1';

  if v_src ~* '\mand estado\M' then
    raise exception 'Quedo una referencia a estado sin calificar en la RPC de bajas.';
  end if;
end;
$$;
