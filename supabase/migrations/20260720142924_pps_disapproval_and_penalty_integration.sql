begin;

-- La desaprobación de una PPS es una decisión excepcional de la institución.
-- La práctica se conserva como antecedente, pero no computa horas ni rotaciones.
alter table public.practicas
  drop constraint if exists practicas_estado_check;

alter table public.practicas
  add column if not exists desaprobacion_fecha date,
  add column if not exists desaprobacion_causas text[],
  add column if not exists desaprobacion_motivo_publico text,
  add column if not exists desaprobacion_notificado_at timestamptz,
  add column if not exists desaprobacion_registrado_por uuid references auth.users(id) on delete set null;

alter table public.practicas
  add constraint practicas_estado_check
  check (
    estado in (
      'En curso',
      'Finalizada',
      'Convenio Realizado',
      'No se pudo concretar',
      'Desaprobada'
    )
  );

alter table public.practicas
  add constraint practicas_desaprobacion_consistente_check
  check (
    (
      estado = 'Desaprobada'
      and desaprobacion_fecha is not null
      and coalesce(array_length(desaprobacion_causas, 1), 0) > 0
      and desaprobacion_causas <@ array[
        'inasistencia_responsabilidad',
        'falta_participacion_actitud'
      ]::text[]
      and nullif(btrim(desaprobacion_motivo_publico), '') is not null
      and desaprobacion_notificado_at is not null
    )
    or
    (
      estado is distinct from 'Desaprobada'
      and desaprobacion_fecha is null
      and desaprobacion_causas is null
      and desaprobacion_motivo_publico is null
      and desaprobacion_notificado_at is null
      and desaprobacion_registrado_por is null
    )
  );

comment on column public.practicas.desaprobacion_causas is
  'Causas canónicas: inasistencia_responsabilidad y/o falta_participacion_actitud.';
comment on column public.practicas.desaprobacion_motivo_publico is
  'Explicación visible para el estudiante. No incluir datos sensibles ni referencias internas.';

