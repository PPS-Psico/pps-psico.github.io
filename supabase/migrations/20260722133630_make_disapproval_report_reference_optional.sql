create or replace function public.registrar_desaprobacion_pps(
  p_practica_id uuid,
  p_fecha date,
  p_causas text[],
  p_motivo_publico text,
  p_informe_ref text,
  p_notificado_at timestamptz
)
returns table (practica_id uuid, penalizacion_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_practica public.practicas%rowtype;
  v_penalizacion_id uuid;
  v_convocatoria_id uuid;
  v_nombre_pps text;
  v_actor_name text;
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinación'
      using errcode = '42501';
  end if;

  if p_fecha is null or p_notificado_at is null then
    raise exception 'La fecha de desaprobación y la notificación son obligatorias'
      using errcode = '22023';
  end if;

  if coalesce(array_length(p_causas, 1), 0) = 0
     or not (p_causas <@ array[
       'inasistencia_responsabilidad',
       'falta_participacion_actitud'
     ]::text[]) then
    raise exception 'Debe seleccionarse al menos una causa válida'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_motivo_publico), '') is null then
    raise exception 'El motivo comunicado es obligatorio'
      using errcode = '22023';
  end if;

  select p.*
  into v_practica
  from public.practicas as p
  where p.id = p_practica_id
  for update;

  if not found then
    raise exception 'Práctica inexistente'
      using errcode = 'P0002';
  end if;

  if v_practica.tipo_actividad <> 'pps' then
    raise exception 'La desaprobación institucional sólo aplica a PPS'
      using errcode = '22023';
  end if;

  select c.id
  into v_convocatoria_id
  from public.convocatorias as c
  where c.estudiante_id = v_practica.estudiante_id
    and c.lanzamiento_id = v_practica.lanzamiento_id
  order by (c.estado_inscripcion = 'Seleccionado') desc, c.created_at desc
  limit 1;

  select coalesce(l.nombre_pps, v_practica.nombre_institucion, 'PPS')
  into v_nombre_pps
  from public.lanzamientos_pps as l
  where l.id = v_practica.lanzamiento_id;

  v_nombre_pps := coalesce(v_nombre_pps, v_practica.nombre_institucion, 'PPS');

  select e.nombre
  into v_actor_name
  from public.estudiantes as e
  where e.user_id = (select auth.uid())
  limit 1;

  update public.practicas
  set estado = 'Desaprobada',
      desaprobacion_fecha = p_fecha,
      desaprobacion_causas = array(select distinct unnest(p_causas)),
      desaprobacion_motivo_publico = btrim(p_motivo_publico),
      desaprobacion_notificado_at = p_notificado_at,
      desaprobacion_registrado_por = (select auth.uid())
  where id = p_practica_id;

  insert into public.penalizaciones (
    estudiante_id,
    tipo_incumplimiento,
    fecha_incidente,
    notas,
    puntaje_penalizacion,
    convocatoria_afectada,
    practica_id,
    convocatoria_id,
    lanzamiento_id,
    estado
  ) values (
    v_practica.estudiante_id,
    'PPS desaprobada por la institución',
    p_fecha::text,
    btrim(p_motivo_publico),
    100,
    v_nombre_pps,
    p_practica_id,
    v_convocatoria_id,
    v_practica.lanzamiento_id,
    'Activa'
  )
  on conflict (practica_id)
    where estado = 'Activa'
      and tipo_incumplimiento = 'PPS desaprobada por la institución'
  do update set
    fecha_incidente = excluded.fecha_incidente,
    notas = excluded.notas,
    puntaje_penalizacion = 100,
    convocatoria_afectada = excluded.convocatoria_afectada,
    convocatoria_id = excluded.convocatoria_id,
    lanzamiento_id = excluded.lanzamiento_id
  returning id into v_penalizacion_id;

  insert into public.admin_action_log (
    actor_user_id,
    actor_name,
    action_type,
    target_table,
    target_id,
    summary,
    metadata
  ) values (
    (select auth.uid()),
    v_actor_name,
    'pps_disapproval_registered',
    'practicas',
    p_practica_id::text,
    'PPS marcada como desaprobada por decisión institucional',
    jsonb_build_object(
      'estudiante_id', v_practica.estudiante_id,
      'lanzamiento_id', v_practica.lanzamiento_id,
      'convocatoria_id', v_convocatoria_id,
      'estado_anterior', v_practica.estado,
      'fecha', p_fecha,
      'causas', p_causas,
      'informe_ref', nullif(btrim(p_informe_ref), ''),
      'notificado_at', p_notificado_at,
      'penalizacion_id', v_penalizacion_id,
      'puntaje', 100
    )
  );

  return query select p_practica_id, v_penalizacion_id;
end;
$$;

revoke all on function public.registrar_desaprobacion_pps(
  uuid,
  date,
  text[],
  text,
  text,
  timestamptz
) from public, anon;

grant execute on function public.registrar_desaprobacion_pps(
  uuid,
  date,
  text[],
  text,
  text,
  timestamptz
) to authenticated;
