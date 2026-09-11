-- Tres huecos que quedaron de las aprobaciones atomicas.
--
-- 1. Un reintento con OTRA decision se informaba como exito.
--    Las RPC devolvian el resultado anterior con solo ver que la solicitud ya
--    estaba aprobada, sin mirar si la nueva decision coincidia. Aprobar 70 y
--    despues intentar 90 devolvia exito y seguian siendo 70: una confirmacion
--    falsa sobre un legajo. Un reintento identico sigue siendo idempotente; uno
--    distinto ahora informa conflicto y dice con cuanto quedo aprobada.
--
-- 2. El rechazo no exigia que la solicitud siguiera pendiente.
--    Filtraba solo por id, asi que una pestana desactualizada podia rechazar una
--    solicitud ya aprobada y dejar la practica creada. Ahora tambien es una RPC
--    que bloquea la fila y verifica el estado.
--
-- 3. No quedaba registro de quien resolvio ni cuando.
--    solicitudes_modificacion_pps ya tenia resuelta_at y resuelta_por sin usar;
--    solicitudes_nueva_pps ni siquiera los tenia.

alter table public.solicitudes_nueva_pps
  add column if not exists resuelta_at timestamptz,
  add column if not exists resuelta_por uuid;

comment on column public.solicitudes_nueva_pps.resuelta_at is
  'Cuando coordinacion resolvio la solicitud (aprobada o rechazada).';
comment on column public.solicitudes_nueva_pps.resuelta_por is
  'Quien la resolvio, tomado de auth.uid() dentro de la transaccion.';


create or replace function public.aprobar_solicitud_nueva_pps(
  p_solicitud_id uuid,
  p_horas_aprobadas integer,
  p_notas text default null
)
returns public.practicas
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_sol public.solicitudes_nueva_pps%rowtype;
  v_practica public.practicas%rowtype;
  v_institucion text;
begin
  if not public.is_admin() then
    raise exception 'Solo coordinacion puede resolver solicitudes de PPS.'
      using errcode = '42501';
  end if;

  if p_horas_aprobadas is null or p_horas_aprobadas <= 0 then
    raise exception 'Las horas a acreditar deben ser mayores a cero.'
      using errcode = '22023';
  end if;

  select s.* into v_sol
  from public.solicitudes_nueva_pps as s
  where s.id = p_solicitud_id
  for update;

  if not found then
    raise exception 'No se encontro la solicitud indicada.' using errcode = 'P0002';
  end if;

  if v_sol.estado = 'aprobada' and v_sol.practica_id is not null then
    -- Reintento identico: devuelve lo que ya creo. Distinto: conflicto, porque
    -- confirmar una decision que no se aplico es peor que fallar.
    if p_horas_aprobadas is distinct from v_sol.horas_aprobadas then
      raise exception
        'La solicitud ya fue aprobada con % h y no se puede cambiar por esta via. Recarga la pantalla.',
        v_sol.horas_aprobadas
        using errcode = 'P0001';
    end if;

    select p.* into v_practica
    from public.practicas as p
    where p.id = v_sol.practica_id;
    return v_practica;
  end if;

  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue procesada (estado: %).', v_sol.estado
      using errcode = 'P0001';
  end if;

  select i.nombre into v_institucion
  from public.instituciones as i
  where i.id = v_sol.institucion_id;

  insert into public.practicas (
    estudiante_id, especialidad, fecha_inicio, fecha_finalizacion,
    horas_realizadas, estado, nota, lanzamiento_id, institucion_id,
    nombre_institucion, es_online
  ) values (
    v_sol.estudiante_id,
    v_sol.orientacion,
    v_sol.fecha_inicio::text,
    v_sol.fecha_finalizacion::text,
    p_horas_aprobadas,
    'Finalizada',
    null,
    null,
    v_sol.institucion_id,
    coalesce(v_institucion, v_sol.nombre_institucion_manual, 'Institucion desconocida'),
    coalesce(v_sol.es_online, false)
  )
  returning * into v_practica;

  update public.solicitudes_nueva_pps
  set estado = 'aprobada',
      notas_admin = nullif(btrim(p_notas), ''),
      horas_aprobadas = p_horas_aprobadas,
      practica_id = v_practica.id,
      resuelta_at = now(),
      resuelta_por = auth.uid()
  where id = v_sol.id;

  return v_practica;
end;
$fn$;


create or replace function public.aprobar_solicitud_modificacion_pps(
  p_solicitud_id uuid,
  p_horas_aprobadas integer default null,
  p_notas text default null
)
returns public.solicitudes_modificacion_pps
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_sol public.solicitudes_modificacion_pps%rowtype;
  v_practica public.practicas%rowtype;
  v_horas integer;
