-- Pruebas de las RPC de resolucion de solicitudes de PPS.
--
-- Corren contra la base real dentro de una transaccion que termina en ROLLBACK:
-- no dejan nada escrito. Si un assert falla, la transaccion aborta igual.
--
--   supabase db query --linked < supabase/tests/resoluciones_pps.sql
--
-- Se ejecutan con `set role authenticated` y un JWT simulado, no con el rol de
-- servicio: de otro modo probarian is_admin() pero no los permisos reales que
-- tiene el navegador, que son la otra mitad del control.
--
-- Ningun caso se saltea. Lo que no existe en la base se crea sintetico adentro
-- de la transaccion: una prueba que imprime OK porque no encontro datos es peor
-- que una que no existe.
--
-- Lo que NO demuestran: concurrencia real entre dos sesiones. El bloqueo
-- FOR UPDATE solo se puede observar con dos conexiones simultaneas y esto corre
-- en una sola.

begin;

-- ── Contexto obligatorio ───────────────────────────────────────────────────
create temporary table t_ctx on commit drop as
select
  (select user_id from public.estudiantes
    where role in ('SuperUser','Jefe','Directivo','AdminTester') and user_id is not null
    limit 1) as admin_uid,
  (select id from public.solicitudes_nueva_pps where estado = 'pendiente' limit 1) as sol_nueva,
  (select id from public.solicitudes_modificacion_pps
    where estado = 'pendiente' and tipo_modificacion = 'horas' and practica_id is not null
    limit 1) as sol_mod,
  e.user_id as alumno_uid,
  e.id as alumno_id,
  p.id as alumno_practica,
  (select id from public.instituciones limit 1) as institucion
from public.estudiantes e
join public.practicas p on p.estudiante_id = e.id
where e.user_id is not null
  and coalesce(e.role, '') not in ('SuperUser','Jefe','Directivo','AdminTester')
limit 1;

do $$
declare v record;
begin
  select * into v from t_ctx;
  assert v.admin_uid is not null, 'no hay usuario admin para actuar';
  assert v.sol_nueva is not null, 'no hay solicitudes de alta pendientes';
  assert v.sol_mod is not null, 'no hay solicitudes de horas pendientes';
  assert v.alumno_uid is not null, 'no hay un estudiante con practicas y sin rol admin';
  assert v.institucion is not null, 'no hay instituciones en el catalogo';
end;
$$;

-- Baja sintetica: no depende de que haya uno en el backlog.
create temporary table t_baja (id uuid) on commit drop;

with creada as (
  insert into public.solicitudes_modificacion_pps
    (estudiante_id, practica_id, tipo_modificacion, estado, motivo_baja, motivo_baja_detalle)
  select alumno_id, alumno_practica, 'eliminacion', 'pendiente', 'otro',
         'baja sintetica creada por la prueba'
  from t_ctx
  returning id
)
insert into t_baja select id from creada;

grant select on t_ctx, t_baja to authenticated;

-- ── Atomicidad ante una falla en el medio de la operacion ──────────────────
-- Se rompe el UPDATE de la solicitud, que es el paso que antes podia fallar
-- dejando la practica ya creada.
create function pg_temp.romper_resolucion() returns trigger
language plpgsql as $t$ begin raise exception 'falla inyectada'; end; $t$;

create trigger t_romper before update on public.solicitudes_nueva_pps
for each row execute function pg_temp.romper_resolucion();

do $$
declare v record; v_est uuid; v_antes int; v_despues int; v_fallo boolean := false;
begin
  select * into v from t_ctx;
  perform set_config('request.jwt.claims', json_build_object('sub', v.admin_uid)::text, true);

  select estudiante_id into v_est from public.solicitudes_nueva_pps where id = v.sol_nueva;
  select count(*) into v_antes from public.practicas where estudiante_id = v_est;

  begin
    perform public.aprobar_solicitud_nueva_pps(v.sol_nueva, 70, 'prueba');
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

