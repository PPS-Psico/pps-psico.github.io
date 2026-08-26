begin;

-- La solicitud de baja debe sobrevivir a la eliminación operativa de la
-- práctica. Conserva snapshots suficientes para que coordinación y el alumno
-- puedan auditar qué se pidió, cuándo y cómo se resolvió.
alter table public.solicitudes_modificacion_pps
  alter column practica_id drop not null,
  add column if not exists motivo_baja text,
  add column if not exists motivo_baja_detalle text,
  add column if not exists convocatoria_id uuid
    references public.convocatorias(id) on delete set null,
  add column if not exists lanzamiento_id uuid
    references public.lanzamientos_pps(id) on delete set null,
  add column if not exists nombre_pps_snapshot text,
  add column if not exists fecha_inicio_snapshot date,
  add column if not exists estado_practica_snapshot text,
  add column if not exists resuelta_at timestamptz,
  add column if not exists resuelta_por uuid
    references auth.users(id) on delete set null,
  add column if not exists penalizacion_id uuid
    references public.penalizaciones(id) on delete set null,
  add column if not exists tipo_penalizacion_aplicada text,
  add column if not exists puntaje_penalizacion_aplicado numeric;

alter table public.solicitudes_modificacion_pps
  drop constraint if exists solicitudes_modificacion_pps_practica_id_fkey;

alter table public.solicitudes_modificacion_pps
  add constraint solicitudes_modificacion_pps_practica_id_fkey
  foreign key (practica_id)
  references public.practicas(id)
  on delete set null;

alter table public.solicitudes_modificacion_pps
  drop constraint if exists solicitudes_modificacion_pps_baja_motivo_check;

alter table public.solicitudes_modificacion_pps
  add constraint solicitudes_modificacion_pps_baja_motivo_check
  check (
    tipo_modificacion <> 'eliminacion'
    or (
      motivo_baja in (
        'salud',
        'personal_familiar',
        'laboral',
        'academico',
        'inconveniente_institucional',
        'otro'
      )
      and char_length(btrim(coalesce(motivo_baja_detalle, ''))) between 10 and 2000
    )
  );

alter table public.solicitudes_modificacion_pps
  drop constraint if exists solicitudes_modificacion_pps_resolucion_check;

alter table public.solicitudes_modificacion_pps
  add constraint solicitudes_modificacion_pps_resolucion_check
  check (
    tipo_modificacion <> 'eliminacion'
    or (estado = 'pendiente' and resuelta_at is null and resuelta_por is null)
    or (estado in ('aprobada', 'rechazada') and resuelta_at is not null)
  ) not valid;

-- Las 13 solicitudes históricas son de horas y pueden estar aprobadas sin los
-- metadatos de resolución nuevos. La validación se aplica a las filas nuevas.
create unique index if not exists uq_solicitud_baja_pendiente_por_practica
  on public.solicitudes_modificacion_pps (practica_id)
  where tipo_modificacion = 'eliminacion'
    and estado = 'pendiente'
    and practica_id is not null;

create index if not exists idx_solicitudes_mod_convocatoria
  on public.solicitudes_modificacion_pps (convocatoria_id)
  where convocatoria_id is not null;

create index if not exists idx_solicitudes_mod_lanzamiento
  on public.solicitudes_modificacion_pps (lanzamiento_id)
  where lanzamiento_id is not null;

create index if not exists idx_solicitudes_mod_penalizacion
  on public.solicitudes_modificacion_pps (penalizacion_id)
  where penalizacion_id is not null;

-- La policy histórica sólo verificaba estudiante_id. También exigimos que la
-- práctica indicada pertenezca a ese mismo estudiante.
drop policy if exists "Users and admins can create own or student modification request"
  on public.solicitudes_modificacion_pps;

