-- The previous remote deployment double-encoded the middle-dot separator used
-- by multi-option schedules. Keep this migration ASCII-only so the repair is
-- stable regardless of the SQL transport encoding.

create or replace function public.inscribir_convocatoria_multiopcion_v2(
  p_lanzamiento_id uuid,
  p_horario_ids uuid[],
  p_datos jsonb default '{}'::jsonb
)
returns public.convocatorias
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student public.estudiantes%rowtype;
  v_launch public.lanzamientos_pps%rowtype;
  v_conv public.convocatorias%rowtype;
  v_slot_count integer;
  v_distinct_count integer;
  v_blocked text;
  v_orientation text;
  v_preference_labels text;
begin
  select * into v_student
  from public.estudiantes e
  where e.user_id = (select auth.uid())
  limit 1;

  if v_student.id is null then
    raise exception using message = U&'No se encontr\00F3 el perfil del estudiante autenticado.';
  end if;
  if lower(coalesce(v_student.estado, '')) <> 'activo' then
    raise exception using message = U&'Tu cuenta no est\00E1 activa. Comunicate con coordinaci\00F3n de PPS.';
  end if;

  select * into v_launch
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id;

  if v_launch.id is null
     or lower(coalesce(v_launch.estado_convocatoria, '')) not in ('abierta', 'abierto') then
    raise exception using message = U&'La convocatoria no est\00E1 abierta para inscripciones.';
  end if;
  if coalesce(cardinality(p_horario_ids), 0) = 0 then
    raise exception using message = U&'Eleg\00ED al menos una franja horaria.';
  end if;

  select count(*), count(distinct h.id)
  into v_slot_count, v_distinct_count
  from public.lanzamiento_opcion_horarios h
  join public.lanzamiento_opciones o on o.id = h.opcion_id
  where h.id = any(p_horario_ids)
    and h.activa
    and o.activa
    and o.lanzamiento_id = p_lanzamiento_id;

  if v_slot_count <> cardinality(p_horario_ids)
     or v_distinct_count <> cardinality(p_horario_ids) then
    raise exception using message = U&'Una o m\00E1s franjas no pertenecen a esta convocatoria.';
  end if;

  select string_agg(distinct o.orientacion, ', ' order by o.orientacion)
  into v_blocked
  from public.lanzamiento_opcion_horarios h
  join public.lanzamiento_opciones o on o.id = h.opcion_id
  where h.id = any(p_horario_ids)
    and exists (
      select 1
      from public.practicas p
      left join public.lanzamientos_pps previous_launch on previous_launch.id = p.lanzamiento_id
      where p.estudiante_id = v_student.id
        and lower(coalesce(p.estado, '')) in
          ('finalizada', 'pps realizada', 'convenio realizado', 'aprobada', 'en curso')
        and lower(btrim(coalesce(p.especialidad, ''))) = lower(btrim(o.orientacion))
        and (
          (p.institucion_id is not null and p.institucion_id::text = v_launch.institucion_id)
          or (previous_launch.institucion_id is not null
              and previous_launch.institucion_id = v_launch.institucion_id)
          or lower(btrim(coalesce(p.nombre_institucion, ''))) =
             lower(btrim(coalesce(v_launch.nombre_pps, '')))
        )
    );

  if v_blocked is not null then
    raise exception using message = format(
      U&'Ya cursaste o est\00E1s cursando la orientaci\00F3n %s en esta instituci\00F3n.',
      v_blocked
    );
  end if;

  select string_agg(distinct o.orientacion, ', ' order by o.orientacion),
         string_agg(o.nombre || ' ' || chr(183) || ' ' || h.horario, '; '
           order by array_position(p_horario_ids, h.id))
  into v_orientation, v_preference_labels
  from public.lanzamiento_opcion_horarios h
  join public.lanzamiento_opciones o on o.id = h.opcion_id
  where h.id = any(p_horario_ids);

  insert into public.convocatorias (
    lanzamiento_id, estudiante_id, estado_inscripcion, termino_cursar,
    cursando_electivas, finales_adeuda, otra_situacion_academica,
    horario_seleccionado, trabaja, certificado_trabajo, cv_url,
    nombre_pps, fecha_inicio, fecha_finalizacion, orientacion,
    horas_acreditadas, direccion, legajo, correo, telefono, dni
  ) values (
    v_launch.id, v_student.id, 'Inscripto', p_datos->>'termino_cursar',
    p_datos->>'cursando_electivas', p_datos->>'finales_adeuda',
    p_datos->>'otra_situacion_academica', v_preference_labels,
    coalesce((p_datos->>'trabaja')::boolean, false),
    nullif(p_datos->>'certificado_trabajo', ''), nullif(p_datos->>'cv_url', ''),
    v_launch.nombre_pps, v_launch.fecha_inicio,
    case when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
    v_orientation, v_launch.horas_acreditadas, v_launch.direccion,
    nullif(p_datos->>'legajo', '')::numeric, v_student.correo, v_student.telefono, v_student.dni
  )
  returning * into v_conv;

  insert into public.convocatoria_preferencias (
    convocatoria_id, opcion_id, opcion_horario_id, prioridad
  )
  select v_conv.id, h.opcion_id, selected.horario_id, selected.ordinality::smallint
  from unnest(p_horario_ids) with ordinality as selected(horario_id, ordinality)
  join public.lanzamiento_opcion_horarios h on h.id = selected.horario_id;

  return v_conv;
