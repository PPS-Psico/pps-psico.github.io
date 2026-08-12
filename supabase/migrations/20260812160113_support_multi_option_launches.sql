-- Mega-convocatorias: una oferta canónica con orientaciones y dispositivos
-- operativos. La elegibilidad se resuelve por institución + orientación; los
-- dispositivos conservan su propia capacidad y sirven para preferencia/asignación.

alter table public.lanzamientos_pps
  add column if not exists finalizacion_por_horas boolean not null default false;

comment on column public.lanzamientos_pps.finalizacion_por_horas is
  'Si es true, cada práctica finaliza individualmente al alcanzar horas_acreditadas; el lanzamiento puede no tener fecha_finalizacion global.';

create table if not exists public.lanzamiento_opciones (
  id uuid primary key default gen_random_uuid(),
  lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete cascade,
  nombre text not null check (nullif(btrim(nombre), '') is not null),
  orientacion text not null check (nullif(btrim(orientacion), '') is not null),
  cupos integer not null check (cupos > 0),
  horarios text[] not null default '{}'::text[],
  actividades text[] not null default '{}'::text[],
  requisitos text[] not null default '{}'::text[],
  ubicacion text,
  orden smallint not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lanzamiento_id, nombre, orientacion)
);

comment on table public.lanzamiento_opciones is
  'Dispositivos o destinos elegibles dentro de una única convocatoria. No alteran el grano analítico de oferta, que sigue siendo lanzamientos_pps.';

create index if not exists idx_lanzamiento_opciones_launch_order
  on public.lanzamiento_opciones (lanzamiento_id, orden, nombre);
create index if not exists idx_lanzamiento_opciones_orientation
  on public.lanzamiento_opciones (lanzamiento_id, orientacion)
  where activa;

alter table public.convocatorias
  add column if not exists opcion_asignada_id uuid
    references public.lanzamiento_opciones(id) on delete set null;

create index if not exists idx_convocatorias_opcion_asignada
  on public.convocatorias (opcion_asignada_id)
  where opcion_asignada_id is not null;

create table if not exists public.convocatoria_preferencias (
  id uuid primary key default gen_random_uuid(),
  convocatoria_id uuid not null references public.convocatorias(id) on delete cascade,
  opcion_id uuid not null references public.lanzamiento_opciones(id) on delete restrict,
  prioridad smallint not null check (prioridad > 0),
  created_at timestamptz not null default now(),
  unique (convocatoria_id, opcion_id),
  unique (convocatoria_id, prioridad)
);

comment on table public.convocatoria_preferencias is
  'Preferencias ordenadas del estudiante dentro de una mega-convocatoria; la inscripción continúa teniendo grano estudiante-lanzamiento.';

create index if not exists idx_convocatoria_preferencias_opcion
  on public.convocatoria_preferencias (opcion_id, prioridad);

alter table public.practicas
  add column if not exists opcion_id uuid
    references public.lanzamiento_opciones(id) on delete set null,
  add column if not exists institucion_id uuid
    references public.instituciones(id) on delete set null;

create index if not exists idx_practicas_opcion_id
  on public.practicas (opcion_id)
  where opcion_id is not null;
create index if not exists idx_practicas_institucion_orientacion
  on public.practicas (institucion_id, especialidad)
  where institucion_id is not null;

-- Completa la identidad institucional histórica cuando el lanzamiento ya la posee.
update public.practicas p
set institucion_id = l.institucion_id::uuid
from public.lanzamientos_pps l
where p.lanzamiento_id = l.id
  and p.institucion_id is null
  and l.institucion_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

alter table public.lanzamiento_opciones enable row level security;
alter table public.convocatoria_preferencias enable row level security;

drop policy if exists "Leer opciones de lanzamientos" on public.lanzamiento_opciones;
create policy "Leer opciones de lanzamientos"
on public.lanzamiento_opciones for select
using (true);

drop policy if exists "Admin insert lanzamiento opciones" on public.lanzamiento_opciones;
create policy "Admin insert lanzamiento opciones"
on public.lanzamiento_opciones for insert
with check ((select public.is_admin()));

drop policy if exists "Admin update lanzamiento opciones" on public.lanzamiento_opciones;
create policy "Admin update lanzamiento opciones"
on public.lanzamiento_opciones for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admin delete lanzamiento opciones" on public.lanzamiento_opciones;
create policy "Admin delete lanzamiento opciones"
on public.lanzamiento_opciones for delete
using ((select public.is_admin()));

drop policy if exists "Ver preferencias propias o admin" on public.convocatoria_preferencias;
create policy "Ver preferencias propias o admin"
on public.convocatoria_preferencias for select
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.convocatorias c
    join public.estudiantes e on e.id = c.estudiante_id
    where c.id = convocatoria_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists "Crear preferencias propias o admin" on public.convocatoria_preferencias;
