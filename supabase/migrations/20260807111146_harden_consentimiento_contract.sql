-- Contrato único del consentimiento digital.
--
-- La fecha de inicio se almacena como texto/date en distintas generaciones de
-- datos. Para evitar que un cast UTC desplace el cierre a las 21:00 del día
-- anterior, siempre interpretamos la fecha calendario a las 00:00 de Buenos
-- Aires. El mismo helper alimenta conteos, firma y baja automática.

alter table public.lanzamientos_pps
  add column if not exists lista_estudiantes_entregada_at timestamptz,
  add column if not exists lista_estudiantes_entregada_por uuid references auth.users(id);

comment on column public.lanzamientos_pps.lista_estudiantes_entregada_at is
  'Momento en que Coordinación entregó la nómina a la institución; desde entonces no se admiten nuevas firmas.';

create or replace function public.consentimiento_deadline(
  p_fecha_inicio text,
  p_selected_at timestamptz,
  p_lista_entregada_at timestamptz default null
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_date date;
  v_start timestamptz;
begin
  if p_fecha_inicio is null or p_selected_at is null then
    return null;
  end if;

  if substring(trim(p_fecha_inicio) from '^\d{4}-\d{2}-\d{2}') is null then
    return null;
  end if;

  v_date := substring(trim(p_fecha_inicio) from 1 for 10)::date;
  v_start := make_timestamptz(
    extract(year from v_date)::integer,
    extract(month from v_date)::integer,
    extract(day from v_date)::integer,
    0,
    0,
    0,
    'America/Argentina/Buenos_Aires'
  );

  if p_selected_at <= v_start - interval '24 hours' then
    v_start := v_start - interval '24 hours';
  end if;

  if p_lista_entregada_at is not null then
    return least(v_start, p_lista_entregada_at);
  end if;

  return v_start;
exception
  when others then
    return null;
end;
$$;

comment on function public.consentimiento_deadline(text, timestamptz, timestamptz) is
  'Calcula el cierre: 24 h antes del inicio local (o al inicio si la selección fue tardía) o cuando se entregó la lista, lo que ocurra primero.';

revoke all on function public.consentimiento_deadline(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.consentimiento_deadline(text, timestamptz, timestamptz)
  to authenticated, service_role;

-- El denominador es el roster real: seleccionados vigentes más bajas
-- automáticas. Antes se contaban filas de compromisos y por eso 25 firmas se
-- mostraban erróneamente como 25/25 aunque hubiera 37 seleccionados.
drop function if exists public.get_consent_counts_by_launch(uuid[]);

create or replace function public.get_consent_counts_by_launch(p_launch_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with roster as (
    select
      c.id,
      c.lanzamiento_id,
      lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado' as vigente,
      c.baja_automatica_at is not null as baja,
      exists (
        select 1
        from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and lower(trim(cp.estado)) = 'aceptado'
      ) as aceptado
    from public.convocatorias c
    where c.lanzamiento_id = any(p_launch_ids)
      and (
        lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
        or c.baja_automatica_at is not null
      )
  ), grouped as (
    select
      lanzamiento_id,
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
        'seleccionados_vigentes', seleccionados_vigentes
      )
    ),
    '{}'::jsonb
  )
  from grouped;
$$;

comment on function public.get_consent_counts_by_launch(uuid[]) is
  'Conteos reconciliados contra el roster: aceptados, total histórico seleccionado, pendientes vigentes, bajas y seleccionados vigentes.';

revoke all on function public.get_consent_counts_by_launch(uuid[]) from public, anon;
grant execute on function public.get_consent_counts_by_launch(uuid[])
  to authenticated, service_role;

-- Las firmas de estudiantes pasan exclusivamente por este RPC. Así la
-- verificación del usuario, la selección vigente y el plazo ocurren en la
-- misma transacción que la escritura.
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
  v_deadline timestamptz;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para confirmar el compromiso.' using errcode = '42501';
  end if;

  select e.*
  into v_estudiante
  from public.estudiantes e
  where e.user_id = v_user_id
  limit 1;

  if v_estudiante.id is null then
    raise exception 'No encontramos tu perfil de estudiante.' using errcode = '42501';
  end if;

  select c.*
  into v_convocatoria
  from public.convocatorias c
  where c.id = p_convocatoria_id
    and c.estudiante_id = v_estudiante.id
    and c.lanzamiento_id = p_lanzamiento_id
  for update;

  if v_convocatoria.id is null then
    raise exception 'La convocatoria no pertenece a tu cuenta o a esta PPS.' using errcode = '42501';
  end if;

  select cp.*
  into v_existing
  from public.compromisos_pps cp
  where cp.convocatoria_id = v_convocatoria.id
    and cp.estudiante_id = v_estudiante.id;

  -- Reintentos idempotentes: si la firma ya quedó registrada, devolvemos la
  -- constancia incluso si el plazo venció entre la respuesta y el reintento.
  if v_existing.id is not null and lower(trim(v_existing.estado)) = 'aceptado' then
    return v_existing;
  end if;

  if lower(trim(coalesce(v_convocatoria.estado_inscripcion, ''))) <> 'seleccionado'
     or v_convocatoria.baja_automatica_at is not null then
    raise exception 'Tu selección ya no está vigente.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.practicas p
    where p.estudiante_id = v_estudiante.id
      and p.lanzamiento_id = p_lanzamiento_id
      and p.estado = 'Desaprobada'
  ) then
    raise exception 'Esta PPS tiene un cierre académico y no admite una nueva firma.' using errcode = 'P0001';
  end if;

  select coalesce(l.fecha_inicio, v_convocatoria.fecha_inicio)
  into v_fecha_inicio
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id;

  v_deadline := public.consentimiento_deadline(
    v_fecha_inicio,
    v_convocatoria.selected_at,
    (
      select l.lista_estudiantes_entregada_at
      from public.lanzamientos_pps l
      where l.id = p_lanzamiento_id
    )
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
    estudiante_id,
    convocatoria_id,
    lanzamiento_id,
    version,
    estado,
    texto_acta,
    acepta_lectura,
    acepta_compromiso,
    nombre_completo,
    dni,
    legajo,
    firma_texto,
    accepted_at
  ) values (
    v_estudiante.id,
    v_convocatoria.id,
    p_lanzamiento_id,
    trim(p_version),
    'aceptado',
    p_texto_acta,
    true,
    true,
    trim(p_nombre_completo),
    p_dni,
    trim(p_legajo),
    trim(p_firma_texto),
    now()
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

comment on function public.submit_compromiso_pps(uuid, uuid, text, text, boolean, boolean, text, integer, text, text) is
  'Registra el compromiso de forma atómica después de validar identidad, selección vigente, datos personales y plazo.';

revoke all on function public.submit_compromiso_pps(uuid, uuid, text, text, boolean, boolean, text, integer, text, text)
  from public, anon;
grant execute on function public.submit_compromiso_pps(uuid, uuid, text, text, boolean, boolean, text, integer, text, text)
  to authenticated;

drop policy if exists "compromisos_pps_insert_own_or_admin" on public.compromisos_pps;
drop policy if exists "compromisos_pps_update_own_or_admin" on public.compromisos_pps;

create policy "compromisos_pps_insert_admin"
on public.compromisos_pps
for insert
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.user_id = (select auth.uid())
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  )
);

