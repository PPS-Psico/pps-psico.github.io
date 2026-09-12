-- Aprobaciones atomicas de solicitudes de PPS.
--
-- Hasta ahora aprobar eran dos escrituras sueltas desde el navegador, en ordenes
-- opuestos y sin transaccion (src/services/solicitudesService.ts):
--
--   · nueva PPS:    INSERT practica  ->  UPDATE solicitud
--     Si fallaba el segundo paso la practica quedaba creada y la solicitud
--     pendiente: el reintento acreditaba las horas DOS veces.
--   · modificacion: UPDATE solicitud  ->  UPDATE practica
--     Si fallaba el segundo paso la solicitud quedaba aprobada sin que las horas
--     se aplicaran, y el guard de "pendiente" bloqueaba el reintento.
--
-- El chequeo previo de estado tampoco cubria la concurrencia: leia sin bloquear,
-- asi que un doble clic son dos operaciones que pasan las dos. Ahora cada
-- resolucion es una transaccion unica que bloquea la fila antes de decidir.
--
-- Las horas que se acreditan las define coordinacion al aprobar y no tienen por
-- que ser las que pidio el estudiante, asi que se guardan aparte.
--
-- Las bajas (tipo_modificacion = 'eliminacion') no entran aca: ya tienen su RPC
-- con la logica de penalizacion, que es una decision disciplinaria y no documental.

alter table public.solicitudes_nueva_pps
  add column if not exists practica_id uuid references public.practicas(id) on delete set null,
  add column if not exists horas_aprobadas integer;

alter table public.solicitudes_modificacion_pps
  add column if not exists horas_aprobadas integer;

-- Una solicitud no puede haber creado dos practicas. Es la garantia real de que
-- un reintento no duplica el legajo, no una convencion del codigo que la llama.
create unique index if not exists solicitudes_nueva_pps_practica_unica
  on public.solicitudes_nueva_pps (practica_id)
  where practica_id is not null;

comment on column public.solicitudes_nueva_pps.practica_id is
  'Practica creada al aprobar. Unica por solicitud: hace idempotente el reintento.';
comment on column public.solicitudes_nueva_pps.horas_aprobadas is
  'Horas que acredito coordinacion. Puede diferir de horas_estimadas, que es lo que pidio el estudiante.';
comment on column public.solicitudes_modificacion_pps.horas_aprobadas is
  'Horas que acredito coordinacion. Puede diferir de horas_nuevas, que es lo que pidio el estudiante.';


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

  -- Idempotencia: un reintento sobre una solicitud que ya resolvio esta misma
  -- operacion devuelve la practica que creo, no una segunda.
  if v_sol.estado = 'aprobada' and v_sol.practica_id is not null then
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
      practica_id = v_practica.id
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
      horas_aprobadas = case when v_sol.tipo_modificacion = 'horas' then v_horas else null end
  where id = v_sol.id
  returning * into v_sol;

  return v_sol;
end;
$fn$;


revoke all on function public.aprobar_solicitud_nueva_pps(uuid, integer, text)
  from public, anon;
grant execute on function public.aprobar_solicitud_nueva_pps(uuid, integer, text)
  to authenticated;

revoke all on function public.aprobar_solicitud_modificacion_pps(uuid, integer, text)
  from public, anon;
grant execute on function public.aprobar_solicitud_modificacion_pps(uuid, integer, text)
  to authenticated;

comment on function public.aprobar_solicitud_nueva_pps(uuid, integer, text) is
  'Aprobacion atomica de alta de PPS: crea la practica y resuelve la solicitud en una transaccion. Idempotente por practica_id.';
comment on function public.aprobar_solicitud_modificacion_pps(uuid, integer, text) is
  'Aprobacion atomica de modificacion: aplica las horas que define coordinacion y resuelve la solicitud en una transaccion. Las bajas van por su propia RPC.';