create or replace function public.practica_computa(p_estado text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(lower(btrim(p_estado)), '') not in ('desaprobada', 'no se pudo concretar');
$$;

comment on function public.practica_computa(text) is
  'Regla única para horas, especialidad y rotaciones: las PPS desaprobadas o no concretadas no computan.';

-- El trigger legado revertía el estado cuando una migración o tarea de servicio
-- no tenía auth.uid(). Mantiene la protección estudiantil, pero permite tareas
-- internas y a los roles administrativos autenticados.
create or replace function public.check_practica_updates()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then
    return new;
  end if;

  new.estudiante_id := old.estudiante_id;
  new.lanzamiento_id := old.lanzamiento_id;
  new.estado := old.estado;
  return new;
end;
$$;

-- Vinculación y ciclo de vida de las penalizaciones.
alter table public.penalizaciones
  add column if not exists practica_id uuid references public.practicas(id) on delete restrict,
  add column if not exists convocatoria_id uuid references public.convocatorias(id) on delete set null,
  add column if not exists lanzamiento_id uuid references public.lanzamientos_pps(id) on delete set null,
  add column if not exists estado text not null default 'Activa',
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_por uuid references auth.users(id) on delete set null,
  add column if not exists anulacion_motivo text;

alter table public.penalizaciones
  add constraint penalizaciones_estado_check
  check (estado in ('Activa', 'Anulada')),
  add constraint penalizaciones_anulacion_consistente_check
  check (
    (estado = 'Activa' and anulada_at is null and anulada_por is null and anulacion_motivo is null)
    or
    (estado = 'Anulada' and anulada_at is not null and nullif(btrim(anulacion_motivo), '') is not null)
  );

-- Los tres registros heredados completamente vacíos se conservan para auditoría,
-- pero quedan anulados y fuera de cualquier cálculo.
update public.penalizaciones
set tipo_incumplimiento = coalesce(tipo_incumplimiento, 'Registro inválido heredado'),
    puntaje_penalizacion = coalesce(puntaje_penalizacion, 0),
    estado = 'Anulada',
    anulada_at = coalesce(created_at, now()),
    anulacion_motivo = 'Registro heredado sin estudiante ni datos de penalización'
where estudiante_id is null
  and tipo_incumplimiento is null
  and puntaje_penalizacion is null;

-- Antes de normalizar, se registra cada corrección de puntaje con su valor anterior.
insert into public.admin_action_log (
  actor_name,
  action_type,
  target_table,
  target_id,
  summary,
  metadata
)
select
  'Migración canónica de penalizaciones',
  'penalty_score_normalized',
  'penalizaciones',
  p.id::text,
  'Puntaje histórico normalizado al criterio institucional vigente',
  jsonb_build_object(
    'tipo', p.tipo_incumplimiento,
    'puntaje_anterior', p.puntaje_penalizacion,
    'puntaje_nuevo', case p.tipo_incumplimiento
      when 'Baja Anticipada' then 30
      when 'Baja sobre la Fecha / Ausencia en Inicio' then 50
      when 'Ausencia en Inicio / No se presentó' then 50
      when 'Abandono durante la PPS' then 70
      when 'Falta sin Aviso' then 40
      when 'Baja Administrativa / Sin Penalización' then 0
      else greatest(coalesce(p.puntaje_penalizacion, 0), 0)
    end
  )
from public.penalizaciones as p
where p.estado = 'Activa'
  and p.puntaje_penalizacion is distinct from case p.tipo_incumplimiento
    when 'Baja Anticipada' then 30
    when 'Baja sobre la Fecha / Ausencia en Inicio' then 50
    when 'Ausencia en Inicio / No se presentó' then 50
    when 'Abandono durante la PPS' then 70
    when 'Falta sin Aviso' then 40
    when 'Baja Administrativa / Sin Penalización' then 0
    else greatest(coalesce(p.puntaje_penalizacion, 0), 0)
  end;

update public.penalizaciones
set tipo_incumplimiento = case
      when tipo_incumplimiento = 'Ausencia en Inicio / No se presentó'
        then 'Baja sobre la Fecha / Ausencia en Inicio'
      else tipo_incumplimiento
    end,
    puntaje_penalizacion = case tipo_incumplimiento
      when 'Baja Anticipada' then 30
      when 'Baja sobre la Fecha / Ausencia en Inicio' then 50
      when 'Ausencia en Inicio / No se presentó' then 50
      when 'Abandono durante la PPS' then 70
      when 'Falta sin Aviso' then 40
      when 'Baja Administrativa / Sin Penalización' then 0
      else greatest(coalesce(puntaje_penalizacion, 0), 0)
    end
where estado = 'Activa';

alter table public.penalizaciones
  alter column puntaje_penalizacion set default 0,
  alter column puntaje_penalizacion set not null;

alter table public.penalizaciones
  add constraint penalizaciones_puntaje_no_negativo_check
  check (puntaje_penalizacion >= 0);

create index if not exists idx_penalizaciones_estudiante_estado
  on public.penalizaciones (estudiante_id, estado);
create index if not exists idx_penalizaciones_practica_id
  on public.penalizaciones (practica_id);
create index if not exists idx_penalizaciones_convocatoria_id
  on public.penalizaciones (convocatoria_id);
create index if not exists idx_penalizaciones_lanzamiento_id
  on public.penalizaciones (lanzamiento_id);
create index if not exists idx_practicas_desaprobadas_estudiante
  on public.practicas (estudiante_id, desaprobacion_fecha desc)
  where estado = 'Desaprobada';

create unique index if not exists uq_penalizacion_desaprobacion_activa_por_practica
  on public.penalizaciones (practica_id)
  where estado = 'Activa'
    and tipo_incumplimiento = 'PPS desaprobada por la institución';

-- El estudiante puede seguir corrigiendo sus registros ordinarios, pero no puede
-- alterar ni borrar una decisión institucional. Una desaprobación se corrige por RPC.
create or replace function public.proteger_desaprobacion_pps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.estado = 'Desaprobada' then
    raise exception 'Una PPS desaprobada no se elimina; debe anularse con trazabilidad.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and current_user not in ('postgres', 'service_role')
     and not public.is_admin()
     and (
       old.estado = 'Desaprobada'
       or new.estado = 'Desaprobada'
       or old.desaprobacion_fecha is distinct from new.desaprobacion_fecha
       or old.desaprobacion_causas is distinct from new.desaprobacion_causas
       or old.desaprobacion_motivo_publico is distinct from new.desaprobacion_motivo_publico
       or old.desaprobacion_notificado_at is distinct from new.desaprobacion_notificado_at
       or old.desaprobacion_registrado_por is distinct from new.desaprobacion_registrado_por
     ) then
    raise exception 'La desaprobación de una PPS sólo puede ser gestionada por coordinación.'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists proteger_desaprobacion_pps_trigger on public.practicas;
create trigger proteger_desaprobacion_pps_trigger
before update or delete on public.practicas
for each row execute function public.proteger_desaprobacion_pps();

-- La deselección automática no debe borrar un antecedente ya desaprobado.
do $$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef('public.handle_seleccion_alumno()'::regprocedure)
  into v_definition;

  v_patched := replace(
    v_definition,
    'AND lanzamiento_id = NEW.lanzamiento_id;',
    E'AND lanzamiento_id = NEW.lanzamiento_id\n        AND estado IS DISTINCT FROM ''Desaprobada'';'
  );

  if v_patched = v_definition then
    raise exception 'No se pudo proteger la baja automática de prácticas desaprobadas';
  end if;

  execute v_patched;
end;
$$;

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

  if nullif(btrim(p_motivo_publico), '') is null
     or nullif(btrim(p_informe_ref), '') is null then
    raise exception 'El motivo comunicado y la referencia al informe son obligatorios'
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
      'informe_ref', btrim(p_informe_ref),
      'notificado_at', p_notificado_at,
      'penalizacion_id', v_penalizacion_id,
      'puntaje', 100
    )
  );

  return query select p_practica_id, v_penalizacion_id;
