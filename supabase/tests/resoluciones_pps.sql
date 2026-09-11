-- Pruebas de las RPC de resolucion de solicitudes de PPS.
--
-- Corren contra la base real dentro de una transaccion que termina en ROLLBACK:
-- no dejan nada escrito. Si un assert falla, la transaccion aborta igual.
--
--   supabase db query --linked < supabase/tests/resoluciones_pps.sql
--
-- Se ejecutan con `set role authenticated` y un JWT simulado, no con el rol de
-- servicio: de otro modo probarian is_admin() pero no los permisos reales que
-- tiene el navegador, que son la mitad del control.
--
-- Lo que NO demuestran: concurrencia real entre dos sesiones. El bloqueo
-- FOR UPDATE solo se puede observar con dos conexiones simultaneas y esto corre
-- en una sola. La atomicidad si se prueba, inyectando una falla en el medio.

begin;

-- ── Contexto: ids reales y una baja sintetica para no depender del backlog ──
create temporary table t_ctx on commit drop as
select
  (select user_id from public.estudiantes
    where role in ('SuperUser','Jefe','Directivo','AdminTester') and user_id is not null
    limit 1) as admin_uid,
  (select id from public.solicitudes_nueva_pps where estado = 'pendiente' limit 1) as sol_nueva,
  (select id from public.solicitudes_modificacion_pps
    where estado = 'pendiente' and tipo_modificacion = 'horas' and practica_id is not null
    limit 1) as sol_mod,
  (select e.user_id from public.estudiantes e
    where e.user_id is not null and coalesce(e.role, '') not in
      ('SuperUser','Jefe','Directivo','AdminTester') limit 1) as alumno_uid;

-- La tabla temporal la crea el rol de la sesion; mas abajo se lee como authenticated.
grant select on t_ctx to authenticated;

do $$
declare v_ctx record;
begin
  select * into v_ctx from t_ctx;
  assert v_ctx.admin_uid is not null, 'no hay usuario admin para actuar';
  assert v_ctx.sol_nueva is not null, 'no hay solicitudes de alta pendientes';
  assert v_ctx.sol_mod is not null, 'no hay solicitudes de horas pendientes';
  assert v_ctx.alumno_uid is not null, 'no hay un estudiante sin rol admin';
end;
$$;

-- ── Atomicidad: si falla una escritura del medio, no queda nada a medias ────
-- Se inyecta una falla en el UPDATE de la solicitud, que es el paso que antes
-- podia fallar dejando la practica ya creada.
create function pg_temp.romper_resolucion() returns trigger
language plpgsql as $$ begin raise exception 'falla inyectada'; end; $$;

create trigger t_romper before update on public.solicitudes_nueva_pps
for each row execute function pg_temp.romper_resolucion();

do $$
declare
  v_ctx record; v_est uuid; v_antes int; v_despues int; v_fallo boolean := false;
begin
  select * into v_ctx from t_ctx;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_ctx.admin_uid)::text, true);

  select estudiante_id into v_est from public.solicitudes_nueva_pps where id = v_ctx.sol_nueva;
  select count(*) into v_antes from public.practicas where estudiante_id = v_est;

  begin
    perform public.aprobar_solicitud_nueva_pps(v_ctx.sol_nueva, 70, 'prueba');
  exception when others then v_fallo := true;
  end;

  select count(*) into v_despues from public.practicas where estudiante_id = v_est;
  assert v_fallo, 'la falla inyectada no se propago';
  assert v_despues = v_antes,
    'quedo una practica creada aunque la resolucion fallo: la operacion no es atomica';

  raise notice 'OK · atomicidad ante una falla intermedia';
end;
$$;

drop trigger t_romper on public.solicitudes_nueva_pps;

-- ── A partir de aca, como el navegador: rol authenticated ──────────────────
do $$
declare v_ctx record;
begin
  select * into v_ctx from t_ctx;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_ctx.admin_uid)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

do $$
declare
  v_ctx record; v_est uuid; v_inst uuid; v_antes int; v_despues int;
  v_p1 public.practicas%rowtype; v_p2 public.practicas%rowtype;
  v_sol public.solicitudes_modificacion_pps%rowtype;
  v_estado text; v_horas numeric; v_trazada boolean; v_bloqueado boolean := false;
