-- Último recordatorio manual de consentimiento.
--
-- El envío inicia una ventana individual e improrrogable de 24 horas. La
-- ventana sólo puede abrirse si el cierre institucional vigente permite
-- cumplir las 24 horas completas. Mientras haya una ventana activa, la nómina
-- no puede cerrarse manualmente antes de lo prometido por correo.

alter table public.convocatorias
  add column if not exists final_reminder_sent_at timestamptz,
  add column if not exists final_reminder_sent_by uuid references auth.users(id) on delete set null,
  add column if not exists final_reminder_claimed_at timestamptz,
  add column if not exists final_reminder_claim_token uuid,
  add column if not exists final_reminder_claimed_by uuid references auth.users(id) on delete set null;

comment on column public.convocatorias.final_reminder_sent_at is
  'Último recordatorio manual entregado. Inicia una ventana individual de 24 horas para aceptar el compromiso.';
comment on column public.convocatorias.final_reminder_sent_by is
  'Usuario staff que solicitó el último recordatorio manual.';
comment on column public.convocatorias.final_reminder_claimed_at is
  'Reserva transitoria del envío para impedir duplicados concurrentes.';
comment on column public.convocatorias.final_reminder_claim_token is
  'Token transitorio que identifica el lote de envío en curso.';
comment on column public.convocatorias.final_reminder_claimed_by is
  'Usuario staff que reservó el envío en curso.';

create index if not exists convocatorias_final_reminder_pending_idx
  on public.convocatorias (lanzamiento_id, final_reminder_sent_at)
  where lower(trim(coalesce(estado_inscripcion, ''))) = 'seleccionado'
    and baja_automatica_at is null;

create or replace function public.reset_consentimiento_final_reminder_on_reselection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado_inscripcion is distinct from old.estado_inscripcion
     or new.selected_at is distinct from old.selected_at then
    new.final_reminder_sent_at := null;
    new.final_reminder_sent_by := null;
    new.final_reminder_claimed_at := null;
    new.final_reminder_claim_token := null;
    new.final_reminder_claimed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_consentimiento_final_reminder_on_reselection
  on public.convocatorias;
create trigger reset_consentimiento_final_reminder_on_reselection
before update of estado_inscripcion, selected_at on public.convocatorias
for each row
execute function public.reset_consentimiento_final_reminder_on_reselection();