end;
$$;

create or replace function public.anular_desaprobacion_pps(
  p_practica_id uuid,
  p_nuevo_estado text,
  p_motivo text
)
returns table (practica_id uuid, penalizacion_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_practica public.practicas%rowtype;
  v_penalizacion_id uuid;
  v_actor_name text;
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinación'
      using errcode = '42501';
  end if;

  if p_nuevo_estado not in ('En curso', 'Finalizada', 'Convenio Realizado', 'No se pudo concretar')
     or nullif(btrim(p_motivo), '') is null then
    raise exception 'Estado de corrección o motivo inválido'
      using errcode = '22023';
  end if;

  select p.*
  into v_practica
  from public.practicas as p
  where p.id = p_practica_id
  for update;

  if not found or v_practica.estado <> 'Desaprobada' then
    raise exception 'La práctica no está desaprobada'
      using errcode = '22023';
  end if;

  select e.nombre
  into v_actor_name
  from public.estudiantes as e
  where e.user_id = (select auth.uid())
  limit 1;

  update public.penalizaciones
  set estado = 'Anulada',
      anulada_at = now(),
      anulada_por = (select auth.uid()),
      anulacion_motivo = btrim(p_motivo)
  where practica_id = p_practica_id
    and tipo_incumplimiento = 'PPS desaprobada por la institución'
    and estado = 'Activa'
  returning id into v_penalizacion_id;

  update public.practicas
  set estado = p_nuevo_estado,
      desaprobacion_fecha = null,
      desaprobacion_causas = null,
      desaprobacion_motivo_publico = null,
      desaprobacion_notificado_at = null,
      desaprobacion_registrado_por = null
  where id = p_practica_id;

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
    'pps_disapproval_voided',
    'practicas',
    p_practica_id::text,
    'Desaprobación anulada mediante corrección administrativa',
    jsonb_build_object(
      'estudiante_id', v_practica.estudiante_id,
      'lanzamiento_id', v_practica.lanzamiento_id,
      'nuevo_estado', p_nuevo_estado,
      'motivo', btrim(p_motivo),
      'penalizacion_id', v_penalizacion_id
    )
  );

  return query select p_practica_id, v_penalizacion_id;
