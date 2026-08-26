-- Contrato no destructivo para la solicitud de baja iniciada por el estudiante.
-- Verifica identidad, snapshots, unicidad pendiente y resolución atómica por staff.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

select set_config('pps_withdrawal.student_id', e.id::text, true),
       set_config('pps_withdrawal.student_user_id', e.user_id::text, true)
from public.estudiantes as e
where e.user_id is not null
  and e.role = 'Alumno'
order by e.id
limit 1;

select set_config('pps_withdrawal.staff_user_id', e.user_id::text, true)
from public.estudiantes as e
where e.user_id is not null
  and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
order by e.role, e.id
limit 1;

select set_config('pps_withdrawal.launch_id', gen_random_uuid()::text, true);
select set_config('pps_withdrawal.enrollment_id', gen_random_uuid()::text, true);

do $$
begin
  if nullif(current_setting('pps_withdrawal.student_user_id', true), '') is null then
    raise exception 'La prueba requiere un estudiante con user_id';
  end if;
  if nullif(current_setting('pps_withdrawal.staff_user_id', true), '') is null then
    raise exception 'La prueba requiere un usuario staff con user_id';
  end if;
end;
$$;

insert into public.lanzamientos_pps (
  id, nombre_pps, orientacion, fecha_inicio, fecha_finalizacion,
  estado_convocatoria, tipo_actividad, modalidad_cupo
)
values (
  current_setting('pps_withdrawal.launch_id')::uuid,
  '[TEST] Solicitud de baja',
  'Clínica',
  '2099-05-01',
  '2099-06-01',
  'Activa',
  'pps',
  'fijo'
);

insert into public.convocatorias (id, estudiante_id, lanzamiento_id, estado_inscripcion)
values (
  current_setting('pps_withdrawal.enrollment_id')::uuid,
  current_setting('pps_withdrawal.student_id')::uuid,
  current_setting('pps_withdrawal.launch_id')::uuid,
  'Seleccionado'
);

-- La selección crea la práctica mediante el trigger productivo. Usamos esa
-- misma fila para evitar ocultar duplicados detrás de un fixture artificial.
select set_config('pps_withdrawal.practice_id', p.id::text, true)
from public.practicas as p
where p.estudiante_id = current_setting('pps_withdrawal.student_id')::uuid
  and p.lanzamiento_id = current_setting('pps_withdrawal.launch_id')::uuid
  and p.estado = 'En curso'
order by p.created_at desc nulls last, p.id
limit 1;

do $$
begin
  if nullif(current_setting('pps_withdrawal.practice_id', true), '') is null then
    raise exception 'La selección no creó la práctica En curso esperada';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('pps_withdrawal.student_user_id'),
  true
);
set local role authenticated;

select set_config(
  'pps_withdrawal.request_id',
  public.create_my_solicitud_baja_pps_v1(
    current_setting('pps_withdrawal.practice_id')::uuid,
    'academico',
    'La práctica se superpone con una materia obligatoria.'
  )::text,
  true
);

do $$
begin
  if not exists (
    select 1
    from public.solicitudes_modificacion_pps
    where id = current_setting('pps_withdrawal.request_id')::uuid
      and estudiante_id = current_setting('pps_withdrawal.student_id')::uuid
      and tipo_modificacion = 'eliminacion'
      and estado = 'pendiente'
      and nombre_pps_snapshot = '[TEST] Solicitud de baja'
      and fecha_inicio_snapshot = '2099-05-01'
      and motivo_baja = 'academico'
  ) then
    raise exception 'La solicitud no conservó identidad, motivo y snapshots esperados';
  end if;

  begin
    perform public.create_my_solicitud_baja_pps_v1(
      current_setting('pps_withdrawal.practice_id')::uuid,
      'otro',
      'Una segunda solicitud pendiente no debería ser aceptada.'
    );
    raise exception 'Se permitió una segunda solicitud de baja pendiente';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'Ya existe una solicitud de baja pendiente para esta PPS.' then
        raise;
      end if;
  end;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  current_setting('pps_withdrawal.staff_user_id'),
  true
);
set local role authenticated;

do $$
declare
  v_result record;
begin
  select * into v_result
  from public.resolver_solicitud_baja_pps_v1(
    current_setting('pps_withdrawal.request_id')::uuid,
    'aprobar',
    'Baja Anticipada',
    'Resolución del contrato de solicitud de baja.',
    null
  );

  if v_result.estado <> 'aprobada' or v_result.practicas_eliminadas <> 1 then
    raise exception 'La resolución no confirmó aprobación y eliminación atómica';
  end if;

  if exists (
    select 1 from public.practicas
    where id = current_setting('pps_withdrawal.practice_id')::uuid
  ) then
    raise exception 'La práctica activa sobrevivió a la aprobación de la baja';
  end if;

  if not exists (
    select 1 from public.convocatorias
    where id = current_setting('pps_withdrawal.enrollment_id')::uuid
      and estado_inscripcion = 'No Seleccionado'
  ) then
    raise exception 'La convocatoria no quedó como No Seleccionado';
  end if;

  if not exists (
    select 1
    from public.solicitudes_modificacion_pps
    where id = current_setting('pps_withdrawal.request_id')::uuid
      and estado = 'aprobada'
      and practica_id is null
      and penalizacion_id = v_result.penalizacion_id
      and tipo_penalizacion_aplicada = 'Baja Anticipada'
      and puntaje_penalizacion_aplicado = 30
      and resuelta_at is not null
      and resuelta_por is not null
  ) then
    raise exception 'La solicitud no sobrevivió con su resolución y penalización enlazadas';
  end if;

  if not exists (
    select 1 from public.penalizaciones
    where id = v_result.penalizacion_id
      and estudiante_id = current_setting('pps_withdrawal.student_id')::uuid
      and tipo_incumplimiento = 'Baja Anticipada'
      and puntaje_penalizacion = 30
  ) then
    raise exception 'La penalización canónica no fue creada';
  end if;
end;
$$;

rollback;
