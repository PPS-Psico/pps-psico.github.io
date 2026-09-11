-- Pruebas de las RPC de resolucion de solicitudes de PPS.
--
-- Se corren contra la base real, adentro de una transaccion que termina en
-- ROLLBACK: no dejan nada escrito. Si un assert falla, la transaccion aborta
-- igual, asi que tampoco escribe a medias.
--
--   supabase db query --linked < supabase/tests/resoluciones_pps.sql
--
-- Cubren lo que un mock del cliente no puede demostrar: atomicidad, bloqueo,
-- idempotencia, conflicto entre decisiones distintas y permisos. Los datos
-- salen de solicitudes pendientes reales, asi que si no hay ninguna el script
-- avisa en vez de dar un falso verde.

begin;

do $$
declare
  v_admin uuid;
  v_sol_nueva uuid;
  v_sol_mod uuid;
  v_est uuid;
  v_practicas_antes int;
  v_practicas_despues int;
  v_p1 public.practicas%rowtype;
  v_p2 public.practicas%rowtype;
  v_sol public.solicitudes_modificacion_pps%rowtype;
  v_estado text;
  v_horas numeric;
  v_inst_solicitud uuid;
  v_trazada boolean;
begin
  select user_id into v_admin
  from public.estudiantes
  where role in ('SuperUser','Jefe','Directivo','AdminTester') and user_id is not null
  limit 1;
  assert v_admin is not null, 'no hay ningun usuario admin para actuar';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  assert public.is_admin(), 'la simulacion de admin no funciono';

  select id into v_sol_nueva from public.solicitudes_nueva_pps where estado = 'pendiente' limit 1;
  select id into v_sol_mod from public.solicitudes_modificacion_pps
   where estado = 'pendiente' and tipo_modificacion = 'horas' and practica_id is not null limit 1;
  assert v_sol_nueva is not null, 'no hay solicitudes de alta pendientes para probar';
  assert v_sol_mod is not null, 'no hay solicitudes de horas pendientes para probar';

  -- ── Alta: crea la practica y resuelve la solicitud juntas ────────────────
  select estudiante_id, institucion_id into v_est, v_inst_solicitud
  from public.solicitudes_nueva_pps where id = v_sol_nueva;
  select count(*) into v_practicas_antes from public.practicas where estudiante_id = v_est;

  v_p1 := public.aprobar_solicitud_nueva_pps(v_sol_nueva, 70, 'prueba');

  select count(*) into v_practicas_despues from public.practicas where estudiante_id = v_est;
  assert v_practicas_despues = v_practicas_antes + 1, 'no creo exactamente una practica';
  assert v_p1.horas_realizadas = 70, 'acredito horas distintas a las que decidio coordinacion';
  assert v_p1.institucion_id is not distinct from v_inst_solicitud,
    'la practica no conservo la institucion de la solicitud';

  select estado, resuelta_por is not null and resuelta_at is not null
    into v_estado, v_trazada
  from public.solicitudes_nueva_pps where id = v_sol_nueva;
  assert v_estado = 'aprobada', 'la solicitud no quedo aprobada';
  assert v_trazada, 'no registro quien resolvio ni cuando';

  -- ── Reintento identico: idempotente, no duplica ──────────────────────────
  v_p2 := public.aprobar_solicitud_nueva_pps(v_sol_nueva, 70, 'reintento');
  select count(*) into v_practicas_despues from public.practicas where estudiante_id = v_est;
  assert v_practicas_despues = v_practicas_antes + 1, 'el reintento duplico la practica';
  assert v_p1.id = v_p2.id, 'el reintento devolvio otra practica';

  -- ── Reintento con OTRA decision: conflicto, no exito falso ───────────────
  begin
    perform public.aprobar_solicitud_nueva_pps(v_sol_nueva, 90, 'cambio');
    assert false, 'aprobar con horas distintas devolvio exito en vez de conflicto';
  exception when sqlstate 'P0001' then null;
  end;

  -- ── Rechazar una ya resuelta: no puede dejar la practica huerfana ────────
  begin
    perform public.rechazar_solicitud_nueva_pps(v_sol_nueva, 'motivo');
    assert false, 'rechazo una solicitud que ya estaba aprobada';
  exception when sqlstate 'P0001' then null;
  end;

  -- ── Modificacion: acredita lo que define coordinacion ────────────────────
  v_sol := public.aprobar_solicitud_modificacion_pps(v_sol_mod, 90, 'prueba');
  select horas_realizadas into v_horas
  from public.practicas where id = v_sol.practica_id;
  assert v_horas = 90, 'no aplico las horas decididas a la practica';
  assert v_sol.horas_aprobadas = 90, 'no guardo la decision en horas_aprobadas';
  assert v_sol.resuelta_por is not null, 'no registro quien resolvio';

  begin
    perform public.aprobar_solicitud_modificacion_pps(v_sol_mod, 120, 'cambio');
    assert false, 'modificacion con horas distintas devolvio exito en vez de conflicto';
  exception when sqlstate 'P0001' then null;
  end;

  select horas_realizadas into v_horas from public.practicas where id = v_sol.practica_id;
  assert v_horas = 90, 'el intento en conflicto igual toco la practica';

  raise notice 'OK · alta, modificacion, idempotencia, conflicto y trazabilidad';
end;
$$;


do $$
declare
  v_sol uuid;
  v_baja uuid;
begin
  select id into v_sol from public.solicitudes_nueva_pps where estado = 'pendiente' limit 1;

  -- ── Sin rol de coordinacion no se resuelve nada ──────────────────────────
  perform set_config('request.jwt.claims',
                     '{"sub":"00000000-0000-0000-0000-000000000000"}', true);
  begin
    perform public.aprobar_solicitud_nueva_pps(v_sol, 70, null);
    assert false, 'un usuario sin rol pudo aprobar';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.rechazar_solicitud_nueva_pps(v_sol, 'motivo');
    assert false, 'un usuario sin rol pudo rechazar';
  exception when sqlstate '42501' then null;
  end;

  raise notice 'OK · permisos';
end;
$$;


do $$
declare
  v_admin uuid;
  v_sol uuid;
  v_baja uuid;
begin
  select user_id into v_admin from public.estudiantes
   where role in ('SuperUser','Jefe','Directivo','AdminTester') and user_id is not null limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  select id into v_sol from public.solicitudes_nueva_pps where estado = 'pendiente' limit 1;

  -- ── Horas invalidas ──────────────────────────────────────────────────────
  begin
    perform public.aprobar_solicitud_nueva_pps(v_sol, 0, null);
    assert false, 'acepto acreditar cero horas';
  exception when sqlstate '22023' then null;
  end;

  -- ── Rechazo sin motivo: el estudiante lo lee, no puede ir vacio ──────────
  begin
    perform public.rechazar_solicitud_nueva_pps(v_sol, '   ');
    assert false, 'acepto un rechazo sin motivo';
  exception when sqlstate '22023' then null;
  end;

  -- ── Las bajas no entran por la aprobacion generica ───────────────────────
  select id into v_baja from public.solicitudes_modificacion_pps
   where tipo_modificacion = 'eliminacion' and estado = 'pendiente' limit 1;
  if v_baja is not null then
    begin
      perform public.aprobar_solicitud_modificacion_pps(v_baja, 10, null);
      assert false, 'aprobo una baja por la via generica';
    exception when sqlstate 'P0001' then null;
    end;
  end if;

  raise notice 'OK · validaciones';
end;
$$;

rollback;
