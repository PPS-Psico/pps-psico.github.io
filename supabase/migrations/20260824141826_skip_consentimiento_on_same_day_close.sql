alter table public.lanzamientos_pps
  add column if not exists consentimiento_requerido boolean not null default true;

comment on column public.lanzamientos_pps.consentimiento_requerido is
  'Decisión persistida al cerrar la mesa. False cuando el cierre ocurre el mismo día del inicio o después; omite firma, correos y bajas automáticas.';

-- Reconciliar únicamente lanzamientos todavía vigentes. No reinterpretamos
-- historia cerrada: la regla empieza a regir operativamente desde este cambio.
update public.lanzamientos_pps
set consentimiento_requerido = false
where selection_closed_at is not null
  and substring(trim(coalesce(fecha_inicio, '')) from '^\d{4}-\d{2}-\d{2}') is not null
  and substring(trim(fecha_inicio) from 1 for 10)::date <=
      (selection_closed_at at time zone 'America/Argentina/Buenos_Aires')::date
  and (
    fecha_finalizacion is null
    or substring(trim(coalesce(fecha_finalizacion, '')) from '^\d{4}-\d{2}-\d{2}') is null
    or substring(trim(fecha_finalizacion) from 1 for 10)::date >= current_date
  );

create or replace function public.close_selection(p_lanzamiento_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_not_selected integer := 0;
  v_selected integer := 0;
  v_launches integer := 0;
  v_fecha_inicio text;
  v_consentimiento_requerido boolean := true;
begin
  select l.fecha_inicio
  into v_fecha_inicio
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id
  for update;

  if substring(trim(coalesce(v_fecha_inicio, '')) from '^\d{4}-\d{2}-\d{2}') is not null then
    v_consentimiento_requerido :=
      substring(trim(v_fecha_inicio) from 1 for 10)::date >
      (v_now at time zone 'America/Argentina/Buenos_Aires')::date;
  end if;

  update public.convocatorias
  set selection_decided_at = coalesce(selection_decided_at, v_now)
  where lanzamiento_id = p_lanzamiento_id
    and estado_inscripcion = 'Seleccionado';
  get diagnostics v_selected = row_count;

  update public.convocatorias
  set estado_inscripcion = 'No Seleccionado',
      selection_decided_at = v_now
  where lanzamiento_id = p_lanzamiento_id
    and estado_inscripcion = 'Inscripto';
  get diagnostics v_not_selected = row_count;

  update public.lanzamientos_pps
  set estado_convocatoria = 'Cerrado',
      estado_gestion = 'Relanzamiento Confirmado',
      selection_closed_at = v_now,
      selection_closed_by = auth.uid(),
      consentimiento_requerido = v_consentimiento_requerido
  where id = p_lanzamiento_id;
  get diagnostics v_launches = row_count;

  if v_launches <> 1 then
    raise exception 'No se pudo cerrar el lanzamiento %', p_lanzamiento_id;
  end if;

  return jsonb_build_object(
    'lanzamiento_id', p_lanzamiento_id,
    'closed_at', v_now,
    'selected', v_selected,
    'not_selected', v_not_selected,
    'consentimiento_requerido', v_consentimiento_requerido
  );
end;
$function$;

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
as $function$
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
  join public.lanzamientos_pps l on l.id = c.lanzamiento_id
  cross join lateral (
    select public.consentimiento_deadline_efectivo(
      coalesce(l.fecha_inicio, c.fecha_inicio),
      c.selected_at,
      l.lista_estudiantes_entregada_at,
      c.final_reminder_sent_at
    ) as deadline_at
  ) d
  where coalesce(l.consentimiento_requerido, true)
    and lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
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
$function$;

create or replace function public.claim_consentimiento_timeout_baja(p_convocatoria_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_convocatoria public.convocatorias%rowtype;
  v_fecha_inicio text;
  v_lista_entregada_at timestamptz;
  v_consentimiento_requerido boolean;
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
    l.lista_estudiantes_entregada_at,
    coalesce(l.consentimiento_requerido, true)
  into v_fecha_inicio, v_lista_entregada_at, v_consentimiento_requerido
  from public.lanzamientos_pps l
  where l.id = v_convocatoria.lanzamiento_id;

  if not coalesce(v_consentimiento_requerido, true) then
    return false;
  end if;

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
$function$;

create or replace function public.get_consent_counts_by_launch(p_launch_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if session_user <> 'postgres'
     and coalesce(auth.role(), '') <> 'service_role'
     and not exists (
       select 1
       from public.estudiantes e
       where e.user_id = auth.uid()
         and e.role in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester', 'Reportero')
     ) then
    raise exception 'No tenés permisos para consultar estos conteos.' using errcode = '42501';
  end if;

  with roster as (
    select
      c.id,
      c.lanzamiento_id,
      coalesce(l.consentimiento_requerido, true) as requerido,
      lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado' as vigente,
      c.baja_automatica_at is not null as baja,
      not coalesce(l.consentimiento_requerido, true) or exists (
        select 1
        from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and lower(trim(cp.estado)) = 'aceptado'
      ) as aceptado
    from public.convocatorias c
    join public.lanzamientos_pps l on l.id = c.lanzamiento_id
    where c.lanzamiento_id = any(p_launch_ids)
      and (
        lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
        or c.baja_automatica_at is not null
      )
  ), grouped as (
    select
      lanzamiento_id,
      bool_and(requerido) as requerido,
      count(*) filter (where aceptado)::integer as aceptados,
      count(*)::integer as total,
      count(*) filter (where vigente and not aceptado)::integer as pendientes,
      count(*) filter (where not vigente and baja and not aceptado)::integer as bajas,
      count(*) filter (where vigente)::integer as seleccionados_vigentes
    from roster
    group by lanzamiento_id
  )
  select coalesce(
    jsonb_object_agg(
      lanzamiento_id::text,
      jsonb_build_object(
        'aceptados', aceptados,
        'total', total,
        'pendientes', pendientes,
        'bajas', bajas,
        'seleccionados_vigentes', seleccionados_vigentes,
        'requerido', requerido
      )
    ),
    '{}'::jsonb
  )
  into v_result
  from grouped;

  return v_result;
end;
$function$;

create or replace function public.get_seleccionados_for_launch(p_lanzamiento_id uuid)
returns table(
  convocatoria_id uuid,
  horario text,
  nombre text,
  legajo text,
  firmo boolean,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  select
    c.id,
    coalesce(c.horario_asignado, c.horario_seleccionado, 'No especificado'),
    coalesce(e.nombre, 'Estudiante'),
    coalesce(e.legajo::text, '---'),
    not coalesce(l.consentimiento_requerido, true)
      or (cp.id is not null and lower(cp.estado) = 'aceptado'),
    cp.accepted_at
  from public.convocatorias c
  join public.lanzamientos_pps l on l.id = c.lanzamiento_id
  left join public.estudiantes e on e.id = c.estudiante_id
  left join public.compromisos_pps cp on cp.convocatoria_id = c.id
  where c.lanzamiento_id = p_lanzamiento_id
    and (
      lower(c.estado_inscripcion) = 'seleccionado'
      or lower(c.estado_inscripcion) like '%asignado%'
    )
  order by 2, 3;
end;
$function$;

-- El envío manual del último aviso también debe respetar la decisión de cierre.
-- Se reemplaza la función completa para mantener el claim atómico existente.
create or replace function public.claim_consentimiento_final_reminder_batch(
  p_lanzamiento_id uuid,
  p_actor_user_id uuid,
  p_claim_token uuid,
  p_requested_at timestamptz
)
returns table(
  convocatoria_id uuid,
  estudiante_nombre text,
  estudiante_correo text,
  pps_nombre text,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
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

  select l.*
  into v_launch
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id
  for update;

  if v_launch.id is null then
    raise exception 'No se encontró el lanzamiento.' using errcode = 'P0002';
  end if;

  if not coalesce(v_launch.consentimiento_requerido, true) then
    raise exception 'Este lanzamiento cerró el día de inicio y no requiere consentimiento.'
      using errcode = 'P0001';
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
        select 1 from public.compromisos_pps cp
        where cp.convocatoria_id = c.id and lower(trim(cp.estado)) = 'aceptado'
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
        select 1 from public.compromisos_pps cp
        where cp.convocatoria_id = c.id and lower(trim(cp.estado)) = 'aceptado'
      )
      and not exists (
        select 1 from public.practicas p
        where p.estudiante_id = c.estudiante_id
          and p.lanzamiento_id = c.lanzamiento_id
          and p.estado = 'Desaprobada'
      )
  ), claimed as (
    update public.convocatorias c
    set final_reminder_claimed_at = p_requested_at,
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
$function$;
