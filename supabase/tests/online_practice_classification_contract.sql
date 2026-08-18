-- Contrato no destructivo para la clasificación de PPS virtuales.
begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

select set_config('pps_test.online_student_id', gen_random_uuid()::text, true);
select set_config('pps_test.online_launch_id', gen_random_uuid()::text, true);
select set_config('pps_test.physical_launch_id', gen_random_uuid()::text, true);

insert into public.estudiantes (id, legajo, nombre, role, estado)
values (
  current_setting('pps_test.online_student_id')::uuid,
  'TEST-ONLINE-PPS',
  '[TEST] Modalidad PPS',
  'Alumno',
  'Activo'
);

insert into public.lanzamientos_pps (
  id, nombre_pps, direccion, estado_convocatoria, tipo_actividad, modalidad_cupo
) values
  (
    current_setting('pps_test.online_launch_id')::uuid,
    '[TEST] PPS Online',
    'Online',
    'Oculto',
    'pps',
    'fijo'
  ),
  (
    current_setting('pps_test.physical_launch_id')::uuid,
    '[TEST] PPS Presencial',
    'Gallo 1330',
    'Oculto',
    'pps',
    'fijo'
  );

insert into public.practicas (
  estudiante_id, lanzamiento_id, nombre_institucion, es_online, tipo_actividad
) values
  (
    current_setting('pps_test.online_student_id')::uuid,
    current_setting('pps_test.online_launch_id')::uuid,
    '[TEST] PPS Online',
    false,
    'pps'
  ),
  (
    current_setting('pps_test.online_student_id')::uuid,
    current_setting('pps_test.physical_launch_id')::uuid,
    '[TEST] PPS Presencial',
    false,
    'pps'
  );

do $$
declare
  v_online boolean;
  v_physical boolean;
begin
  select es_online into v_online
  from public.practicas
  where lanzamiento_id = current_setting('pps_test.online_launch_id')::uuid;

  select es_online into v_physical
  from public.practicas
  where lanzamiento_id = current_setting('pps_test.physical_launch_id')::uuid;

  if v_online is distinct from true then
    raise exception 'La dirección Online no clasificó la práctica como virtual.';
  end if;

  if v_physical is distinct from false then
    raise exception 'La dirección física clasificó incorrectamente la práctica como virtual.';
  end if;
end;
$$;

update public.lanzamientos_pps
set direccion = 'Modalidad Virtual'
where id = current_setting('pps_test.physical_launch_id')::uuid;

do $$
begin
  if not exists (
    select 1
    from public.practicas
    where lanzamiento_id = current_setting('pps_test.physical_launch_id')::uuid
      and es_online
  ) then
    raise exception 'La corrección de modalidad del lanzamiento no sincronizó la práctica.';
  end if;
end;
$$;

rollback;