end;
$$;

create or replace function public.seleccionar_convocatoria_opcion_horario(
  p_convocatoria_id uuid,
  p_horario_id uuid,
  p_seleccionar boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conv public.convocatorias%rowtype;
  v_launch public.lanzamientos_pps%rowtype;
  v_option public.lanzamiento_opciones%rowtype;
  v_slot public.lanzamiento_opcion_horarios%rowtype;
  v_schedule text;
  v_used integer;
begin
  if not (select public.is_admin()) then
    raise exception using message = U&'No ten\00E9s permisos para gestionar la selecci\00F3n.';
  end if;

  select * into v_conv
  from public.convocatorias
  where id = p_convocatoria_id
  for update;
  if v_conv.id is null then
    raise exception using message = U&'Inscripci\00F3n inexistente.';
  end if;

  select * into v_launch
  from public.lanzamientos_pps
  where id = v_conv.lanzamiento_id;

  if p_seleccionar then
    select * into v_slot
    from public.lanzamiento_opcion_horarios
    where id = p_horario_id and activa
    for update;

    select * into v_option
    from public.lanzamiento_opciones
    where id = v_slot.opcion_id
      and lanzamiento_id = v_conv.lanzamiento_id
      and activa;

    if v_slot.id is null or v_option.id is null then
      raise exception using message = U&'Eleg\00ED una franja v\00E1lida.';
    end if;

    select count(*) into v_used
    from public.convocatorias c
    where c.opcion_horario_asignado_id = v_slot.id
      and lower(coalesce(c.estado_inscripcion, '')) = 'seleccionado'
      and c.id <> v_conv.id;

    if v_used >= v_slot.cupos then
      raise exception using message = U&'El horario seleccionado ya no tiene cupos disponibles.';
    end if;

    v_schedule := v_option.nombre || ' ' || chr(183) || ' ' || v_slot.horario;

    update public.convocatorias
    set estado_inscripcion = 'Seleccionado',
        opcion_asignada_id = v_option.id,
        opcion_horario_asignado_id = v_slot.id,
        horario_asignado = v_schedule,
        orientacion = v_option.orientacion,
        selected_at = now(), reminder_sent_at = null, baja_automatica_at = null
    where id = v_conv.id;

    update public.practicas
    set opcion_id = v_option.id,
        opcion_horario_id = v_slot.id,
        institucion_id = case
          when v_launch.institucion_id ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then v_launch.institucion_id::uuid else null end,
        nombre_institucion = v_launch.nombre_pps,
        especialidad = v_option.orientacion,
        fecha_inicio = v_launch.fecha_inicio,
        fecha_finalizacion = case
          when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
        estado = 'En curso'
    where estudiante_id = v_conv.estudiante_id
      and lanzamiento_id = v_launch.id
      and lower(coalesce(estado, '')) = 'en curso';

    if not found then
      insert into public.practicas (
        estudiante_id, lanzamiento_id, opcion_id, opcion_horario_id, institucion_id,
        nombre_institucion, especialidad, fecha_inicio, fecha_finalizacion,
        horas_realizadas, estado, nota, informe_estado
      ) values (
        v_conv.estudiante_id, v_launch.id, v_option.id, v_slot.id,
        case when v_launch.institucion_id ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then v_launch.institucion_id::uuid else null end,
        v_launch.nombre_pps, v_option.orientacion, v_launch.fecha_inicio,
        case when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
        0, 'En curso', null, null
      );
    end if;
  else
    update public.convocatorias
    set estado_inscripcion = 'Inscripto',
        opcion_asignada_id = null,
        opcion_horario_asignado_id = null,
        horario_asignado = null, selected_at = null,
        reminder_sent_at = null, baja_automatica_at = null
    where id = v_conv.id;

    delete from public.practicas
    where estudiante_id = v_conv.estudiante_id
      and lanzamiento_id = v_conv.lanzamiento_id
      and lower(coalesce(estado, '')) = 'en curso';
  end if;

  return true;
end;
$$;

-- Repair all rows affected by the double-encoded separator, including the
-- current Ministerio launch and any other multi-option launch created by the
-- same RPC deployment.
update public.convocatorias
set horario_asignado = replace(
      horario_asignado,
      chr(194) || chr(183),
      chr(183)
    )
where position(chr(194) || chr(183) in coalesce(horario_asignado, '')) > 0;

update public.convocatorias
set horario_seleccionado = replace(
      horario_seleccionado,
      chr(194) || chr(183),
      chr(183)
    )
where position(chr(194) || chr(183) in coalesce(horario_seleccionado, '')) > 0;