end;
$$;

revoke all on function public.registrar_desaprobacion_pps(uuid, date, text[], text, text, timestamptz) from public, anon;
grant execute on function public.registrar_desaprobacion_pps(uuid, date, text[], text, text, timestamptz) to authenticated;
revoke all on function public.anular_desaprobacion_pps(uuid, text, text) from public, anon;
grant execute on function public.anular_desaprobacion_pps(uuid, text, text) to authenticated;

-- Reconstrucción documental: sólo los siete casos confirmados por comunicación
-- institucional. Las referencias a Gmail quedan exclusivamente en el log admin.
create temporary table _pps_disapproval_backfill (
  legajo text primary key,
  launch_start text not null,
  fecha date not null,
  causas text[] not null,
  motivo_publico text not null,
  informe_ref text not null,
  notificado_at timestamptz not null
) on commit drop;

insert into _pps_disapproval_backfill values
  (
    '32956',
    '2026-02-04',
    date '2026-04-06',
    array['inasistencia_responsabilidad'],
    'Incumplimiento del mínimo de asistencia y ausencias sin aviso en los espacios de supervisión.',
    'gmail:19d634fd43312bd7',
    timestamptz '2026-04-06 12:00:00-03'
  ),
  (
    '33440',
    '2026-02-04',
    date '2026-04-06',
    array['inasistencia_responsabilidad', 'falta_participacion_actitud'],
    'Incumplimiento del mínimo de asistencia y evaluación institucional desfavorable del compromiso y la participación.',
    'gmail:19d6354fcda2fb8d',
    timestamptz '2026-04-06 12:00:00-03'
  ),
  (
    '23929',
    '2026-02-04',
    date '2026-04-08',
    array['inasistencia_responsabilidad', 'falta_participacion_actitud'],
    'Incumplimiento del mínimo de asistencia y evaluación institucional desfavorable de la responsabilidad y la participación.',
    'gmail:19d6e24f576d598b',
    timestamptz '2026-04-08 12:00:00-03'
  ),
  (
    '30923',
    '2026-02-04',
    date '2026-03-16',
    array['falta_participacion_actitud'],
    'La institución informó una evaluación desfavorable del desempeño, el compromiso y la adecuación al encuadre profesional.',
    'gmail:19cf7622310393f1',
    timestamptz '2026-03-16 12:00:00-03'
  ),
  (
    '26370',
    '2025-09-15',
    date '2025-11-26',
    array['falta_participacion_actitud'],
    'La institución dispuso la baja por incumplimientos graves y reiterados del encuadre ético-profesional.',
    'gmail:19a4bbd14b9514d4',
    timestamptz '2025-11-26 12:00:00-03'
  ),
  (
    '20679',
    '2026-05-18',
    date '2026-07-20',
    array['falta_participacion_actitud'],
    'La institución informó una evaluación desfavorable de la participación activa, el compromiso con las tareas y el posicionamiento profesional.',
    'gmail:19f7ff1bacc7e776',
    timestamptz '2026-07-20 11:32:56-03'
  ),
  (
    '22552',
    '2026-05-18',
    date '2026-07-20',
    array['falta_participacion_actitud'],
    'La institución informó una evaluación desfavorable de la participación activa, el compromiso con las tareas y el posicionamiento profesional.',
    'gmail:19f7ff0ee3d61206',
    timestamptz '2026-07-20 11:32:04-03'
  );