-- ── De aca en adelante, como el navegador ──────────────────────────────────
do $$
declare v record;
begin
  select * into v from t_ctx;
  perform set_config('request.jwt.claims', json_build_object('sub', v.admin_uid)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

do $$
declare
  v record; v_est uuid; v_inst uuid; v_antes int; v_despues int;
  v_p1 public.practicas%rowtype; v_p2 public.practicas%rowtype;
  v_sol public.solicitudes_modificacion_pps%rowtype;
  v_estado text; v_horas numeric; v_trazada boolean; v_bloqueado boolean := false;
begin
  select * into v from t_ctx;
  assert current_user = 'authenticated', 'no corre como authenticated: ' || current_user;
  assert public.is_admin(), 'el admin simulado no pasa is_admin()';

  -- 1. Coordinacion aprueba por RPC.
  select estudiante_id, institucion_id into v_est, v_inst
  from public.solicitudes_nueva_pps where id = v.sol_nueva;
  select count(*) into v_antes from public.practicas where estudiante_id = v_est;

  v_p1 := public.aprobar_solicitud_nueva_pps(v.sol_nueva, 70, 'prueba');

  select count(*) into v_despues from public.practicas where estudiante_id = v_est;
  assert v_despues = v_antes + 1, 'no creo exactamente una practica';
  assert v_p1.horas_realizadas = 70, 'acredito horas distintas a las decididas';
  assert v_p1.institucion_id is not distinct from v_inst, 'no conservo la institucion';

  select estado, resuelta_por is not null and resuelta_at is not null
    into v_estado, v_trazada
  from public.solicitudes_nueva_pps where id = v.sol_nueva;
  assert v_estado = 'aprobada', 'la solicitud no quedo aprobada';
  assert v_trazada, 'no registro quien resolvio ni cuando';

  -- 2. Un UPDATE directo no puede falsificar la resolucion.
  begin
    update public.solicitudes_nueva_pps set estado = 'rechazada' where id = v.sol_nueva;
  exception when insufficient_privilege then v_bloqueado := true;
  end;
  assert v_bloqueado, 'un UPDATE directo pudo pisar la resolucion';
  select estado into v_estado from public.solicitudes_nueva_pps where id = v.sol_nueva;
  assert v_estado = 'aprobada', 'el UPDATE directo alcanzo a cambiar el estado';

  -- 3. Idempotencia y conflicto.
  v_p2 := public.aprobar_solicitud_nueva_pps(v.sol_nueva, 70, 'reintento');
  select count(*) into v_despues from public.practicas where estudiante_id = v_est;
  assert v_despues = v_antes + 1, 'el reintento duplico la practica';
  assert v_p1.id = v_p2.id, 'el reintento devolvio otra practica';

  begin
    perform public.aprobar_solicitud_nueva_pps(v.sol_nueva, 90, 'cambio');
    assert false, 'aprobar con otra decision devolvio exito en vez de conflicto';
  exception when sqlstate 'P0001' then null;
  end;

  -- 4. No se puede rechazar una ya resuelta.
  begin
    perform public.rechazar_solicitud_nueva_pps(v.sol_nueva, 'motivo');
    assert false, 'rechazo una solicitud ya aprobada';
  exception when sqlstate 'P0001' then null;
  end;

  -- 5. Modificacion: acredita lo que define coordinacion.
  v_sol := public.aprobar_solicitud_modificacion_pps(v.sol_mod, 90, 'prueba');
  select horas_realizadas into v_horas from public.practicas where id = v_sol.practica_id;
  assert v_horas = 90, 'no aplico las horas decididas';
  assert v_sol.horas_aprobadas = 90, 'no guardo la decision';
  assert v_sol.resuelta_por is not null, 'no registro quien resolvio';

  raise notice 'OK · coordinacion resuelve por RPC y el UPDATE directo queda bloqueado';
end;
$$;

-- ── Validaciones y bajas (sobre la baja sintetica: no puede saltearse) ──────
do $$
declare v record; v_baja uuid; v_res record; v_estado text;
begin
  select * into v from t_ctx;
  select id into v_baja from t_baja;
  assert v_baja is not null, 'no se creo la baja sintetica';

  begin
    perform public.rechazar_solicitud_nueva_pps(v.sol_nueva, '   ');
    assert false, 'acepto un rechazo sin motivo';
  exception when sqlstate '22023' then null;
       when sqlstate 'P0001' then null;
  end;

  -- Una baja no entra por la aprobacion generica.
  begin
    perform public.aprobar_solicitud_modificacion_pps(v_baja, 10, null);
    assert false, 'aprobo una baja por la via generica';
  exception when sqlstate 'P0001' then null;
  end;

  -- Pero si por la suya.
  select * into v_res from public.resolver_solicitud_baja_pps_v1(
    v_baja, 'rechazar', null, null, 'prueba de baja');
  assert v_res.estado = 'rechazada', 'la baja no se pudo resolver por su RPC';

  select estado into v_estado from public.solicitudes_modificacion_pps where id = v_baja;
  assert v_estado = 'rechazada', 'la baja no quedo resuelta en la tabla';

  raise notice 'OK · validaciones y bajas';
end;
$$;

-- ── El estudiante: presenta, pero no resuelve ni falsifica ─────────────────
do $$
declare v record; v_nueva uuid; v_bloqueado boolean;
begin
  select * into v from t_ctx;
  perform set_config('request.jwt.claims', json_build_object('sub', v.alumno_uid)::text, true);
  assert not public.is_admin(), 'el alumno de prueba tiene rol admin';

  -- Sigue presentando solicitudes.
  v_nueva := public.create_my_solicitud_modificacion_v1(v.alumno_practica, 'horas', 42, null);
  assert v_nueva is not null, 'el estudiante no pudo presentar una modificacion';

  -- No puede insertar una resolucion ya hecha.
  v_bloqueado := false;
  begin
    insert into public.solicitudes_nueva_pps
      (estudiante_id, institucion_id, orientacion, fecha_inicio, fecha_finalizacion,
       horas_estimadas, es_online, informe_final_url, planilla_asistencia_url,
       estado, horas_aprobadas, resuelta_at, resuelta_por)
    values (v.alumno_id, v.institucion, 'Clinica', '2026-01-01', '2026-02-01',
            10, false, 'http://x', 'http://x', 'aprobada', 500, now(), v.alumno_uid);
  exception when sqlstate '42501' then v_bloqueado := true;
  end;
  assert v_bloqueado, 'el estudiante pudo insertar una solicitud ya aprobada';

  -- Ni precargar los campos de resolucion en una pendiente.
  v_bloqueado := false;
  begin
    insert into public.solicitudes_nueva_pps
      (estudiante_id, institucion_id, orientacion, fecha_inicio, fecha_finalizacion,
       horas_estimadas, es_online, informe_final_url, planilla_asistencia_url,
       estado, horas_aprobadas)
    values (v.alumno_id, v.institucion, 'Clinica', '2026-01-01', '2026-02-01',
            10, false, 'http://x', 'http://x', 'pendiente', 500);
  exception when sqlstate '42501' then v_bloqueado := true;
  end;
  assert v_bloqueado, 'el estudiante pudo precargar horas_aprobadas';

  -- Ni resolver.
  begin
    perform public.aprobar_solicitud_nueva_pps(v.sol_nueva, 70, null);
    assert false, 'un estudiante pudo aprobar';
  exception when sqlstate '42501' then null;
  end;

  raise notice 'OK · el estudiante presenta, pero no resuelve ni falsifica';
end;
$$;

reset role;
rollback;