begin
  if not public.is_admin() then
    raise exception 'Solo coordinacion puede resolver solicitudes de PPS.'
      using errcode = '42501';
  end if;

  -- Mismo orden de bloqueo que la aprobacion de alta: primero la solicitud,
  -- despues la practica. Dos solicitudes sobre la misma practica se serializan.
  select s.* into v_sol
  from public.solicitudes_modificacion_pps as s
  where s.id = p_solicitud_id
  for update;

  if not found then
    raise exception 'No se encontro la solicitud indicada.' using errcode = 'P0002';
  end if;

  if v_sol.tipo_modificacion = 'eliminacion' then
    raise exception 'Las solicitudes de baja se resuelven con su penalizacion asociada.'
      using errcode = 'P0001';
  end if;

  if v_sol.estado = 'aprobada' then
    if p_horas_aprobadas is not null
       and p_horas_aprobadas is distinct from v_sol.horas_aprobadas then
      raise exception
        'La solicitud ya fue aprobada con % h y no se puede cambiar por esta via. Recarga la pantalla.',
        coalesce(v_sol.horas_aprobadas::text, 'sin registro de')
        using errcode = 'P0001';
    end if;
    return v_sol;
  end if;

  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue procesada (estado: %).', v_sol.estado
      using errcode = 'P0001';
  end if;

  if v_sol.tipo_modificacion = 'horas' then
    v_horas := coalesce(p_horas_aprobadas, v_sol.horas_nuevas);

    if v_horas is null or v_horas <= 0 then
      raise exception 'Las horas a acreditar deben ser mayores a cero.'
        using errcode = '22023';
    end if;

    if v_sol.practica_id is null then
      raise exception 'La solicitud de horas ya no tiene una practica asociada.'
        using errcode = 'P0001';
    end if;

    select p.* into v_practica
    from public.practicas as p
    where p.id = v_sol.practica_id
    for update;

    if not found then
      raise exception 'La practica que se quiere modificar ya no existe.'
        using errcode = 'P0002';
    end if;

    update public.practicas
    set horas_realizadas = v_horas
    where id = v_practica.id;
  end if;

  update public.solicitudes_modificacion_pps
  set estado = 'aprobada',
      notas_admin = nullif(btrim(p_notas), ''),
      horas_aprobadas = case when v_sol.tipo_modificacion = 'horas' then v_horas else null end,
      resuelta_at = now(),
      resuelta_por = auth.uid()
  where id = v_sol.id
  returning * into v_sol;

  return v_sol;
end;
$fn$;


create or replace function public.rechazar_solicitud_nueva_pps(
  p_solicitud_id uuid,
  p_comentario_rechazo text,
  p_notas text default null
)
returns public.solicitudes_nueva_pps
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_sol public.solicitudes_nueva_pps%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Solo coordinacion puede resolver solicitudes de PPS.'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_comentario_rechazo), '') = '' then
    raise exception 'El rechazo necesita un motivo: lo ve el estudiante.'
      using errcode = '22023';
  end if;

  select s.* into v_sol
  from public.solicitudes_nueva_pps as s
  where s.id = p_solicitud_id
  for update;

  if not found then
    raise exception 'No se encontro la solicitud indicada.' using errcode = 'P0002';
  end if;

  -- Sin esta guarda, una pestana vieja rechazaba una solicitud ya aprobada y
  -- dejaba la practica creada en el legajo.
  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue procesada (estado: %).', v_sol.estado
      using errcode = 'P0001';
  end if;

  update public.solicitudes_nueva_pps
  set estado = 'rechazada',
      comentario_rechazo = btrim(p_comentario_rechazo),
      notas_admin = nullif(btrim(p_notas), ''),
      resuelta_at = now(),
      resuelta_por = auth.uid()
  where id = v_sol.id
  returning * into v_sol;

  return v_sol;
end;
$fn$;


create or replace function public.rechazar_solicitud_modificacion_pps(
  p_solicitud_id uuid,
  p_comentario_rechazo text,
  p_notas text default null
)
returns public.solicitudes_modificacion_pps
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_sol public.solicitudes_modificacion_pps%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Solo coordinacion puede resolver solicitudes de PPS.'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_comentario_rechazo), '') = '' then
    raise exception 'El rechazo necesita un motivo: lo ve el estudiante.'
      using errcode = '22023';
  end if;

  select s.* into v_sol
  from public.solicitudes_modificacion_pps as s
  where s.id = p_solicitud_id
  for update;

  if not found then
    raise exception 'No se encontro la solicitud indicada.' using errcode = 'P0002';
  end if;

  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue procesada (estado: %).', v_sol.estado
      using errcode = 'P0001';
  end if;

  update public.solicitudes_modificacion_pps
  set estado = 'rechazada',
      comentario_rechazo = btrim(p_comentario_rechazo),
      notas_admin = nullif(btrim(p_notas), ''),
      resuelta_at = now(),
      resuelta_por = auth.uid()
  where id = v_sol.id
  returning * into v_sol;

  return v_sol;
end;
$fn$;


revoke all on function public.rechazar_solicitud_nueva_pps(uuid, text, text)
  from public, anon;
grant execute on function public.rechazar_solicitud_nueva_pps(uuid, text, text)
  to authenticated;

revoke all on function public.rechazar_solicitud_modificacion_pps(uuid, text, text)
  from public, anon;
grant execute on function public.rechazar_solicitud_modificacion_pps(uuid, text, text)
  to authenticated;

comment on function public.rechazar_solicitud_nueva_pps(uuid, text, text) is
  'Rechazo atomico de alta de PPS: exige motivo y que la solicitud siga pendiente.';
comment on function public.rechazar_solicitud_modificacion_pps(uuid, text, text) is
  'Rechazo atomico de modificacion: exige motivo y que la solicitud siga pendiente.';
