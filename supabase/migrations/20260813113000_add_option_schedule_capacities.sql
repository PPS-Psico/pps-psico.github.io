-- Cupos por franja horaria dentro de cada dispositivo de una mega convocatoria.
-- La elegibilidad continúa resolviéndose por institución + orientación; la
-- capacidad operativa y la asignación se controlan por franja.

create table if not exists public.lanzamiento_opcion_horarios (
  id uuid primary key default gen_random_uuid(),
  opcion_id uuid not null references public.lanzamiento_opciones(id) on delete cascade,
  horario text not null check (nullif(btrim(horario), '') is not null),
  cupos integer not null check (cupos > 0),
  orden smallint not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opcion_id, horario)
);

comment on table public.lanzamiento_opcion_horarios is
  'Franjas elegibles dentro de un dispositivo. Cada franja conserva y controla su propia capacidad.';

create index if not exists idx_lanzamiento_opcion_horarios_option_order
  on public.lanzamiento_opcion_horarios (opcion_id, orden, horario)
  where activa;

alter table public.lanzamiento_opcion_horarios enable row level security;

drop policy if exists "Leer horarios de opciones" on public.lanzamiento_opcion_horarios;
create policy "Leer horarios de opciones"
on public.lanzamiento_opcion_horarios for select
using (true);

drop policy if exists "Admin insert horarios de opciones" on public.lanzamiento_opcion_horarios;
create policy "Admin insert horarios de opciones"
on public.lanzamiento_opcion_horarios for insert
with check ((select public.is_admin()));

drop policy if exists "Admin update horarios de opciones" on public.lanzamiento_opcion_horarios;
create policy "Admin update horarios de opciones"
on public.lanzamiento_opcion_horarios for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admin delete horarios de opciones" on public.lanzamiento_opcion_horarios;
create policy "Admin delete horarios de opciones"
on public.lanzamiento_opcion_horarios for delete
using ((select public.is_admin()));

grant select on public.lanzamiento_opcion_horarios to anon, authenticated;
grant insert, update, delete on public.lanzamiento_opcion_horarios to authenticated;

alter table public.convocatoria_preferencias
  add column if not exists opcion_horario_id uuid
    references public.lanzamiento_opcion_horarios(id) on delete restrict;

alter table public.convocatorias
  add column if not exists opcion_horario_asignado_id uuid
    references public.lanzamiento_opcion_horarios(id) on delete set null;

alter table public.practicas
  add column if not exists opcion_horario_id uuid
    references public.lanzamiento_opcion_horarios(id) on delete set null;

create index if not exists idx_convocatoria_preferencias_horario
  on public.convocatoria_preferencias (opcion_horario_id, prioridad)
  where opcion_horario_id is not null;

create unique index if not exists uq_convocatoria_preferencia_horario
  on public.convocatoria_preferencias (convocatoria_id, opcion_horario_id)
  where opcion_horario_id is not null;

create index if not exists idx_convocatorias_horario_asignado
  on public.convocatorias (opcion_horario_asignado_id)
  where opcion_horario_asignado_id is not null;

create index if not exists idx_practicas_opcion_horario
  on public.practicas (opcion_horario_id)
  where opcion_horario_id is not null;

-- Una preferencia ahora puede incluir varias franjas del mismo dispositivo.
alter table public.convocatoria_preferencias
  drop constraint if exists convocatoria_preferencias_convocatoria_id_opcion_id_key;

-- Los registros previos conservan su capacidad compartida en una única franja.
insert into public.lanzamiento_opcion_horarios (opcion_id, horario, cupos, orden)
select
  o.id,
  case
    when cardinality(o.horarios) > 0 then array_to_string(o.horarios, ' · ')
    else 'Horario a convenir'
  end,
  o.cupos,
  1
from public.lanzamiento_opciones o
where not exists (
  select 1
  from public.lanzamiento_opcion_horarios h
  where h.opcion_id = o.id
);

with first_slot as (
  select distinct on (slot.opcion_id) slot.opcion_id, slot.id
  from public.lanzamiento_opcion_horarios slot
  order by slot.opcion_id, slot.orden, slot.created_at
)
update public.convocatoria_preferencias p
set opcion_horario_id = h.id
from first_slot h
where h.opcion_id = p.opcion_id
  and p.opcion_horario_id is null;