create policy "Users and admins can create own or student modification request"
on public.solicitudes_modificacion_pps
for insert
to authenticated
with check (
  (select public.is_admin())
  or (
    exists (
      select 1
      from public.estudiantes as e
      where e.id = solicitudes_modificacion_pps.estudiante_id
        and e.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.practicas as p
      where p.id = solicitudes_modificacion_pps.practica_id
        and p.estudiante_id = solicitudes_modificacion_pps.estudiante_id
    )
  )
);

create or replace function public.create_my_solicitud_baja_pps_v1(
  p_practica_id uuid,
  p_motivo_baja text,
  p_motivo_baja_detalle text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_practica public.practicas%rowtype;
  v_convocatoria_id uuid;
  v_launch_name text;
  v_launch_start text;
  v_solicitud_id uuid;
  v_motivo text := btrim(coalesce(p_motivo_baja, ''));
  v_detalle text := btrim(coalesce(p_motivo_baja_detalle, ''));
begin
  select e.id
  into v_student_id
  from public.estudiantes as e
  where e.user_id = (select auth.uid())
  order by e.id
  limit 1;

  if v_student_id is null then
    raise exception 'No se pudo identificar al estudiante autenticado.'
      using errcode = '42501';
  end if;

  select p.*
  into v_practica
  from public.practicas as p
  where p.id = p_practica_id
    and p.estudiante_id = v_student_id;

  if not found then
    raise exception 'La práctica no pertenece al estudiante autenticado.'
      using errcode = '42501';
  end if;

  if v_practica.estado is distinct from 'En curso' then
    raise exception 'Sólo se puede solicitar la baja de una PPS en curso.'
      using errcode = 'P0001';
  end if;

  if v_motivo not in (
    'salud',
    'personal_familiar',
    'laboral',
    'academico',
    'inconveniente_institucional',
    'otro'
  ) then
    raise exception 'Elegí un motivo de baja válido.'
      using errcode = '22023';
  end if;

  if char_length(v_detalle) < 10 or char_length(v_detalle) > 2000 then
    raise exception 'El detalle de la baja debe tener entre 10 y 2000 caracteres.'
      using errcode = '22023';
  end if;

  select l.nombre_pps, l.fecha_inicio
  into v_launch_name, v_launch_start
  from public.lanzamientos_pps as l
  where l.id = v_practica.lanzamiento_id;

  if v_practica.lanzamiento_id is not null then
    select c.id
    into v_convocatoria_id
    from public.convocatorias as c
    where c.estudiante_id = v_student_id
      and c.lanzamiento_id = v_practica.lanzamiento_id
    order by
      (c.estado_inscripcion = 'Seleccionado') desc,
      c.created_at desc nulls last,
      c.id
    limit 1;
  end if;

  begin
    insert into public.solicitudes_modificacion_pps (
      estudiante_id,
      practica_id,
      tipo_modificacion,
      horas_nuevas,
      planilla_asistencia_url,
      estado,
      comentario_rechazo,
      notas_admin,
      motivo_baja,
      motivo_baja_detalle,
      convocatoria_id,
      lanzamiento_id,
      nombre_pps_snapshot,
      fecha_inicio_snapshot,
      estado_practica_snapshot
    ) values (
      v_student_id,
      v_practica.id,
      'eliminacion',
      null,
      null,
      'pendiente',
      null,
      null,
      v_motivo,
      v_detalle,
      v_convocatoria_id,
      v_practica.lanzamiento_id,
      coalesce(nullif(btrim(v_launch_name), ''), nullif(btrim(v_practica.nombre_institucion), ''), 'PPS'),
      coalesce(
        public.safe_date_cast(v_practica.fecha_inicio),
        public.safe_date_cast(v_launch_start)
      )::date,
      v_practica.estado
    )
    returning id into v_solicitud_id;
  exception
    when unique_violation then
      raise exception 'Ya existe una solicitud de baja pendiente para esta PPS.'
        using errcode = 'P0001';
  end;

  return v_solicitud_id;
end;
$$;

create or replace function public.resolver_solicitud_baja_pps_v1(
  p_solicitud_id uuid,
  p_decision text,
  p_tipo_incumplimiento text default null,
  p_notas_admin text default null,
  p_comentario_rechazo text default null
)
returns table (
  estado text,
  penalizacion_id uuid,
  practicas_eliminadas integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_solicitud public.solicitudes_modificacion_pps%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_tipo text := btrim(coalesce(p_tipo_incumplimiento, ''));
  v_notas text := nullif(btrim(coalesce(p_notas_admin, '')), '');
  v_rechazo text := nullif(btrim(coalesce(p_comentario_rechazo, '')), '');
  v_score numeric;
  v_penalty_id uuid;
  v_practice_count integer := 0;
  v_baja record;
begin
  if not public.is_admin() then
    raise exception 'Sólo coordinación puede resolver una solicitud de baja.'
      using errcode = '42501';
  end if;

  select s.*
  into v_solicitud
  from public.solicitudes_modificacion_pps as s
  where s.id = p_solicitud_id
  for update;

  if not found then
    raise exception 'No se encontró la solicitud de baja.' using errcode = 'P0002';
  end if;

  if v_solicitud.tipo_modificacion <> 'eliminacion' then
    raise exception 'La solicitud indicada no corresponde a una baja de PPS.'
      using errcode = '22023';
  end if;

  if v_solicitud.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue procesada.' using errcode = 'P0001';
  end if;

  if v_decision = 'rechazar' then
    if v_rechazo is null then
      raise exception 'Ingresá el motivo del rechazo.' using errcode = '22023';
    end if;

    update public.solicitudes_modificacion_pps
    set estado = 'rechazada',
        comentario_rechazo = v_rechazo,
        notas_admin = v_notas,
        resuelta_at = now(),
        resuelta_por = (select auth.uid()),
        penalizacion_id = null,
        tipo_penalizacion_aplicada = null,
        puntaje_penalizacion_aplicado = null
    where id = v_solicitud.id;

    insert into public.admin_action_log (
      actor_user_id,
      action_type,
      target_table,
      target_id,
      summary,
      metadata
    ) values (
      (select auth.uid()),
      'pps_withdrawal_request_rejected',
      'solicitudes_modificacion_pps',
      v_solicitud.id::text,
      'Solicitud de baja de PPS rechazada',
      jsonb_build_object(
        'estudiante_id', v_solicitud.estudiante_id,
        'lanzamiento_id', v_solicitud.lanzamiento_id,
        'motivo_baja', v_solicitud.motivo_baja,
        'comentario_rechazo', v_rechazo
      )
    );

    return query select 'rechazada'::text, null::uuid, 0::integer;
    return;
  end if;

  if v_decision <> 'aprobar' then
    raise exception 'La decisión debe ser aprobar o rechazar.' using errcode = '22023';
  end if;

  v_score := case v_tipo
    when 'Baja Anticipada' then 30
    when 'Baja sobre la Fecha / Ausencia en Inicio' then 50
    when 'Abandono durante la PPS' then 70
    when 'Falta sin Aviso' then 40
    when 'Baja Administrativa / Sin Penalización' then 0
    else null
  end;

  if v_score is null then
    raise exception 'Elegí un tipo de baja válido.' using errcode = '22023';
  end if;

  if v_solicitud.practica_id is null then
    raise exception 'La práctica ya no está disponible; rechazá la solicitud o revisá el antecedente.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.practicas as p
    where p.id = v_solicitud.practica_id
      and p.estudiante_id = v_solicitud.estudiante_id
      and p.estado = 'En curso'
      and p.lanzamiento_id is not distinct from v_solicitud.lanzamiento_id
  ) then
    raise exception 'La PPS vinculada cambió o ya no está en curso; revisá el antecedente.'
      using errcode = 'P0001';
  end if;

  if v_solicitud.convocatoria_id is not null
    and not exists (
      select 1
      from public.convocatorias as c
      where c.id = v_solicitud.convocatoria_id
        and c.estudiante_id = v_solicitud.estudiante_id
        and c.lanzamiento_id is not distinct from v_solicitud.lanzamiento_id
    )
  then
    raise exception 'La inscripción vinculada no coincide con la solicitud; revisá el antecedente.'
      using errcode = 'P0001';
  end if;

  if v_solicitud.convocatoria_id is not null then
    select *
    into v_baja
    from public.dar_baja_pps_con_penalizacion(
      v_solicitud.convocatoria_id,
      v_tipo,
      concat_ws(E'\n\n', v_solicitud.motivo_baja_detalle, v_notas),
      (v_solicitud.created_at at time zone 'America/Argentina/Buenos_Aires')::date
    );

    v_penalty_id := v_baja.penalizacion_id;
    v_practice_count := v_baja.practicas_eliminadas;
  else
    delete from public.practicas
    where id = v_solicitud.practica_id
      and estudiante_id = v_solicitud.estudiante_id
      and estado = 'En curso';

    get diagnostics v_practice_count = row_count;

    if v_practice_count <> 1 then
      raise exception 'La PPS ya no está en curso y no puede darse de baja.'
        using errcode = 'P0001';
    end if;

    insert into public.penalizaciones (
      estudiante_id,
      tipo_incumplimiento,
      fecha_incidente,
      notas,
      puntaje_penalizacion,
      convocatoria_afectada,
      convocatoria_id,
      lanzamiento_id
    ) values (
      v_solicitud.estudiante_id,
      v_tipo,
      (v_solicitud.created_at at time zone 'America/Argentina/Buenos_Aires')::date::text,
      concat_ws(E'\n\n', v_solicitud.motivo_baja_detalle, v_notas),
      v_score,
      coalesce(v_solicitud.nombre_pps_snapshot, 'PPS'),
      null,
      v_solicitud.lanzamiento_id
    )
    returning id into v_penalty_id;
  end if;

  update public.solicitudes_modificacion_pps
  set estado = 'aprobada',
      comentario_rechazo = null,
      notas_admin = v_notas,
      resuelta_at = now(),
      resuelta_por = (select auth.uid()),
      penalizacion_id = v_penalty_id,
      tipo_penalizacion_aplicada = v_tipo,
      puntaje_penalizacion_aplicado = v_score
  where id = v_solicitud.id;

  insert into public.admin_action_log (
    actor_user_id,
    action_type,
    target_table,
    target_id,
    summary,
    metadata
  ) values (
    (select auth.uid()),
    'pps_withdrawal_request_approved',
    'solicitudes_modificacion_pps',
    v_solicitud.id::text,
    'Solicitud de baja de PPS aprobada con penalización',
    jsonb_build_object(
      'estudiante_id', v_solicitud.estudiante_id,
      'convocatoria_id', v_solicitud.convocatoria_id,
      'lanzamiento_id', v_solicitud.lanzamiento_id,
      'motivo_baja', v_solicitud.motivo_baja,
      'tipo_penalizacion', v_tipo,
      'puntaje', v_score,
      'penalizacion_id', v_penalty_id,
      'fecha_solicitud', v_solicitud.created_at
    )
  );

  return query select 'aprobada'::text, v_penalty_id, v_practice_count;
end;
$$;

revoke all on function public.create_my_solicitud_baja_pps_v1(uuid, text, text)
from public, anon;
grant execute on function public.create_my_solicitud_baja_pps_v1(uuid, text, text)
to authenticated;

revoke all on function public.resolver_solicitud_baja_pps_v1(uuid, text, text, text, text)
from public, anon;
grant execute on function public.resolver_solicitud_baja_pps_v1(uuid, text, text, text, text)
to authenticated;

comment on function public.create_my_solicitud_baja_pps_v1(uuid, text, text) is
  'Crea una solicitud de baja sólo para una PPS En curso del estudiante autenticado y conserva snapshots de auditoría.';

comment on function public.resolver_solicitud_baja_pps_v1(uuid, text, text, text, text) is
  'Resuelve una solicitud de baja en una transacción: deselección, retiro de la práctica activa, penalización y auditoría.';

commit;
