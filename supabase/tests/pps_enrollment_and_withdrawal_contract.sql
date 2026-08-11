-- Contrato no destructivo para reinscripción y baja atómica de PPS.
-- Crea fixtures aislados, simula coordinación autenticada y revierte todo.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

select set_config('pps_test.student_id', gen_random_uuid()::text, true);
select set_config('pps_test.completed_launch_id', gen_random_uuid()::text, true);
select set_config('pps_test.relaunch_id', gen_random_uuid()::text, true);
select set_config('pps_test.failed_launch_id', gen_random_uuid()::text, true);
select set_config('pps_test.failed_relaunch_id', gen_random_uuid()::text, true);
select set_config('pps_test.failed_enrollment_id', gen_random_uuid()::text, true);
select set_config('pps_test.active_launch_id', gen_random_uuid()::text, true);
select set_config('pps_test.active_enrollment_id', gen_random_uuid()::text, true);
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
  'TEST-PPS-GUARDS',
  '[TEST] Reinscripción y baja',
  'Alumno',
  'Activo'
);

insert into public.lanzamientos_pps (
  id, nombre_pps, orientacion, fecha_inicio, fecha_finalizacion,
  estado_convocatoria, tipo_actividad, modalidad_cupo
)
values
  (
    current_setting('pps_test.completed_launch_id')::uuid,
    '[TEST] Institución aprobada',
    'Clínica', '2098-01-01', '2098-02-01', 'Archivado', 'pps', 'fijo'
  ),
  (
    current_setting('pps_test.relaunch_id')::uuid,
    '[TEST] Institución aprobada',
    'Clínica', '2099-01-01', '2099-02-01', 'Abierta', 'pps', 'fijo'
  ),
  (
    current_setting('pps_test.failed_launch_id')::uuid,
    '[TEST] Institución desaprobada',
    'Laboral', '2098-03-01', '2098-04-01', 'Archivado', 'pps', 'fijo'
  ),
  (
    current_setting('pps_test.failed_relaunch_id')::uuid,
    '[TEST] Institución desaprobada',
    'Laboral', '2099-03-01', '2099-04-01', 'Abierta', 'pps', 'fijo'
  ),
  (
    current_setting('pps_test.active_launch_id')::uuid,
    '[TEST] Baja atómica',
    'Comunitaria', '2099-05-01', '2099-06-01', 'Activa', 'pps', 'fijo'
  );

insert into public.practicas (
  estudiante_id, lanzamiento_id, nombre_institucion, especialidad,
  estado, fecha_inicio, fecha_finalizacion, horas_realizadas, tipo_actividad
)
values (
  current_setting('pps_test.student_id')::uuid,
  current_setting('pps_test.completed_launch_id')::uuid,
  '[TEST] Institución aprobada',
  'Clinica',
  'Finalizada',
  '2098-01-01',
  '2098-02-01',
  30,
  'pps'
);

insert into public.practicas (
  estudiante_id, lanzamiento_id, nombre_institucion, especialidad,
  estado, fecha_inicio, fecha_finalizacion, horas_realizadas, tipo_actividad,
  desaprobacion_fecha, desaprobacion_causas, desaprobacion_motivo_publico,
  desaprobacion_notificado_at
)
values (
  current_setting('pps_test.student_id')::uuid,
  current_setting('pps_test.failed_launch_id')::uuid,
  '[TEST] Institución desaprobada',
  'Laboral',
  'Desaprobada',
  '2098-03-01',
  '2098-04-01',
  30,
  'pps',
  '2098-04-01',
  array['inasistencia_responsabilidad'],
  'No alcanzó el mínimo requerido.',
  '2098-04-01 12:00:00+00'
);

set local role authenticated;

do $$
declare
  v_student_id uuid := current_setting('pps_test.student_id')::uuid;
begin
  begin
    insert into public.convocatorias (estudiante_id, lanzamiento_id, estado_inscripcion)
    values (v_student_id, current_setting('pps_test.relaunch_id')::uuid, 'Inscripto');
    raise exception 'Una PPS Finalizada permitió reinscripción';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'Ya realizaste esta PPS. No podés volver a inscribirte.' then
        raise;
      end if;
  end;

  insert into public.convocatorias (estudiante_id, lanzamiento_id, estado_inscripcion)
  values (v_student_id, current_setting('pps_test.failed_relaunch_id')::uuid, 'Inscripto');
end;
$$;

-- Simula una inconsistencia legacy: la convocatoria de una PPS Desaprobada
-- quedó Seleccionada y sin compromiso. El cron no debe tocar ese antecedente.
insert into public.convocatorias (id, estudiante_id, lanzamiento_id, estado_inscripcion)
values (
  current_setting('pps_test.failed_enrollment_id')::uuid,
  current_setting('pps_test.student_id')::uuid,
  current_setting('pps_test.failed_launch_id')::uuid,
  'Seleccionado'
);

reset role;
select public.process_consentimiento_timeouts();
set local role authenticated;

do $$
begin
  if not exists (
    select 1 from public.convocatorias
    where id = current_setting('pps_test.failed_enrollment_id')::uuid
      and estado_inscripcion = 'Seleccionado'
  ) then
    raise exception 'El cron modificó la convocatoria de una PPS Desaprobada';
  end if;

  if not exists (
    select 1 from public.practicas
    where estudiante_id = current_setting('pps_test.student_id')::uuid
      and lanzamiento_id = current_setting('pps_test.failed_launch_id')::uuid
      and estado = 'Desaprobada'
  ) then
    raise exception 'El cron eliminó el antecedente Desaprobada';
  end if;
end;
$$;

insert into public.convocatorias (id, estudiante_id, lanzamiento_id, estado_inscripcion)
values (
  current_setting('pps_test.active_enrollment_id')::uuid,
  current_setting('pps_test.student_id')::uuid,
  current_setting('pps_test.active_launch_id')::uuid,
  'Seleccionado'
);

do $$
declare
  v_result record;
begin
  select * into v_result
  from public.dar_baja_pps_con_penalizacion(
    current_setting('pps_test.active_enrollment_id')::uuid,
    'Abandono durante la PPS',
    'Contrato de baja atómica',
    '2099-05-15'
  );

  if v_result.practicas_eliminadas <> 1 then
    raise exception 'La baja informó % prácticas eliminadas; se esperaba 1',
      v_result.practicas_eliminadas;
  end if;

  if not exists (
    select 1 from public.convocatorias
    where id = current_setting('pps_test.active_enrollment_id')::uuid
      and estado_inscripcion = 'No Seleccionado'
  ) then
    raise exception 'La inscripción no quedó como No Seleccionado';
  end if;

  if exists (
    select 1 from public.practicas
    where estudiante_id = current_setting('pps_test.student_id')::uuid
      and lanzamiento_id = current_setting('pps_test.active_launch_id')::uuid
      and estado = 'En curso'
  ) then
    raise exception 'La práctica En curso sobrevivió a la baja';
  end if;

  if not exists (
    select 1 from public.penalizaciones
    where id = v_result.penalizacion_id
      and puntaje_penalizacion = 70
      and tipo_incumplimiento = 'Abandono durante la PPS'
  ) then
    raise exception 'La penalización canónica no fue creada';
  end if;

  if not exists (
    select 1 from public.practicas
    where estudiante_id = current_setting('pps_test.student_id')::uuid
      and estado = 'Desaprobada'
  ) then
    raise exception 'La baja eliminó el antecedente Desaprobada';
  end if;
end;
$$;

rollback;
