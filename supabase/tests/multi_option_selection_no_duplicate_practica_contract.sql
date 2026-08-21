-- Regresión del incidente 2026-08-19: seleccionar un alumno en un lanzamiento
-- con opciones/franjas (multi-orientación) creaba DOS prácticas para la misma
-- selección — una fantasma insertada por el trigger legacy
-- handle_seleccion_alumno() (disparado por el UPDATE de estado_inscripcion
-- que hace la propia RPC) y la real insertada por
-- seleccionar_convocatoria_opcion_horario(). Ver
-- 20260819235500_fix_handle_seleccion_alumno_multi_option_duplicate.sql.
--
-- Contrato no destructivo: crea fixtures aislados, simula coordinación
-- autenticada, ejecuta la selección real vía RPC y revierte todo.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

select set_config('pps_test.student_id', gen_random_uuid()::text, true);
select set_config('pps_test.launch_id', gen_random_uuid()::text, true);
select set_config('pps_test.opcion_id', gen_random_uuid()::text, true);
select set_config('pps_test.horario_id', gen_random_uuid()::text, true);
select set_config('pps_test.convocatoria_id', gen_random_uuid()::text, true);
select set_config(
  'request.jwt.claim.sub',
  (
    select e.user_id::text
    from public.estudiantes as e
    where e.user_id is not null
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
    order by e.role, e.id
    limit 1
  ),
  true
);

do $$
begin
  if nullif(current_setting('request.jwt.claim.sub', true), '') is null then
    raise exception 'La prueba requiere al menos un usuario staff con user_id';
  end if;
end;
$$;

insert into public.estudiantes (id, legajo, nombre, role, estado)
values (
  current_setting('pps_test.student_id')::uuid,
  'TEST-NO-DUP-PRACTICA',
  '[TEST] Sin práctica duplicada',
  'Alumno',
  'Activo'
);

-- Lanzamiento multi-orientación con finalización por horas: exactamente el
-- escenario que reveló el bug (la fila fantasma nacía con horas_realizadas
-- = horas_acreditadas y el trigger de cierre automático la marcaba
-- 'Finalizada' al instante, así que la RPC no la encontraba 'en curso' y
-- creaba una segunda fila).
insert into public.lanzamientos_pps (
  id, nombre_pps, orientacion, fecha_inicio, fecha_finalizacion,
  estado_convocatoria, tipo_actividad, modalidad_cupo,
  finalizacion_por_horas, horas_acreditadas
)
values (
  current_setting('pps_test.launch_id')::uuid,
  '[TEST] Institución multi-opción',
  'Laboral, Educacional', '2099-01-01', null,
  'Abierta', 'pps', 'fijo',
  true, 70
);

insert into public.lanzamiento_opciones (
  id, lanzamiento_id, nombre, orientacion, cupos, activa
)
values (
  current_setting('pps_test.opcion_id')::uuid,
  current_setting('pps_test.launch_id')::uuid,
  '[TEST] Área Laboral',
  'Laboral',
  5,
  true
);

insert into public.lanzamiento_opcion_horarios (
  id, opcion_id, horario, cupos, activa
)
values (
  current_setting('pps_test.horario_id')::uuid,
  current_setting('pps_test.opcion_id')::uuid,
  'Viernes 08:00 a 15:00',
  5,
  true
);

set local role authenticated;

insert into public.convocatorias (id, estudiante_id, lanzamiento_id, estado_inscripcion)
values (
  current_setting('pps_test.convocatoria_id')::uuid,
  current_setting('pps_test.student_id')::uuid,
  current_setting('pps_test.launch_id')::uuid,
  'Inscripto'
);

select public.seleccionar_convocatoria_opcion_horario(
  current_setting('pps_test.convocatoria_id')::uuid,
  current_setting('pps_test.horario_id')::uuid,
  true
);

do $$
declare
  v_count integer;
  v_practica record;
begin
  select count(*) into v_count
  from public.practicas
  where estudiante_id = current_setting('pps_test.student_id')::uuid
    and lanzamiento_id = current_setting('pps_test.launch_id')::uuid;

  if v_count <> 1 then
    raise exception 'La selección creó % prácticas; se esperaba exactamente 1', v_count;
  end if;

  select * into v_practica
  from public.practicas
  where estudiante_id = current_setting('pps_test.student_id')::uuid
    and lanzamiento_id = current_setting('pps_test.launch_id')::uuid;

  if v_practica.opcion_id is distinct from current_setting('pps_test.opcion_id')::uuid then
    raise exception 'La práctica no quedó vinculada a la opción seleccionada';
  end if;

  if v_practica.especialidad <> 'Laboral' then
    raise exception 'La especialidad quedó "%"; se esperaba la orientación única de la opción ("Laboral"), no el string combinado del lanzamiento', v_practica.especialidad;
  end if;

  if v_practica.estado <> 'En curso' then
    raise exception 'El estado quedó "%"; se esperaba "En curso" recién seleccionada', v_practica.estado;
  end if;

  if v_practica.horas_realizadas <> 0 then
    raise exception 'horas_realizadas arrancó en %; se esperaba 0', v_practica.horas_realizadas;
  end if;
end;
$$;

reset role;
rollback;