create policy "Crear preferencias propias o admin"
on public.convocatoria_preferencias for insert
with check (
  (select public.is_admin())
  or exists (
    select 1
    from public.convocatorias c
    join public.estudiantes e on e.id = c.estudiante_id
    where c.id = convocatoria_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists "Actualizar preferencias propias o admin" on public.convocatoria_preferencias;
create policy "Actualizar preferencias propias o admin"
on public.convocatoria_preferencias for update
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.convocatorias c
    join public.estudiantes e on e.id = c.estudiante_id
    where c.id = convocatoria_id
      and e.user_id = (select auth.uid())
      and c.estado_inscripcion = 'Inscripto'
  )
)
with check (
  (select public.is_admin())
  or exists (
    select 1
    from public.convocatorias c
    join public.estudiantes e on e.id = c.estudiante_id
    where c.id = convocatoria_id
      and e.user_id = (select auth.uid())
      and c.estado_inscripcion = 'Inscripto'
  )
);

drop policy if exists "Borrar preferencias propias o admin" on public.convocatoria_preferencias;
create policy "Borrar preferencias propias o admin"
on public.convocatoria_preferencias for delete
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.convocatorias c
    join public.estudiantes e on e.id = c.estudiante_id
    where c.id = convocatoria_id
      and e.user_id = (select auth.uid())
      and c.estado_inscripcion = 'Inscripto'
  )
);

grant select on public.lanzamiento_opciones to anon, authenticated;
grant insert, update, delete on public.lanzamiento_opciones to authenticated;
grant select, insert, update, delete on public.convocatoria_preferencias to authenticated;

create or replace function private.validate_convocatoria_preferencia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_conv_launch uuid;
  v_option_launch uuid;
begin
  select c.lanzamiento_id into v_conv_launch
  from public.convocatorias c
  where c.id = new.convocatoria_id;

  select o.lanzamiento_id into v_option_launch
  from public.lanzamiento_opciones o
  where o.id = new.opcion_id and o.activa;

  if v_conv_launch is null or v_option_launch is null or v_conv_launch <> v_option_launch then
    raise exception 'La opción no pertenece a la convocatoria seleccionada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_convocatoria_preferencia on public.convocatoria_preferencias;
create trigger trg_validate_convocatoria_preferencia
before insert or update on public.convocatoria_preferencias
for each row execute function private.validate_convocatoria_preferencia();

create or replace function private.ensure_convocatoria_option_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_option public.lanzamiento_opciones%rowtype;
  v_used integer;
begin
  if new.opcion_asignada_id is null or new.estado_inscripcion <> 'Seleccionado' then
    return new;
  end if;

  select * into v_option
  from public.lanzamiento_opciones o
  where o.id = new.opcion_asignada_id and o.activa
  for update;

  if v_option.id is null or v_option.lanzamiento_id <> new.lanzamiento_id then
    raise exception 'La opción asignada no pertenece a esta convocatoria.';
  end if;

  select count(*) into v_used
  from public.convocatorias c
  where c.opcion_asignada_id = new.opcion_asignada_id
    and c.estado_inscripcion = 'Seleccionado'
    and c.id <> new.id;

  if v_used >= v_option.cupos then
    raise exception 'El dispositivo seleccionado ya no tiene cupos disponibles.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_convocatoria_option_capacity on public.convocatorias;
create trigger trg_convocatoria_option_capacity
before insert or update of opcion_asignada_id, estado_inscripcion
on public.convocatorias
for each row execute function private.ensure_convocatoria_option_capacity();