-- Dos prácticas habían desaparecido por el flujo histórico de deselección.
-- Se recrean a partir del lanzamiento y la convocatoria, sin IDs hardcodeados.
insert into public.practicas (
  estudiante_id,
  lanzamiento_id,
  horas_realizadas,
  fecha_inicio,
  fecha_finalizacion,
  estado,
  especialidad,
  nota,
  nombre_institucion,
  es_online,
  tipo_actividad
)
select
  e.id,
  l.id,
  l.horas_acreditadas,
  l.fecha_inicio,
  l.fecha_finalizacion,
  'En curso',
  l.orientacion,
  'Sin calificar',
  l.nombre_pps,
  false,
  l.tipo_actividad
from _pps_disapproval_backfill as b
join public.estudiantes as e on e.legajo = b.legajo
join public.lanzamientos_pps as l on l.fecha_inicio = b.launch_start
join public.convocatorias as c
  on c.estudiante_id = e.id
  and c.lanzamiento_id = l.id
where not exists (
  select 1
  from public.practicas as p
  where p.estudiante_id = e.id
    and p.lanzamiento_id = l.id
);

with resolved as (
  select distinct on (e.id)
    b.*,
    e.id as estudiante_id,
    p.id as practica_id,
    p.lanzamiento_id,
    c.id as convocatoria_id,
    coalesce(l.nombre_pps, p.nombre_institucion, 'PPS') as nombre_pps
  from _pps_disapproval_backfill as b
  join public.estudiantes as e on e.legajo = b.legajo
  join public.practicas as p on p.estudiante_id = e.id
  join public.lanzamientos_pps as l
    on l.id = p.lanzamiento_id
    and l.fecha_inicio = b.launch_start
  left join public.convocatorias as c
    on c.estudiante_id = e.id
    and c.lanzamiento_id = p.lanzamiento_id
  order by e.id, (c.estado_inscripcion = 'Seleccionado') desc, c.created_at desc
)
update public.practicas as p
set estado = 'Desaprobada',
    desaprobacion_fecha = r.fecha,
    desaprobacion_causas = r.causas,
    desaprobacion_motivo_publico = r.motivo_publico,
    desaprobacion_notificado_at = r.notificado_at,
    desaprobacion_registrado_por = null
from resolved as r
where p.id = r.practica_id;

with resolved as (
  select distinct on (e.id)
    b.*,
    e.id as estudiante_id,
    p.id as practica_id,
    p.lanzamiento_id,
    c.id as convocatoria_id,
    coalesce(l.nombre_pps, p.nombre_institucion, 'PPS') as nombre_pps
  from _pps_disapproval_backfill as b
  join public.estudiantes as e on e.legajo = b.legajo
  join public.practicas as p on p.estudiante_id = e.id
  join public.lanzamientos_pps as l
    on l.id = p.lanzamiento_id
    and l.fecha_inicio = b.launch_start
  left join public.convocatorias as c
    on c.estudiante_id = e.id
    and c.lanzamiento_id = p.lanzamiento_id
  order by e.id, (c.estado_inscripcion = 'Seleccionado') desc, c.created_at desc
)
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
)
select
  r.estudiante_id,
  'PPS desaprobada por la institución',
  r.fecha::text,
  r.motivo_publico,
  100,
  r.nombre_pps,
  r.practica_id,
  r.convocatoria_id,
  r.lanzamiento_id,
  'Activa'
from resolved as r
on conflict (practica_id)
  where estado = 'Activa'
    and tipo_incumplimiento = 'PPS desaprobada por la institución'
do update set
  fecha_incidente = excluded.fecha_incidente,
  notas = excluded.notas,
  puntaje_penalizacion = 100,
  convocatoria_afectada = excluded.convocatoria_afectada,
  convocatoria_id = excluded.convocatoria_id,
  lanzamiento_id = excluded.lanzamiento_id;