begin
  select * into v_ctx from t_ctx;
  assert current_user = 'authenticated', 'no esta corriendo como authenticated';
  assert public.is_admin(), 'el admin simulado no pasa is_admin()';

  -- 1. El admin puede aprobar por RPC.
  select estudiante_id, institucion_id into v_est, v_inst
  from public.solicitudes_nueva_pps where id = v_ctx.sol_nueva;
  select count(*) into v_antes from public.practicas where estudiante_id = v_est;

  v_p1 := public.aprobar_solicitud_nueva_pps(v_ctx.sol_nueva, 70, 'prueba');

  select count(*) into v_despues from public.practicas where estudiante_id = v_est;
  assert v_despues = v_antes + 1, 'no creo exactamente una practica';
  assert v_p1.horas_realizadas = 70, 'acredito horas distintas a las decididas';
  assert v_p1.institucion_id is not distinct from v_inst, 'no conservo la institucion';

  select estado, resuelta_por is not null and resuelta_at is not null
    into v_estado, v_trazada
  from public.solicitudes_nueva_pps where id = v_ctx.sol_nueva;
  assert v_estado = 'aprobada', 'la solicitud no quedo aprobada';
  assert v_trazada, 'no registro quien resolvio ni cuando';

  -- 2. Un UPDATE directo no puede falsificar la resolucion.
  begin
    update public.solicitudes_nueva_pps set estado = 'rechazada' where id = v_ctx.sol_nueva;
  exception when insufficient_privilege then v_bloqueado := true;
  end;
  assert v_bloqueado, 'un UPDATE directo pudo pisar la resolucion';

  select estado into v_estado from public.solicitudes_nueva_pps where id = v_ctx.sol_nueva;
  assert v_estado = 'aprobada', 'el UPDATE directo alcanzo a cambiar el estado';

  -- 3. Idempotencia y conflicto.
  v_p2 := public.aprobar_solicitud_nueva_pps(v_ctx.sol_nueva, 70, 'reintento');
  select count(*) into v_despues from public.practicas where estudiante_id = v_est;
  assert v_despues = v_antes + 1, 'el reintento duplico la practica';
  assert v_p1.id = v_p2.id, 'el reintento devolvio otra practica';

  begin
    perform public.aprobar_solicitud_nueva_pps(v_ctx.sol_nueva, 90, 'cambio');
    assert false, 'aprobar con otra decision devolvio exito en vez de conflicto';
  exception when sqlstate 'P0001' then null;
  end;

  -- 4. El admin puede rechazar por RPC, pero no una ya resuelta.
  begin
    perform public.rechazar_solicitud_nueva_pps(v_ctx.sol_nueva, 'motivo');
    assert false, 'rechazo una solicitud ya aprobada';
  exception when sqlstate 'P0001' then null;
  end;

  -- 5. Modificacion: acredita lo que define coordinacion.
  v_sol := public.aprobar_solicitud_modificacion_pps(v_ctx.sol_mod, 90, 'prueba');
  select horas_realizadas into v_horas from public.practicas where id = v_sol.practica_id;
  assert v_horas = 90, 'no aplico las horas decididas';
  assert v_sol.horas_aprobadas = 90, 'no guardo la decision';
  assert v_sol.resuelta_por is not null, 'no registro quien resolvio';

  raise notice 'OK · admin resuelve por RPC, el UPDATE directo queda bloqueado';
end;
$$;

-- ── Validaciones y bajas, todavia como authenticated ────────────────────────
do $$
declare
  v_ctx record; v_baja uuid; v_practica uuid; v_alumno uuid; v_res record;
begin
  select * into v_ctx from t_ctx;

  begin
    perform public.aprobar_solicitud_nueva_pps(v_ctx.sol_nueva, 0, null);
    assert false, 'acepto acreditar cero horas';
  exception when sqlstate '22023' then null;
       when sqlstate 'P0001' then null;
  end;

  -- El motivo del rechazo lo lee el estudiante: no puede ir vacio.
  select id into v_baja from public.solicitudes_nueva_pps where estado = 'pendiente'
   and id <> v_ctx.sol_nueva limit 1;
  if v_baja is not null then
    begin
      perform public.rechazar_solicitud_nueva_pps(v_baja, '   ');
      assert false, 'acepto un rechazo sin motivo';
    exception when sqlstate '22023' then null;
    end;
  end if;

  -- Las bajas siguen funcionando por su propia RPC.
  select s.id into v_baja from public.solicitudes_modificacion_pps s
   where s.tipo_modificacion = 'eliminacion' and s.estado = 'pendiente' limit 1;
  if v_baja is not null then
    select * into v_res from public.resolver_solicitud_baja_pps_v1(
      v_baja, 'rechazar', null, null, 'prueba de baja');
    assert v_res.estado = 'rechazada', 'la baja no se pudo resolver';
    raise notice 'OK · bajas (con una solicitud real)';
  else
    raise notice 'OK · validaciones (no habia bajas pendientes para probar)';
  end if;

  -- Una baja no entra por la aprobacion generica.
  select id into v_baja from public.solicitudes_modificacion_pps
   where tipo_modificacion = 'eliminacion' limit 1;
  if v_baja is not null then
    begin
      perform public.aprobar_solicitud_modificacion_pps(v_baja, 10, null);
      assert false, 'aprobo una baja por la via generica';
    exception when sqlstate 'P0001' then null;
    end;
  end if;

  raise notice 'OK · validaciones y bajas';
end;
$$;

-- ── El estudiante sigue pudiendo presentar solicitudes ──────────────────────
do $$
declare
  v_ctx record; v_practica uuid; v_nueva uuid; v_est uuid;
begin
  select * into v_ctx from t_ctx;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_ctx.alumno_uid)::text, true);
  assert not public.is_admin(), 'el alumno de prueba tiene rol admin';

  select id into v_est from public.estudiantes where user_id = v_ctx.alumno_uid;
  select id into v_practica from public.practicas where estudiante_id = v_est limit 1;

  if v_practica is not null then
    v_nueva := public.create_my_solicitud_modificacion_v1(v_practica, 'horas', 42, null);
    assert v_nueva is not null, 'el estudiante no pudo presentar una modificacion';
    raise notice 'OK · el estudiante sigue presentando solicitudes';
  else
    raise notice 'OK · (el alumno de prueba no tiene practicas para pedir cambios)';
  end if;

  -- Y no puede resolver nada.
  begin
    perform public.aprobar_solicitud_nueva_pps(v_ctx.sol_nueva, 70, null);
    assert false, 'un estudiante pudo aprobar';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
rollback;