create policy "compromisos_pps_update_admin"
on public.compromisos_pps
for update
using (
  exists (
    select 1
    from public.estudiantes e
    where e.user_id = (select auth.uid())
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  )
)
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.user_id = (select auth.uid())
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  )
);

-- Fuente segura y compacta para la Edge Function. Devuelve solamente casos
-- vigentes sin firma y con una fecha de cierre calculable.
create or replace function public.get_consentimiento_timeout_candidates()
returns table (
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
    select public.consentimiento_deadline(
      coalesce(l.fecha_inicio, c.fecha_inicio),
      c.selected_at,
      l.lista_estudiantes_entregada_at
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

revoke all on function public.get_consentimiento_timeout_candidates() from public, anon, authenticated;
grant execute on function public.get_consentimiento_timeout_candidates() to service_role;

-- Revalida y toma la baja bajo lock para que una firma simultánea nunca sea
-- eliminada por una lectura vieja de la Edge Function.
create or replace function public.claim_consentimiento_timeout_baja(p_convocatoria_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convocatoria public.convocatorias%rowtype;
  v_fecha_inicio text;
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

  select coalesce(l.fecha_inicio, v_convocatoria.fecha_inicio)
  into v_fecha_inicio
  from public.lanzamientos_pps l
  where l.id = v_convocatoria.lanzamiento_id;

  v_deadline := public.consentimiento_deadline(
    v_fecha_inicio,
    v_convocatoria.selected_at,
    (
      select l.lista_estudiantes_entregada_at
      from public.lanzamientos_pps l
      where l.id = v_convocatoria.lanzamiento_id
    )
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

revoke all on function public.claim_consentimiento_timeout_baja(uuid) from public, anon, authenticated;
grant execute on function public.claim_consentimiento_timeout_baja(uuid) to service_role;

comment on function public.claim_consentimiento_timeout_baja(uuid) is
  'Aplica atómicamente una baja vencida, revalidando firma, estado y antecedentes académicos bajo lock.';

-- Esta marca expresa la segunda condición de cierre. No envía la lista: se
-- registra inmediatamente después de que Coordinación la entrega por el canal
-- institucional y la Edge Function procesa las bajas en el mismo flujo de
-- notificaciones que el cierre por fecha.
create or replace function public.marcar_lista_estudiantes_entregada(p_lanzamiento_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_result timestamptz;
begin
  select e.role
  into v_role
  from public.estudiantes e
  where e.user_id = auth.uid()
  limit 1;

  if v_role is null or v_role not in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester') then
    raise exception 'No tenés permisos para cerrar la lista institucional.' using errcode = '42501';
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

revoke all on function public.marcar_lista_estudiantes_entregada(uuid) from public, anon;
grant execute on function public.marcar_lista_estudiantes_entregada(uuid) to authenticated;

comment on function public.marcar_lista_estudiantes_entregada(uuid) is
  'Registra de forma idempotente la entrega institucional de la nómina y cierra nuevas firmas para ese lanzamiento.';