with first_slot as (
  select distinct on (slot.opcion_id) slot.opcion_id, slot.id
  from public.lanzamiento_opcion_horarios slot
  order by slot.opcion_id, slot.orden, slot.created_at
)
update public.convocatorias c
set opcion_horario_asignado_id = h.id
from first_slot h
where h.opcion_id = c.opcion_asignada_id
  and c.opcion_asignada_id is not null
  and c.opcion_horario_asignado_id is null;

with first_slot as (
  select distinct on (slot.opcion_id) slot.opcion_id, slot.id
  from public.lanzamiento_opcion_horarios slot
  order by slot.opcion_id, slot.orden, slot.created_at
)
update public.practicas p
set opcion_horario_id = h.id
from first_slot h
where h.opcion_id = p.opcion_id
  and p.opcion_id is not null
  and p.opcion_horario_id is null;

create or replace function private.sync_lanzamiento_opcion_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_option_id uuid;
  v_total integer;
  v_schedules text[];
begin
  v_option_id := case when tg_op = 'DELETE' then old.opcion_id else new.opcion_id end;

  select coalesce(sum(h.cupos), 0)::integer,
         coalesce(array_agg(h.horario order by h.orden, h.horario)
           filter (where h.activa), '{}'::text[])
  into v_total, v_schedules
  from public.lanzamiento_opcion_horarios h
  where h.opcion_id = v_option_id
    and h.activa;

  update public.lanzamiento_opciones o
  set cupos = case when v_total > 0 then v_total else o.cupos end,
      horarios = v_schedules,
      updated_at = now()
  where o.id = v_option_id;

  if tg_op = 'UPDATE' and old.opcion_id <> new.opcion_id then
    select coalesce(sum(h.cupos), 0)::integer,
           coalesce(array_agg(h.horario order by h.orden, h.horario)
             filter (where h.activa), '{}'::text[])
    into v_total, v_schedules
    from public.lanzamiento_opcion_horarios h
    where h.opcion_id = old.opcion_id
      and h.activa;

    update public.lanzamiento_opciones o
    set cupos = case when v_total > 0 then v_total else o.cupos end,
        horarios = v_schedules,
        updated_at = now()
    where o.id = old.opcion_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_lanzamiento_opcion_capacity
  on public.lanzamiento_opcion_horarios;
create trigger trg_sync_lanzamiento_opcion_capacity
after insert or update of opcion_id, horario, cupos, orden, activa or delete
on public.lanzamiento_opcion_horarios
for each row execute function private.sync_lanzamiento_opcion_capacity();

create or replace function private.ensure_convocatoria_option_schedule_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_slot public.lanzamiento_opcion_horarios%rowtype;
  v_option public.lanzamiento_opciones%rowtype;
  v_used integer;
begin
  if new.opcion_horario_asignado_id is null
     or lower(coalesce(new.estado_inscripcion, '')) <> 'seleccionado' then
    return new;
  end if;

  select * into v_slot
  from public.lanzamiento_opcion_horarios h
  where h.id = new.opcion_horario_asignado_id and h.activa
  for update;

  select * into v_option
  from public.lanzamiento_opciones o
  where o.id = v_slot.opcion_id and o.activa;

  if v_slot.id is null
     or v_option.id is null
     or v_option.lanzamiento_id <> new.lanzamiento_id
     or (new.opcion_asignada_id is not null and new.opcion_asignada_id <> v_option.id) then
    raise exception 'La franja asignada no pertenece a esta convocatoria.';
  end if;

  select count(*) into v_used
  from public.convocatorias c
  where c.opcion_horario_asignado_id = v_slot.id
    and lower(coalesce(c.estado_inscripcion, '')) = 'seleccionado'
    and c.id <> new.id;

  if v_used >= v_slot.cupos then
    raise exception 'El horario seleccionado ya no tiene cupos disponibles.';
  end if;

  new.opcion_asignada_id := v_option.id;
  return new;
end;
$$;

drop trigger if exists trg_convocatoria_option_schedule_capacity on public.convocatorias;
create trigger trg_convocatoria_option_schedule_capacity
before insert or update of opcion_horario_asignado_id, opcion_asignada_id, estado_inscripcion
on public.convocatorias
for each row execute function private.ensure_convocatoria_option_schedule_capacity();

create or replace function public.inscribir_convocatoria_multiopcion_v2(
  p_lanzamiento_id uuid,
  p_horario_ids uuid[],
  p_datos jsonb default '{}'::jsonb
)
returns public.convocatorias
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student public.estudiantes%rowtype;
  v_launch public.lanzamientos_pps%rowtype;
  v_conv public.convocatorias%rowtype;
  v_slot_count integer;
  v_distinct_count integer;
  v_blocked text;
  v_orientation text;
  v_preference_labels text;
