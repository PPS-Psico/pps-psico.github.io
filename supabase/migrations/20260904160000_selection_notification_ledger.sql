-- Avisar que quedaste seleccionado deja de depender de una pestaña abierta.
--
-- QUÉ PASABA
-- Al cerrar la mesa, el navegador del admin mandaba un mail y dos push por cada
-- estudiante con `Promise.all`, y el llamador soltaba la promesa con
-- `void notificationTask.catch(...)`. No había columna que dijera a quién se le
-- había mandado, ni reintento, ni idempotencia. Si se cerraba la pestaña o se
-- cortaba la red a mitad de camino, un subconjunto de estudiantes quedaba sin
-- avisar y NO había forma de saber cuáles. Volver a cerrar la mesa les
-- reescribía a todos.
--
-- CÓMO SE ARREGLA
-- El mismo patrón que ya usa el último recordatorio de consentimiento
-- (20260807153000): un claim bajo lock, el envío desde una Edge Function con
-- service_role, y una marca por convocatoria. El envío se vuelve idempotente y
-- reintentable, y queda el registro de quién recibió qué.
--
-- EL BACKFILL NO ES OPCIONAL
-- Las convocatorias ya seleccionadas fueron notificadas por el camino viejo,
-- que no dejó rastro. Si arrancaran con la marca en NULL, el primer
-- "reintentar avisos pendientes" le escribiría de nuevo a todos los
-- seleccionados de la historia. Se las marca como notificadas usando su
-- `selected_at`, que es la fecha real en que se les avisó.

alter table public.convocatorias
  add column if not exists seleccion_notificada_at timestamptz,
  add column if not exists seleccion_notificada_por uuid references auth.users(id) on delete set null,
  add column if not exists seleccion_notificacion_claimed_at timestamptz,
  add column if not exists seleccion_notificacion_claim_token uuid,
  add column if not exists seleccion_notificacion_claimed_by uuid references auth.users(id) on delete set null;

comment on column public.convocatorias.seleccion_notificada_at is
  'Momento en que se le avisó al estudiante que quedó seleccionado. NULL = todavía no se le avisó; es la cola de pendientes que puede reintentarse sin duplicar envíos.';
comment on column public.convocatorias.seleccion_notificada_por is
  'Usuario staff que disparó el aviso.';
comment on column public.convocatorias.seleccion_notificacion_claim_token is
  'Reserva transitoria del envío, para que dos corridas simultáneas no le escriban dos veces al mismo estudiante.';

-- Cola de pendientes: es la consulta caliente de la Edge Function.
create index if not exists convocatorias_seleccion_notificacion_pendiente_idx
  on public.convocatorias (lanzamiento_id)
  where seleccion_notificada_at is null
    and lower(trim(coalesce(estado_inscripcion, ''))) = 'seleccionado'
    and baja_automatica_at is null;

-- Backfill: todo lo ya seleccionado se da por avisado. `selected_at` es cuándo
-- realmente se le mandó el correo por el camino viejo; para las filas legacy sin
-- esa fecha se usa `created_at`, que es lo más cercano que hay.
update public.convocatorias
set seleccion_notificada_at = coalesce(selected_at, created_at, now())
where seleccion_notificada_at is null
  and lower(trim(coalesce(estado_inscripcion, ''))) = 'seleccionado';