create or replace function public.inscribir_convocatoria_multiopcion(
  p_lanzamiento_id uuid,
  p_opcion_ids uuid[],
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
  v_option_count integer;
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

  if v_launch.id is null or lower(coalesce(v_launch.estado_convocatoria, '')) not in ('abierta', 'abierto') then
    raise exception 'La convocatoria no está abierta para inscripciones.';
  end if;
  if coalesce(cardinality(p_opcion_ids), 0) = 0 then
    raise exception 'Elegí al menos un dispositivo.';
  end if;

  select count(*), count(distinct o.id)
  into v_option_count, v_distinct_count
  from public.lanzamiento_opciones o
  where o.id = any(p_opcion_ids)
    and o.lanzamiento_id = p_lanzamiento_id
    and o.activa;

  if v_option_count <> cardinality(p_opcion_ids) or v_distinct_count <> cardinality(p_opcion_ids) then
    raise exception 'Una o más opciones no pertenecen a esta convocatoria.';
  end if;

  select string_agg(distinct o.orientacion, ', ' order by o.orientacion)
  into v_blocked
  from public.lanzamiento_opciones o
  where o.id = any(p_opcion_ids)
    and exists (
      select 1
      from public.practicas p
      left join public.lanzamientos_pps previous_launch on previous_launch.id = p.lanzamiento_id
      where p.estudiante_id = v_student.id
        and lower(coalesce(p.estado, '')) in ('finalizada', 'pps realizada', 'convenio realizado', 'aprobada', 'en curso')
        and lower(btrim(coalesce(p.especialidad, ''))) = lower(btrim(o.orientacion))
        and (
          (p.institucion_id is not null and p.institucion_id::text = v_launch.institucion_id)
          or (previous_launch.institucion_id is not null and previous_launch.institucion_id = v_launch.institucion_id)
          or lower(btrim(coalesce(p.nombre_institucion, ''))) = lower(btrim(coalesce(v_launch.nombre_pps, '')))
        )
    );

  if v_blocked is not null then
    raise exception 'Ya cursaste o estás cursando la orientación % en esta institución.', v_blocked;
  end if;

  select string_agg(distinct o.orientacion, ', ' order by o.orientacion),
         string_agg(o.nombre, '; ' order by array_position(p_opcion_ids, o.id))
  into v_orientation, v_preference_labels
  from public.lanzamiento_opciones o
  where o.id = any(p_opcion_ids);

  insert into public.convocatorias (
    lanzamiento_id, estudiante_id, estado_inscripcion, termino_cursar,
    cursando_electivas, finales_adeuda, otra_situacion_academica,
    horario_seleccionado, trabaja, certificado_trabajo, cv_url,
    nombre_pps, fecha_inicio, fecha_finalizacion, orientacion,
    horas_acreditadas, direccion, legajo, correo, telefono, dni
  ) values (
    v_launch.id, v_student.id, 'Inscripto', p_datos->>'termino_cursar',
    p_datos->>'cursando_electivas', p_datos->>'finales_adeuda', p_datos->>'otra_situacion_academica',
    v_preference_labels, coalesce((p_datos->>'trabaja')::boolean, false),
    nullif(p_datos->>'certificado_trabajo', ''), nullif(p_datos->>'cv_url', ''),
    v_launch.nombre_pps, v_launch.fecha_inicio,
    case when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
    v_orientation, v_launch.horas_acreditadas, v_launch.direccion,
    nullif(p_datos->>'legajo', '')::numeric, v_student.correo, v_student.telefono, v_student.dni
  )
  returning * into v_conv;

  insert into public.convocatoria_preferencias (convocatoria_id, opcion_id, prioridad)
  select v_conv.id, option_id, ordinality::smallint
  from unnest(p_opcion_ids) with ordinality as selected(option_id, ordinality);

  return v_conv;
end;
$$;

revoke all on function public.inscribir_convocatoria_multiopcion(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.inscribir_convocatoria_multiopcion(uuid, uuid[], jsonb) to authenticated;

create or replace function public.seleccionar_convocatoria_opcion(
  p_convocatoria_id uuid,
  p_opcion_id uuid,
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
  v_schedule text;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permisos para gestionar la selección.';
  end if;

  select * into v_conv from public.convocatorias where id = p_convocatoria_id for update;
  if v_conv.id is null then raise exception 'Inscripción inexistente.'; end if;
  select * into v_launch from public.lanzamientos_pps where id = v_conv.lanzamiento_id;

  if p_seleccionar then
    select * into v_option
    from public.lanzamiento_opciones
    where id = p_opcion_id and lanzamiento_id = v_conv.lanzamiento_id and activa
    for update;
    if v_option.id is null then raise exception 'Elegí un dispositivo válido.'; end if;

    v_schedule := v_option.nombre || case
      when cardinality(v_option.horarios) > 0 then ' · ' || array_to_string(v_option.horarios, ' / ')
      else '' end;

    update public.convocatorias
    set estado_inscripcion = 'Seleccionado', opcion_asignada_id = v_option.id,
        horario_asignado = v_schedule, orientacion = v_option.orientacion,
        selected_at = now(), reminder_sent_at = null, baja_automatica_at = null
    where id = v_conv.id;

    update public.practicas
    set opcion_id = v_option.id,
        institucion_id = case
          when v_launch.institucion_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
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
        estudiante_id, lanzamiento_id, opcion_id, institucion_id,
        nombre_institucion, especialidad, fecha_inicio, fecha_finalizacion,
        horas_realizadas, estado, nota, informe_estado
      ) values (
        v_conv.estudiante_id, v_launch.id, v_option.id,
        case when v_launch.institucion_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then v_launch.institucion_id::uuid else null end,
        v_launch.nombre_pps, v_option.orientacion, v_launch.fecha_inicio,
        case when v_launch.finalizacion_por_horas then null else v_launch.fecha_finalizacion end,
        0, 'En curso', null, null
      );
    end if;
  else
    update public.convocatorias
    set estado_inscripcion = 'Inscripto', opcion_asignada_id = null,
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

revoke all on function public.seleccionar_convocatoria_opcion(uuid, uuid, boolean) from public, anon;
grant execute on function public.seleccionar_convocatoria_opcion(uuid, uuid, boolean) to authenticated;

create or replace function private.finish_hour_based_practice()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_by_hours boolean;
  v_target numeric;
begin
  select l.finalizacion_por_horas, l.horas_acreditadas
  into v_by_hours, v_target
  from public.lanzamientos_pps l
  where l.id = new.lanzamiento_id;

  if v_by_hours and coalesce(new.horas_realizadas, 0) >= coalesce(v_target, 70) then
    new.estado := 'Finalizada';
    new.fecha_finalizacion := coalesce(new.fecha_finalizacion, current_date::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_finish_hour_based_practice on public.practicas;
create trigger trg_finish_hour_based_practice
before insert or update of horas_realizadas on public.practicas
for each row execute function private.finish_hour_based_practice();