create or replace function public.consentimiento_deadline_efectivo(
  p_fecha_inicio text,
  p_selected_at timestamptz,
  p_lista_entregada_at timestamptz default null,
  p_final_reminder_sent_at timestamptz default null
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    -- Una vez comunicado el último aviso, se respetan sus 24 horas completas.
    when p_final_reminder_sent_at is not null
      then p_final_reminder_sent_at + interval '24 hours'
    else public.consentimiento_deadline(
      p_fecha_inicio,
      p_selected_at,
      p_lista_entregada_at
    )
  end;
$$;

revoke all on function public.consentimiento_deadline_efectivo(text, timestamptz, timestamptz, timestamptz)
  from public;
grant execute on function public.consentimiento_deadline_efectivo(text, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

create or replace function public.claim_consentimiento_final_reminder_batch(
  p_lanzamiento_id uuid,
  p_actor_user_id uuid,
  p_claim_token uuid,
  p_requested_at timestamptz
)
returns table (
  convocatoria_id uuid,
  estudiante_nombre text,
  estudiante_correo text,
  pps_nombre text,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_launch public.lanzamientos_pps%rowtype;
  v_actor_role text;
  v_required_deadline timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;

  if p_lanzamiento_id is null
     or p_actor_user_id is null
     or p_claim_token is null
     or p_requested_at is null then
    raise exception 'Faltan datos para registrar el último recordatorio.' using errcode = '22023';
  end if;

  select e.role
  into v_actor_role
  from public.estudiantes e
  where e.user_id = p_actor_user_id
  limit 1;

  if v_actor_role is null
     or v_actor_role not in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester') then
    raise exception 'El usuario no tiene permisos para enviar este recordatorio.' using errcode = '42501';
  end if;

  -- Serializa este envío con el cierre manual de la nómina.
  select l.*
  into v_launch
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id
  for update;

  if v_launch.id is null then
    raise exception 'No se encontró el lanzamiento.' using errcode = 'P0002';
  end if;

  if v_launch.lista_estudiantes_entregada_at is not null then
    raise exception 'La lista institucional ya fue entregada; no se pueden abrir nuevos plazos.'
      using errcode = 'P0001';
  end if;

  v_required_deadline := p_requested_at + interval '24 hours';

  if exists (
    select 1
    from public.convocatorias c
    where c.lanzamiento_id = p_lanzamiento_id
      and lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
      and c.baja_automatica_at is null
      and c.final_reminder_sent_at is null
      and not exists (
        select 1
        from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and lower(trim(cp.estado)) = 'aceptado'
      )
      and (
        public.consentimiento_deadline(
          coalesce(v_launch.fecha_inicio, c.fecha_inicio),
          c.selected_at,
          v_launch.lista_estudiantes_entregada_at
        ) is null
        or public.consentimiento_deadline(
          coalesce(v_launch.fecha_inicio, c.fecha_inicio),
          c.selected_at,
          v_launch.lista_estudiantes_entregada_at
        ) < v_required_deadline
      )
  ) then
    raise exception 'No se puede prometer un plazo completo de 24 horas porque el cierre de la PPS ocurre antes.'
      using errcode = 'P0001';
  end if;

  return query
  with eligible as (
    select c.id
    from public.convocatorias c
    where c.lanzamiento_id = p_lanzamiento_id
      and lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
      and c.baja_automatica_at is null
      and c.final_reminder_sent_at is null
      and (
        c.final_reminder_claim_token is null
        or c.final_reminder_claimed_at < now() - interval '15 minutes'
      )
      and not exists (
        select 1
        from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and lower(trim(cp.estado)) = 'aceptado'
      )
      and not exists (
        select 1
        from public.practicas p
        where p.estudiante_id = c.estudiante_id
          and p.lanzamiento_id = c.lanzamiento_id
          and p.estado = 'Desaprobada'
      )
  ), claimed as (
    update public.convocatorias c
    set
      final_reminder_claimed_at = p_requested_at,
      final_reminder_claim_token = p_claim_token,
      final_reminder_claimed_by = p_actor_user_id
    from eligible x
    where c.id = x.id
    returning c.id, c.estudiante_id, c.correo, c.nombre_pps
  )
  select
    c.id,
    coalesce(e.nombre, 'Estudiante'),
    coalesce(nullif(trim(c.correo), ''), nullif(trim(e.correo), '')),
    coalesce(nullif(trim(c.nombre_pps), ''), nullif(trim(v_launch.nombre_pps), ''), 'PPS'),
    v_required_deadline
  from claimed c
  left join public.estudiantes e on e.id = c.estudiante_id
  order by 2;
end;
$$;

revoke all on function public.claim_consentimiento_final_reminder_batch(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_consentimiento_final_reminder_batch(uuid, uuid, uuid, timestamptz)
  to service_role;

create or replace function public.finish_consentimiento_final_reminder(
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
     or v_convocatoria.final_reminder_claim_token is distinct from p_claim_token then
    return false;
  end if;

  if p_sent
     and lower(trim(coalesce(v_convocatoria.estado_inscripcion, ''))) = 'seleccionado'
     and v_convocatoria.baja_automatica_at is null
     and not exists (
       select 1
       from public.compromisos_pps cp
       where cp.convocatoria_id = p_convocatoria_id
         and lower(trim(cp.estado)) = 'aceptado'
     ) then
    update public.convocatorias
    set
      final_reminder_sent_at = final_reminder_claimed_at,
      final_reminder_sent_by = final_reminder_claimed_by,
      reminder_sent_at = coalesce(reminder_sent_at, final_reminder_claimed_at),
      final_reminder_claimed_at = null,
      final_reminder_claim_token = null,
      final_reminder_claimed_by = null
    where id = p_convocatoria_id;
  else
    update public.convocatorias
    set
      final_reminder_claimed_at = null,
      final_reminder_claim_token = null,
      final_reminder_claimed_by = null
    where id = p_convocatoria_id;
  end if;

  return true;
end;
$$;

revoke all on function public.finish_consentimiento_final_reminder(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.finish_consentimiento_final_reminder(uuid, uuid, boolean)
  to service_role;

create or replace function public.get_consentimiento_timeout_candidates()
returns table(
  convocatoria_id uuid,
  estudiante_id uuid,
  lanzamiento_id uuid,
  estudiante_nombre text,
  estudiante_correo text,
  pps_nombre text,
  selected_at timestamptz,
  reminder_sent_at timestamptz,
  deadline_at timestamptz,
  reminder_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.estudiante_id,
    c.lanzamiento_id,
    coalesce(e.nombre, 'Estudiante'),
    coalesce(c.correo, e.correo),
    coalesce(c.nombre_pps, l.nombre_pps, 'PPS'),
    c.selected_at,
    c.reminder_sent_at,
    d.deadline_at,
    d.deadline_at - interval '48 hours'
  from public.convocatorias c
  join public.estudiantes e on e.id = c.estudiante_id
  left join public.lanzamientos_pps l on l.id = c.lanzamiento_id
  cross join lateral (
    select public.consentimiento_deadline_efectivo(
      coalesce(l.fecha_inicio, c.fecha_inicio),
      c.selected_at,
      l.lista_estudiantes_entregada_at,
      c.final_reminder_sent_at
    ) as deadline_at
  ) d
  where lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
    and c.selected_at is not null
    and c.baja_automatica_at is null
    and d.deadline_at is not null
    and not exists (
      select 1
      from public.compromisos_pps cp
      where cp.convocatoria_id = c.id
        and lower(trim(cp.estado)) = 'aceptado'
    )
    and not exists (
      select 1
      from public.practicas p
      where p.estudiante_id = c.estudiante_id
        and p.lanzamiento_id = c.lanzamiento_id
        and p.estado = 'Desaprobada'
    );
$$;

create or replace function public.claim_consentimiento_timeout_baja(p_convocatoria_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convocatoria public.convocatorias%rowtype;
  v_fecha_inicio text;
  v_lista_entregada_at timestamptz;
  v_deadline timestamptz;
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
     or lower(trim(coalesce(v_convocatoria.estado_inscripcion, ''))) <> 'seleccionado'
     or v_convocatoria.baja_automatica_at is not null
     or exists (
       select 1 from public.compromisos_pps cp
       where cp.convocatoria_id = p_convocatoria_id
         and lower(trim(cp.estado)) = 'aceptado'
     )
     or exists (
       select 1 from public.practicas p
       where p.estudiante_id = v_convocatoria.estudiante_id
         and p.lanzamiento_id = v_convocatoria.lanzamiento_id
         and p.estado = 'Desaprobada'
     ) then
    return false;
  end if;

  select
    coalesce(l.fecha_inicio, v_convocatoria.fecha_inicio),
    l.lista_estudiantes_entregada_at
  into v_fecha_inicio, v_lista_entregada_at
  from public.lanzamientos_pps l
  where l.id = v_convocatoria.lanzamiento_id;

  v_deadline := public.consentimiento_deadline_efectivo(
    v_fecha_inicio,
    v_convocatoria.selected_at,
    v_lista_entregada_at,
    v_convocatoria.final_reminder_sent_at
  );
  if v_deadline is null or now() < v_deadline then
    return false;
  end if;

  update public.convocatorias
  set estado_inscripcion = 'Inscripto', baja_automatica_at = now()
  where id = p_convocatoria_id;

  delete from public.practicas
  where estudiante_id = v_convocatoria.estudiante_id
    and lanzamiento_id = v_convocatoria.lanzamiento_id
    and estado = 'En curso';

  return true;
end;
$$;

create or replace function public.submit_compromiso_pps(
  p_convocatoria_id uuid,
  p_lanzamiento_id uuid,
  p_version text,
  p_texto_acta text,
  p_acepta_lectura boolean,
  p_acepta_compromiso boolean,
  p_nombre_completo text,
  p_dni integer,
  p_legajo text,
  p_firma_texto text
)
returns public.compromisos_pps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_estudiante public.estudiantes%rowtype;
  v_convocatoria public.convocatorias%rowtype;
  v_existing public.compromisos_pps%rowtype;
  v_result public.compromisos_pps%rowtype;
  v_fecha_inicio text;
  v_lista_entregada_at timestamptz;
  v_deadline timestamptz;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para confirmar el compromiso.' using errcode = '42501';
  end if;

  select e.* into v_estudiante
  from public.estudiantes e
  where e.user_id = v_user_id
  limit 1;

  if v_estudiante.id is null then
    raise exception 'No encontramos tu perfil de estudiante.' using errcode = '42501';
  end if;

  select c.* into v_convocatoria
  from public.convocatorias c
  where c.id = p_convocatoria_id
    and c.estudiante_id = v_estudiante.id
    and c.lanzamiento_id = p_lanzamiento_id
  for update;

  if v_convocatoria.id is null then
    raise exception 'La convocatoria no pertenece a tu cuenta o a esta PPS.' using errcode = '42501';
  end if;

  select cp.* into v_existing
  from public.compromisos_pps cp
  where cp.convocatoria_id = v_convocatoria.id
    and cp.estudiante_id = v_estudiante.id;

  if v_existing.id is not null and lower(trim(v_existing.estado)) = 'aceptado' then
    return v_existing;
  end if;

  if lower(trim(coalesce(v_convocatoria.estado_inscripcion, ''))) <> 'seleccionado'
     or v_convocatoria.baja_automatica_at is not null then
    raise exception 'Tu selección ya no está vigente.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.practicas p
    where p.estudiante_id = v_estudiante.id
      and p.lanzamiento_id = p_lanzamiento_id
      and p.estado = 'Desaprobada'
  ) then
    raise exception 'Esta PPS tiene un cierre académico y no admite una nueva firma.' using errcode = 'P0001';
  end if;

  select
    coalesce(l.fecha_inicio, v_convocatoria.fecha_inicio),
    l.lista_estudiantes_entregada_at
  into v_fecha_inicio, v_lista_entregada_at
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id;

  v_deadline := public.consentimiento_deadline_efectivo(
    v_fecha_inicio,
    v_convocatoria.selected_at,
    v_lista_entregada_at,
    v_convocatoria.final_reminder_sent_at
  );

  if v_deadline is null then
    raise exception 'La PPS todavía no tiene un plazo de confirmación válido. Contactá a Coordinación.' using errcode = 'P0001';
  end if;
  if now() >= v_deadline then
    raise exception 'El plazo para confirmar esta PPS ya finalizó.' using errcode = 'P0001';
  end if;
  if p_acepta_lectura is not true or p_acepta_compromiso is not true then
    raise exception 'Tenés que aceptar ambas declaraciones.' using errcode = '22023';
  end if;
  if nullif(trim(p_version), '') is null
     or nullif(trim(p_texto_acta), '') is null
     or nullif(trim(p_nombre_completo), '') is null
     or p_dni is null
     or nullif(trim(p_legajo), '') is null
     or nullif(trim(p_firma_texto), '') is null then
    raise exception 'Completá todos los datos de la firma.' using errcode = '22023';
  end if;
  if v_estudiante.dni is not null and p_dni <> v_estudiante.dni then
    raise exception 'El DNI no coincide con tu registro.' using errcode = '22023';
  end if;
  if v_estudiante.legajo is not null and trim(p_legajo) <> trim(v_estudiante.legajo) then
    raise exception 'El legajo no coincide con tu registro.' using errcode = '22023';
  end if;

  insert into public.compromisos_pps (
    estudiante_id, convocatoria_id, lanzamiento_id, version, estado, texto_acta,
    acepta_lectura, acepta_compromiso, nombre_completo, dni, legajo, firma_texto,
    accepted_at
  ) values (
    v_estudiante.id, v_convocatoria.id, p_lanzamiento_id, trim(p_version),
    'aceptado', p_texto_acta, true, true, trim(p_nombre_completo), p_dni,
    trim(p_legajo), trim(p_firma_texto), now()
  )
  on conflict (convocatoria_id) do update
  set
    version = excluded.version,
    estado = excluded.estado,
    texto_acta = excluded.texto_acta,
    acepta_lectura = excluded.acepta_lectura,
    acepta_compromiso = excluded.acepta_compromiso,
    nombre_completo = excluded.nombre_completo,
    dni = excluded.dni,
    legajo = excluded.legajo,
    firma_texto = excluded.firma_texto,
    accepted_at = excluded.accepted_at
  where public.compromisos_pps.estudiante_id = v_estudiante.id
    and public.compromisos_pps.lanzamiento_id = p_lanzamiento_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'No se pudo reconciliar una firma anterior para esta convocatoria.' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

create or replace function public.marcar_lista_estudiantes_entregada(p_lanzamiento_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_result timestamptz;
  v_blocked_until timestamptz;
begin
  select e.role into v_role
  from public.estudiantes e
  where e.user_id = auth.uid()
  limit 1;

  if v_role is null or v_role not in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester') then
    raise exception 'No tenés permisos para cerrar la lista institucional.' using errcode = '42501';
  end if;

  perform 1
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id
  for update;

  select max(c.final_reminder_sent_at + interval '24 hours')
  into v_blocked_until
  from public.convocatorias c
  where c.lanzamiento_id = p_lanzamiento_id
    and lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
    and c.baja_automatica_at is null
    and c.final_reminder_sent_at is not null
    and now() < c.final_reminder_sent_at + interval '24 hours'
    and not exists (
      select 1
      from public.compromisos_pps cp
      where cp.convocatoria_id = c.id
        and lower(trim(cp.estado)) = 'aceptado'
    );

  if v_blocked_until is not null then
    raise exception 'El último recordatorio prometió 24 horas. La lista podrá cerrarse después de %.',
      to_char(v_blocked_until at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI')
      using errcode = 'P0001';
  end if;

  update public.lanzamientos_pps
  set
    lista_estudiantes_entregada_at = coalesce(lista_estudiantes_entregada_at, now()),
    lista_estudiantes_entregada_por = coalesce(lista_estudiantes_entregada_por, auth.uid())
  where id = p_lanzamiento_id
  returning lista_estudiantes_entregada_at into v_result;

  if v_result is null then
    raise exception 'No se encontró el lanzamiento.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.claim_consentimiento_timeout_baja(uuid) from public;
grant execute on function public.claim_consentimiento_timeout_baja(uuid) to service_role;
revoke all on function public.get_consentimiento_timeout_candidates() from public;
grant execute on function public.get_consentimiento_timeout_candidates() to service_role;
revoke all on function public.submit_compromiso_pps(uuid, uuid, text, text, boolean, boolean, text, integer, text, text)
  from public;
grant execute on function public.submit_compromiso_pps(uuid, uuid, text, text, boolean, boolean, text, integer, text, text)
  to authenticated;
revoke all on function public.marcar_lista_estudiantes_entregada(uuid) from public;
grant execute on function public.marcar_lista_estudiantes_entregada(uuid) to authenticated;