begin
  select * into v_student
  from public.estudiantes e
  where e.user_id = (select auth.uid())
  limit 1;

  if v_student.id is null then
    raise exception 'No se encontró el perfil del estudiante autenticado.';
  end if;
  if lower(coalesce(v_student.estado, '')) <> 'activo' then
    raise exception 'Tu cuenta no está activa. Comunicate con coordinación de PPS.';
  end if;

  select * into v_launch
  from public.lanzamientos_pps l
  where l.id = p_lanzamiento_id;

  if v_launch.id is null
     or lower(coalesce(v_launch.estado_convocatoria, '')) not in ('abierta', 'abierto') then
    raise exception 'La convocatoria no está abierta para inscripciones.';
  end if;
  if coalesce(cardinality(p_horario_ids), 0) = 0 then
    raise exception 'Elegí al menos una franja horaria.';
  end if;

  select count(*), count(distinct h.id)
  into v_slot_count, v_distinct_count
  from public.lanzamiento_opcion_horarios h
  join public.lanzamiento_opciones o on o.id = h.opcion_id
  where h.id = any(p_horario_ids)
    and h.activa
    and o.activa
    and o.lanzamiento_id = p_lanzamiento_id;

  if v_slot_count <> cardinality(p_horario_ids)
     or v_distinct_count <> cardinality(p_horario_ids) then
    raise exception 'Una o más franjas no pertenecen a esta convocatoria.';
  end if;

  select string_agg(distinct o.orientacion, ', ' order by o.orientacion)
  into v_blocked
  from public.lanzamiento_opcion_horarios h
  join public.lanzamiento_opciones o on o.id = h.opcion_id
  where h.id = any(p_horario_ids)
    and exists (
      select 1
      from public.practicas p
      left join public.lanzamientos_pps previous_launch on previous_launch.id = p.lanzamiento_id
      where p.estudiante_id = v_student.id
        and lower(coalesce(p.estado, '')) in
          ('finalizada', 'pps realizada', 'convenio realizado', 'aprobada', 'en curso')
        and lower(btrim(coalesce(p.especialidad, ''))) = lower(btrim(o.orientacion))
        and (
          (p.institucion_id is not null and p.institucion_id::text = v_launch.institucion_id)
          or (previous_launch.institucion_id is not null
              and previous_launch.institucion_id = v_launch.institucion_id)
          or lower(btrim(coalesce(p.nombre_institucion, ''))) =
             lower(btrim(coalesce(v_launch.nombre_pps, '')))
        )
    );

  if v_blocked is not null then
    raise exception 'Ya cursaste o estás cursando la orientación % en esta institución.', v_blocked;
  end if;

  select string_agg(distinct o.orientacion, ', ' order by o.orientacion),
         string_agg(o.nombre || ' · ' || h.horario, '; '
           order by array_position(p_horario_ids, h.id))
  into v_orientation, v_preference_labels
  from public.lanzamiento_opcion_horarios h
  join public.lanzamiento_opciones o on o.id = h.opcion_id
  where h.id = any(p_horario_ids);

  insert into public.convocatorias (
    lanzamiento_id, estudiante_id, estado_inscripcion, termino_cursar,
    cursando_electivas, finales_adeuda, otra_situacion_academica,
    horario_seleccionado, trabaja, certificado_trabajo, cv_url,
    nombre_pps, fecha_inicio, fecha_finalizacion, orientacion,
    horas_acreditadas, direccion, legajo, correo, telefono, dni
  ) values (
    v_launch.id, v_student.id, 'Inscripto', p_datos->>'termino_cursar',
    p_datos->>'cursando_electivas', p_datos->>'finales_adeuda',
    p_datos->>'otra_situacion_academica', v_preference_labels,
    coalesce((p_datos->>'trabaja')::boolean, false),
    nullif(p_datos->>'certificado_trabajo', ''), nullif(p_datos->>'cv_url', ''),
    v_launch.nombre_pps, v_launch.fecha_inicio,
    case when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
    v_orientation, v_launch.horas_acreditadas, v_launch.direccion,
    nullif(p_datos->>'legajo', '')::numeric, v_student.correo, v_student.telefono, v_student.dni
  )
  returning * into v_conv;

  insert into public.convocatoria_preferencias (
    convocatoria_id, opcion_id, opcion_horario_id, prioridad
  )
  select v_conv.id, h.opcion_id, selected.horario_id, selected.ordinality::smallint
  from unnest(p_horario_ids) with ordinality as selected(horario_id, ordinality)
  join public.lanzamiento_opcion_horarios h on h.id = selected.horario_id;

  return v_conv;