-- ── Reservar el lote de envío ───────────────────────────────────────────────
--
-- Devuelve solo lo que falta avisar y lo reserva en la misma transacción. Una
-- reserva de más de 15 minutos se considera abandonada (proceso caído) y vuelve
-- a estar disponible, igual que en el recordatorio final.
create or replace function public.claim_seleccion_notificacion_batch(
  p_lanzamiento_id uuid,
  p_actor_user_id uuid,
  p_claim_token uuid,
  p_requested_at timestamptz
)
returns table(
  convocatoria_id uuid,
  estudiante_nombre text,
  estudiante_correo text,
  estudiante_user_id uuid,
  pps_nombre text,
  horario text,
  encuentro_inicial timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_launch public.lanzamientos_pps%rowtype;
  v_actor_role text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;

  if p_lanzamiento_id is null
     or p_actor_user_id is null
     or p_claim_token is null
     or p_requested_at is null then
    raise exception 'Faltan datos para registrar el aviso de selección.' using errcode = '22023';
  end if;

  select e.role
  into v_actor_role
  from public.estudiantes e
  where e.user_id = p_actor_user_id
  limit 1;

  if v_actor_role is null
     or v_actor_role not in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester') then
    raise exception 'El usuario no tiene permisos para avisar seleccionados.' using errcode = '42501';
  end if;

  select l.*
  into v_launch
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id
  for update;

  if v_launch.id is null then
    raise exception 'No se encontró el lanzamiento.' using errcode = 'P0002';
  end if;

  return query
  with eligible as (
    select c.id
    from public.convocatorias c
    where c.lanzamiento_id = p_lanzamiento_id
      and lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
      and c.baja_automatica_at is null
      and c.seleccion_notificada_at is null
      and (
        c.seleccion_notificacion_claim_token is null
        or c.seleccion_notificacion_claimed_at < now() - interval '15 minutes'
      )
  ), claimed as (
    update public.convocatorias c
    set seleccion_notificacion_claimed_at = p_requested_at,
        seleccion_notificacion_claim_token = p_claim_token,
        seleccion_notificacion_claimed_by = p_actor_user_id
    from eligible x
    where c.id = x.id
    returning c.id, c.estudiante_id, c.correo, c.horario_asignado, c.horario_seleccionado
  )
  select
    c.id,
    coalesce(e.nombre, 'Estudiante'),
    coalesce(nullif(trim(c.correo), ''), nullif(trim(e.correo), '')),
    e.user_id,
    coalesce(nullif(trim(v_launch.nombre_pps), ''), 'PPS'),
    coalesce(
      nullif(trim(c.horario_asignado), ''),
      nullif(trim(c.horario_seleccionado), ''),
      nullif(trim(v_launch.horario_seleccionado), '')
    ),
    v_launch.fecha_encuentro_inicial
  from claimed c
  left join public.estudiantes e on e.id = c.estudiante_id
  order by 2;
end;
$$;

comment on function public.claim_seleccion_notificacion_batch(uuid, uuid, uuid, timestamptz) is
  'Reserva bajo lock los avisos de selección pendientes de un lanzamiento y devuelve los datos para enviarlos.';

revoke all on function public.claim_seleccion_notificacion_batch(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_seleccion_notificacion_batch(uuid, uuid, uuid, timestamptz)
  to service_role;

-- ── Cerrar o liberar la reserva ─────────────────────────────────────────────
--
-- `p_sent = true` persiste el aviso; `false` libera la reserva para que el
-- próximo intento lo vuelva a tomar. Nunca marca como avisado a alguien cuya
-- selección dejó de estar vigente entre el claim y el envío.
create or replace function public.finish_seleccion_notificacion(
  p_convocatoria_id uuid,
  p_claim_token uuid,
  p_sent boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convocatoria public.convocatorias%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;

  select c.*
  into v_convocatoria
  from public.convocatorias c
  where c.id = p_convocatoria_id
  for update;

  if v_convocatoria.id is null
     or v_convocatoria.seleccion_notificacion_claim_token is distinct from p_claim_token then
    return false;
  end if;

  if p_sent
     and lower(trim(coalesce(v_convocatoria.estado_inscripcion, ''))) = 'seleccionado'
     and v_convocatoria.baja_automatica_at is null then
    update public.convocatorias
    set
      seleccion_notificada_at = coalesce(seleccion_notificacion_claimed_at, now()),
      seleccion_notificada_por = seleccion_notificacion_claimed_by,
      seleccion_notificacion_claimed_at = null,
      seleccion_notificacion_claim_token = null,
      seleccion_notificacion_claimed_by = null
    where id = p_convocatoria_id;
  else
    update public.convocatorias
    set
      seleccion_notificacion_claimed_at = null,
      seleccion_notificacion_claim_token = null,
      seleccion_notificacion_claimed_by = null
    where id = p_convocatoria_id;
  end if;

  return true;
end;
$$;

comment on function public.finish_seleccion_notificacion(uuid, uuid, boolean) is
  'Cierra la reserva de un aviso de selección: la persiste si el envío salió, o la libera para reintentar.';

revoke all on function public.finish_seleccion_notificacion(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.finish_seleccion_notificacion(uuid, uuid, boolean) to service_role;
