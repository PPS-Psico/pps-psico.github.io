-- Exención de consentimiento por estudiante ("perdonar la firma").
--
-- Coordinación necesita poder decidir que un estudiante concreto queda en la
-- nómina firme o no firme: casos con contacto por otro canal, firmas en papel,
-- problemas de acceso al panel. Hasta ahora la única salida era esperar el
-- vencimiento y que la baja automática lo sacara.
--
-- Se registra como una marca explícita y auditable en `convocatorias`, NO
-- fabricando una fila en `compromisos_pps`: esa tabla guarda el acta que el
-- estudiante aceptó y su firma, y el estudiante la ve como comprobante propio.
-- Un compromiso inventado por el panel sería una constancia falsa.
--
-- Un estudiante eximido:
--   * cuenta como resuelto en los conteos del Lanzador,
--   * queda fuera de los candidatos a baja automática,
--   * no recibe el último recordatorio,
--   * figura como cubierto en el listado de seleccionados.
-- Puede firmar igual si quiere: la exención no bloquea `submit_compromiso_pps`.

alter table public.convocatorias
  add column if not exists consentimiento_exceptuado_at timestamptz,
  add column if not exists consentimiento_exceptuado_por uuid references auth.users(id) on delete set null,
  add column if not exists consentimiento_exceptuado_motivo text;

comment on column public.convocatorias.consentimiento_exceptuado_at is
  'Momento en que Coordinación eximió a este estudiante de la firma digital. Mientras esté seteado no se le exige el compromiso ni se le aplica la baja automática.';
comment on column public.convocatorias.consentimiento_exceptuado_por is
  'Usuario staff que registró la exención.';
comment on column public.convocatorias.consentimiento_exceptuado_motivo is
  'Motivo libre de la exención, para auditoría.';

create index if not exists convocatorias_consentimiento_exceptuado_idx
  on public.convocatorias (lanzamiento_id)
  where consentimiento_exceptuado_at is not null;

-- ── Registrar / revertir la exención ────────────────────────────────────────

-- Además de marcar la exención, repone al estudiante si ya había sido dado de
-- baja por vencimiento: ese es exactamente el caso que Coordinación quiere
-- perdonar. Reponer `estado_inscripcion` alcanza en lanzamientos simples (lo
-- resuelve el trigger legacy); en los que tienen franjas hay que recrear la
-- práctica a mano, más abajo.
create or replace function public.eximir_consentimiento(
  p_convocatoria_id uuid,
  p_motivo text default null
)
returns public.convocatorias
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_convocatoria public.convocatorias%rowtype;
  v_result public.convocatorias%rowtype;
  v_launch public.lanzamientos_pps%rowtype;
  v_option public.lanzamiento_opciones%rowtype;
begin
  select e.role
  into v_role
  from public.estudiantes e
  where e.user_id = auth.uid()
  limit 1;

  if v_role is null or v_role not in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester') then
    raise exception 'No tenés permisos para eximir del consentimiento.' using errcode = '42501';
  end if;

  select c.*
  into v_convocatoria
  from public.convocatorias c
  where c.id = p_convocatoria_id
  for update;

  if v_convocatoria.id is null then
    raise exception 'No se encontró la inscripción.' using errcode = 'P0002';
  end if;

  -- Una desaprobación institucional es un cierre académico, no una firma
  -- pendiente: no se perdona desde acá.
  if exists (
    select 1
    from public.practicas p
    where p.estudiante_id = v_convocatoria.estudiante_id
      and p.lanzamiento_id = v_convocatoria.lanzamiento_id
      and p.estado = 'Desaprobada'
  ) then
    raise exception 'Esta PPS tiene un cierre académico para el estudiante y no admite exención.'
      using errcode = 'P0001';
  end if;

  update public.convocatorias
  set
    consentimiento_exceptuado_at = coalesce(consentimiento_exceptuado_at, now()),
    consentimiento_exceptuado_por = auth.uid(),
    consentimiento_exceptuado_motivo = nullif(btrim(coalesce(p_motivo, '')), ''),
    estado_inscripcion = 'Seleccionado',
    baja_automatica_at = null
  where id = p_convocatoria_id
  returning * into v_result;

  -- Reponer la práctica que la baja había borrado. En lanzamientos simples ya
  -- la recreó el trigger legacy `handle_seleccion_alumno` con este mismo
  -- UPDATE; en los que tienen franjas ese trigger se abstiene a propósito (ver
  -- 20260819235500), así que la reconstruimos con la opción que el estudiante
  -- ya tenía asignada — la baja no la borra.
  if v_convocatoria.baja_automatica_at is not null
     and not exists (
       select 1
       from public.practicas p
       where p.estudiante_id = v_result.estudiante_id
         and p.lanzamiento_id = v_result.lanzamiento_id
         and lower(coalesce(p.estado, '')) = 'en curso'
     ) then
    select * into v_launch
    from public.lanzamientos_pps
    where id = v_result.lanzamiento_id;

    if v_result.opcion_asignada_id is not null then
      select * into v_option
      from public.lanzamiento_opciones
      where id = v_result.opcion_asignada_id;
    end if;

    insert into public.practicas (
      estudiante_id, lanzamiento_id, opcion_id, opcion_horario_id, institucion_id,
      nombre_institucion, especialidad, fecha_inicio, fecha_finalizacion,
      horas_realizadas, estado, nota, informe_estado
    ) values (
      v_result.estudiante_id,
      v_result.lanzamiento_id,
      v_result.opcion_asignada_id,
      v_result.opcion_horario_asignado_id,
      case
        when v_launch.institucion_id ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then v_launch.institucion_id::uuid
        else null
      end,
      v_launch.nombre_pps,
      coalesce(v_option.orientacion, v_launch.orientacion),
      v_launch.fecha_inicio,
      case when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
      0, 'En curso', null, null
    );
  end if;

  return v_result;
