-- Contrato funcional no destructivo para cierre y reapertura de selección.
-- Crea fixtures aislados, simula una sesión admin autenticada y revierte todo.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

select set_config('pps_test.launch_id', gen_random_uuid()::text, true);
select set_config('pps_test.selected_student_id', gen_random_uuid()::text, true);
select set_config('pps_test.pending_student_1_id', gen_random_uuid()::text, true);
select set_config('pps_test.pending_student_2_id', gen_random_uuid()::text, true);
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

-- El setup corre como propietario. Las acciones bajo prueba corren luego con
-- rol authenticated y pasan por las políticas RLS reales.
insert into public.estudiantes (id, legajo, nombre, role, estado)
values
  (current_setting('pps_test.selected_student_id')::uuid, 'TEST-SEL', '[TEST] Seleccionado', 'Alumno', 'Activo'),
  (current_setting('pps_test.pending_student_1_id')::uuid, 'TEST-PEN-1', '[TEST] Pendiente 1', 'Alumno', 'Activo'),
  (current_setting('pps_test.pending_student_2_id')::uuid, 'TEST-PEN-2', '[TEST] Pendiente 2', 'Alumno', 'Activo');

insert into public.lanzamientos_pps (
  id,
  nombre_pps,
  fecha_inicio,
  fecha_finalizacion,
  estado_convocatoria,
  estado_gestion,
  tipo_actividad,
  modalidad_cupo,
  cupos_disponibles
)
values (
  current_setting('pps_test.launch_id')::uuid,
  '[TEST] Contrato de cierre',
  '2099-01-01',
  '2099-02-01',
  'Abierta',
  'Relanzamiento Confirmado',
  'pps',
  'fijo',
  1
);

insert into public.convocatorias (lanzamiento_id, estudiante_id, estado_inscripcion)
values
  (
    current_setting('pps_test.launch_id')::uuid,
    current_setting('pps_test.selected_student_id')::uuid,
    'Seleccionado'
  ),
  (
    current_setting('pps_test.launch_id')::uuid,
    current_setting('pps_test.pending_student_1_id')::uuid,
    'Inscripto'
  ),
  (
    current_setting('pps_test.launch_id')::uuid,
    current_setting('pps_test.pending_student_2_id')::uuid,
    'Inscripto'
  );

set local role authenticated;

do $$
declare
  v_launch_id uuid := current_setting('pps_test.launch_id')::uuid;
  v_actor_id uuid := current_setting('request.jwt.claim.sub')::uuid;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'La sesión simulada no fue reconocida como staff';
  end if;

  v_result := public.close_selection(v_launch_id);

  if (v_result ->> 'selected')::integer <> 1
     or (v_result ->> 'not_selected')::integer <> 2 then
    raise exception 'Conteos de cierre inesperados: %', v_result;
  end if;

  if (select count(*) from public.convocatorias
      where lanzamiento_id = v_launch_id
        and estado_inscripcion = 'Seleccionado') <> 1 then
    raise exception 'El seleccionado vigente no se preservó';
  end if;

  if (select count(*) from public.convocatorias
      where lanzamiento_id = v_launch_id
        and estado_inscripcion = 'No Seleccionado') <> 2 then
    raise exception 'Los pendientes no se cerraron como No Seleccionado';
  end if;

  if (select count(*) from public.convocatorias
      where lanzamiento_id = v_launch_id
        and selection_decided_at is not null) <> 3 then
    raise exception 'Las tres decisiones deben tener timestamp';
  end if;

  if not exists (
    select 1
    from public.lanzamientos_pps
    where id = v_launch_id
      and estado_convocatoria = 'Cerrado'
      and selection_closed_at is not null
      and selection_closed_by = v_actor_id
  ) then
    raise exception 'El lanzamiento no conserva cierre y actor';
  end if;

  if (select count(*) from public.selection_decision_events
      where lanzamiento_id = v_launch_id
        and from_state = 'Inscripto'
        and to_state = 'No Seleccionado'
        and actor_id = v_actor_id) <> 2 then
    raise exception 'La bitácora no contiene las dos decisiones negativas';
  end if;

  if (select count(*) from public.selection_cycle_events
      where lanzamiento_id = v_launch_id
        and event_type = 'closed'
        and actor_id = v_actor_id) <> 1 then
    raise exception 'La bitácora no contiene exactamente un cierre';
  end if;
end;
$$;

update public.lanzamientos_pps
set estado_convocatoria = 'Abierta',
    estado_gestion = 'Relanzamiento Confirmado',
    selection_closed_at = null
where id = current_setting('pps_test.launch_id')::uuid;

do $$
declare
  v_launch_id uuid := current_setting('pps_test.launch_id')::uuid;
  v_actor_id uuid := current_setting('request.jwt.claim.sub')::uuid;
begin
  if not exists (
    select 1
    from public.lanzamientos_pps
    where id = v_launch_id
      and estado_convocatoria = 'Abierta'
      and selection_closed_at is null
  ) then
    raise exception 'La reapertura no restauró el estado esperado';
  end if;

  if (select count(*) from public.selection_cycle_events
      where lanzamiento_id = v_launch_id
        and event_type = 'reopened'
        and actor_id = v_actor_id) <> 1 then
    raise exception 'La bitácora no contiene exactamente una reapertura';
  end if;

  if has_function_privilege('anon', 'public.close_selection(uuid)', 'execute') then
    raise exception 'anon no debe poder ejecutar close_selection';
  end if;
end;
$$;

rollback;