with resolved as (
  select distinct on (e.id)
    b.*,
    e.id as estudiante_id,
    p.id as practica_id,
    p.lanzamiento_id,
    pen.id as penalizacion_id
  from _pps_disapproval_backfill as b
  join public.estudiantes as e on e.legajo = b.legajo
  join public.practicas as p on p.estudiante_id = e.id
  join public.lanzamientos_pps as l
    on l.id = p.lanzamiento_id
    and l.fecha_inicio = b.launch_start
  join public.penalizaciones as pen
    on pen.practica_id = p.id
    and pen.estado = 'Activa'
    and pen.tipo_incumplimiento = 'PPS desaprobada por la institución'
  order by e.id
)
insert into public.admin_action_log (
  actor_name,
  action_type,
  target_table,
  target_id,
  summary,
  metadata
)
select
  'Reconstrucción documental Gmail',
  'pps_disapproval_backfilled',
  'practicas',
  r.practica_id::text,
  'Desaprobación institucional reconstruida desde comunicaciones históricas',
  jsonb_build_object(
    'estudiante_id', r.estudiante_id,
    'lanzamiento_id', r.lanzamiento_id,
    'fecha', r.fecha,
    'causas', r.causas,
    'informe_ref', r.informe_ref,
    'notificado_at', r.notificado_at,
    'penalizacion_id', r.penalizacion_id,
    'puntaje', 100
  )
from resolved as r;

-- Los reportes agregados vigentes pasan a usar la misma regla de cómputo.
-- Se parchean definiciones ya desplegadas y se aborta la migración si alguna
-- firma cambió, para evitar una corrección silenciosamente incompleta.
do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched text;
begin
  foreach v_signature in array array[
    'public.get_admin_metrics_kpis(integer)'::regprocedure,
    'public.get_proximos_finalizar_list_impl(integer)'::regprocedure,
    'public.get_dashboard_metrics(integer)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_patched := replace(
      v_definition,
      'FROM practicas GROUP BY estudiante_id',
      'FROM practicas WHERE public.practica_computa(estado) GROUP BY estudiante_id'
    );
    v_patched := replace(
      v_patched,
      E'from practicas\n        group by estudiante_id',
      E'from practicas\n        where public.practica_computa(estado)\n        group by estudiante_id'
    );

    if v_patched = v_definition then
      raise exception 'No se pudo actualizar el cómputo de %', v_signature;
    end if;

    execute v_patched;
  end loop;
end;
$$;

do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched text;
begin
  foreach v_signature in array array[
    'private.get_director_report_v1_impl(integer,date)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_patched := replace(
      v_definition,
      E'from public.practicas as p\n  ),',
      E'from public.practicas as p\n    where public.practica_computa(p.estado)\n  ),'
    );
    v_patched := replace(
      v_patched,
      E'left join public.lanzamientos_pps as l on l.id = p.lanzamiento_id\n  ),',
      E'left join public.lanzamientos_pps as l on l.id = p.lanzamiento_id\n    where public.practica_computa(p.estado)\n  ),'
    );

    if v_patched = v_definition then
      raise exception 'No se pudo actualizar el cómputo de %', v_signature;
    end if;

    execute v_patched;
  end loop;
end;
$$;

do $$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'private.get_interview_completion_candidates_v1_impl()'::regprocedure
  ) into v_definition;

  v_patched := replace(
    v_definition,
    $search$
    where lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
      like '%relevamiento%profesional%'
      or lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
        ~ 'entrevistas?[[:space:]]+a[[:space:]]+profesionales?'
  ),
$search$,
    $replacement$
    where public.practica_computa(p.estado)
      and (
        lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
          like '%relevamiento%profesional%'
        or lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
          ~ 'entrevistas?[[:space:]]+a[[:space:]]+profesionales?'
      )
  ),
$replacement$
  );

  if v_patched = v_definition then
    raise exception 'No se pudo actualizar el cómputo de private.get_interview_completion_candidates_v1_impl()';
  end if;

  execute v_patched;
end;
$$;

commit;