end;
$$;

comment on function public.eximir_consentimiento(uuid, text) is
  'Exime a un estudiante de la firma digital y, si había sido dado de baja por vencimiento, lo repone en la nómina.';

revoke all on function public.eximir_consentimiento(uuid, text) from public, anon;
grant execute on function public.eximir_consentimiento(uuid, text) to authenticated;

-- Revertir deja al estudiante como estaba respecto de la firma: vuelve a
-- exigírsela. NO re-aplica la baja; si el plazo ya venció, el cron la procesa
-- en la próxima corrida como con cualquier otro pendiente.
create or replace function public.revertir_exencion_consentimiento(p_convocatoria_id uuid)
returns public.convocatorias
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_result public.convocatorias%rowtype;
begin
  select e.role
  into v_role
  from public.estudiantes e
  where e.user_id = auth.uid()
  limit 1;

  if v_role is null or v_role not in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester') then
    raise exception 'No tenés permisos para revertir la exención.' using errcode = '42501';
  end if;

  update public.convocatorias
  set
    consentimiento_exceptuado_at = null,
    consentimiento_exceptuado_por = null,
    consentimiento_exceptuado_motivo = null
  where id = p_convocatoria_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'No se encontró la inscripción.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

comment on function public.revertir_exencion_consentimiento(uuid) is
  'Quita la exención de firma de un estudiante; vuelve a contarlo como pendiente.';

revoke all on function public.revertir_exencion_consentimiento(uuid) from public, anon;
grant execute on function public.revertir_exencion_consentimiento(uuid) to authenticated;

-- ── Los consumidores del consentimiento reconocen la exención ────────────────

-- Conteos del sidebar y de la sala de firmas: un eximido está resuelto, y se
-- informa aparte cuántos lo están para que el avance no mienta.
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
      c.consentimiento_exceptuado_at is not null as eximido,
      not coalesce(l.consentimiento_requerido, true)
        or c.consentimiento_exceptuado_at is not null
        or exists (
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
      count(*) filter (where vigente)::integer as seleccionados_vigentes,
      count(*) filter (where eximido)::integer as eximidos
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
        'eximidos', eximidos,
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

-- Candidatos a baja automática: un eximido nunca lo es.
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
    and c.consentimiento_exceptuado_at is null
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

-- Toma atómica de la baja: la exención se revalida bajo lock, igual que la
-- firma, para que perdonar a alguien mientras corre el cron no llegue tarde.
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
     or v_convocatoria.consentimiento_exceptuado_at is not null
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

-- Listado de seleccionados (lo consumen admin y estudiantes): el eximido
-- aparece como cubierto, sin fecha de aceptación porque no firmó.
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
      or c.consentimiento_exceptuado_at is not null
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

-- Último recordatorio: no se le manda a quien ya fue eximido, ni su plazo
-- bloquea el cierre de la nómina.
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
      and c.consentimiento_exceptuado_at is null
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
      and c.consentimiento_exceptuado_at is null
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