end;
$$;

revoke all on function public.inscribir_convocatoria_multiopcion_v2(uuid, uuid[], jsonb)
  from public, anon;
grant execute on function public.inscribir_convocatoria_multiopcion_v2(uuid, uuid[], jsonb)
  to authenticated;

create or replace function public.seleccionar_convocatoria_opcion_horario(
  p_convocatoria_id uuid,
  p_horario_id uuid,
  p_seleccionar boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conv public.convocatorias%rowtype;
  v_launch public.lanzamientos_pps%rowtype;
  v_option public.lanzamiento_opciones%rowtype;
  v_slot public.lanzamiento_opcion_horarios%rowtype;
  v_schedule text;
  v_used integer;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permisos para gestionar la selección.';
  end if;

  select * into v_conv
  from public.convocatorias
  where id = p_convocatoria_id
  for update;
  if v_conv.id is null then raise exception 'Inscripción inexistente.'; end if;

  select * into v_launch
  from public.lanzamientos_pps
  where id = v_conv.lanzamiento_id;

  if p_seleccionar then
    select * into v_slot
    from public.lanzamiento_opcion_horarios
    where id = p_horario_id and activa
    for update;

    select * into v_option
    from public.lanzamiento_opciones
    where id = v_slot.opcion_id
      and lanzamiento_id = v_conv.lanzamiento_id
      and activa;

    if v_slot.id is null or v_option.id is null then
      raise exception 'Elegí una franja válida.';
    end if;

    select count(*) into v_used
    from public.convocatorias c
    where c.opcion_horario_asignado_id = v_slot.id
      and lower(coalesce(c.estado_inscripcion, '')) = 'seleccionado'
      and c.id <> v_conv.id;

    if v_used >= v_slot.cupos then
      raise exception 'El horario seleccionado ya no tiene cupos disponibles.';
    end if;

    v_schedule := v_option.nombre || ' · ' || v_slot.horario;

    update public.convocatorias
    set estado_inscripcion = 'Seleccionado',
        opcion_asignada_id = v_option.id,
        opcion_horario_asignado_id = v_slot.id,
        horario_asignado = v_schedule,
        orientacion = v_option.orientacion,
        selected_at = now(), reminder_sent_at = null, baja_automatica_at = null
    where id = v_conv.id;

    update public.practicas
    set opcion_id = v_option.id,
        opcion_horario_id = v_slot.id,
        institucion_id = case
          when v_launch.institucion_id ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then v_launch.institucion_id::uuid else null end,
        nombre_institucion = v_launch.nombre_pps,
        especialidad = v_option.orientacion,
        fecha_inicio = v_launch.fecha_inicio,
        fecha_finalizacion = case
          when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
        estado = 'En curso'
    where estudiante_id = v_conv.estudiante_id
      and lanzamiento_id = v_launch.id
      and lower(coalesce(estado, '')) = 'en curso';

    if not found then
      insert into public.practicas (
        estudiante_id, lanzamiento_id, opcion_id, opcion_horario_id, institucion_id,
        nombre_institucion, especialidad, fecha_inicio, fecha_finalizacion,
        horas_realizadas, estado, nota, informe_estado
      ) values (
        v_conv.estudiante_id, v_launch.id, v_option.id, v_slot.id,
        case when v_launch.institucion_id ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then v_launch.institucion_id::uuid else null end,
        v_launch.nombre_pps, v_option.orientacion, v_launch.fecha_inicio,
        case when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
        0, 'En curso', null, null
      );
    end if;
  else
    update public.convocatorias
    set estado_inscripcion = 'Inscripto',
        opcion_asignada_id = null,
        opcion_horario_asignado_id = null,
        horario_asignado = null, selected_at = null,
        reminder_sent_at = null, baja_automatica_at = null
    where id = v_conv.id;

    delete from public.practicas
    where estudiante_id = v_conv.estudiante_id
      and lanzamiento_id = v_conv.lanzamiento_id
      and lower(coalesce(estado, '')) = 'en curso';
  end if;

  return true;
end;
$$;

revoke all on function public.seleccionar_convocatoria_opcion_horario(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.seleccionar_convocatoria_opcion_horario(uuid, uuid, boolean)
  to authenticated;
