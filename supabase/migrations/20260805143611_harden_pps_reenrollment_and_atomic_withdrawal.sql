-- Defensa en profundidad para dos reglas operativas:
-- 1. una PPS ya realizada no puede volver a generar una inscripción;
-- 2. la baja, la eliminación de la práctica activa y la penalización son atómicas.

create or replace function private.normalize_pps_key(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(
        btrim(
          replace(coalesce(p_value, ''), chr(160), ' '),
          E' {}"'
        )
      ),
      'áéíóúüñ',
      'aeiouun'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  );
$$;

create or replace function private.pps_group_key(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select private.normalize_pps_key(split_part(coalesce(p_value, ''), ' - ', 1));
$$;

create or replace function private.student_completed_launch(
  p_student_id uuid,
  p_launch_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_launch public.lanzamientos_pps%rowtype;
  v_launch_key text;
  v_group_key text;
  v_orientations text[];
begin
  select l.*
  into v_launch
  from public.lanzamientos_pps as l
  where l.id = p_launch_id;

  if not found or v_launch.tipo_actividad is distinct from 'pps' then
    return false;
  end if;

  v_launch_key := private.normalize_pps_key(v_launch.nombre_pps);
  v_group_key := private.pps_group_key(v_launch.nombre_pps);

  select coalesce(array_agg(private.normalize_pps_key(item)), array[]::text[])
  into v_orientations
  from unnest(string_to_array(coalesce(v_launch.orientacion, ''), ',')) as orientations(item)
  where private.normalize_pps_key(item) <> '';

  -- En lanzamientos multi-orientación se permite cursar las orientaciones
  -- pendientes. Recién se bloquea cuando ya fueron aprobadas todas.
  if cardinality(v_orientations) > 1 then
    return not exists (
      select 1
      from unnest(v_orientations) as orientations(required_orientation)
      where not exists (
        select 1
        from public.practicas as p
        where p.estudiante_id = p_student_id
          and p.tipo_actividad = 'pps'
          and p.estado in ('Finalizada', 'Convenio Realizado')
          and (
            p.lanzamiento_id = p_launch_id
            or private.pps_group_key(p.nombre_institucion) = v_group_key
          )
          and private.normalize_pps_key(p.especialidad) = required_orientation
      )
    );
  end if;

  return exists (
    select 1
    from public.practicas as p
    where p.estudiante_id = p_student_id
      and p.tipo_actividad = 'pps'
      and p.estado in ('Finalizada', 'Convenio Realizado')
      and (
        p.lanzamiento_id = p_launch_id
        or private.normalize_pps_key(p.nombre_institucion) = v_launch_key
      )
  );
end;
$$;

revoke all on function private.normalize_pps_key(text) from public, anon, authenticated;
revoke all on function private.pps_group_key(text) from public, anon, authenticated;
revoke all on function private.student_completed_launch(uuid, uuid) from public, anon, authenticated;

create or replace function private.block_completed_pps_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.estado_inscripcion, '') not in ('Inscripto', 'Seleccionado') then
    return new;
  end if;

  -- En un UPDATE sólo reevaluamos cuando se intenta activar/reactivar la fila
  -- o cambiar la identidad de la inscripción. Las ediciones ordinarias de una
  -- inscripción vigente no deben fallar cuando la PPS termine más adelante.
  if tg_op = 'UPDATE'
     and new.estudiante_id is not distinct from old.estudiante_id
     and new.lanzamiento_id is not distinct from old.lanzamiento_id
     and new.estado_inscripcion is not distinct from old.estado_inscripcion then
    return new;
  end if;

  if private.student_completed_launch(new.estudiante_id, new.lanzamiento_id) then
    raise exception 'Ya realizaste esta PPS. No podés volver a inscribirte.'
      using errcode = 'P0001',
            hint = 'Las PPS desaprobadas o no concretadas no activan este bloqueo.';
  end if;

  return new;
end;
$$;

revoke all on function private.block_completed_pps_enrollment() from public, anon, authenticated;

drop trigger if exists block_completed_pps_enrollment_insert on public.convocatorias;
create trigger block_completed_pps_enrollment_insert
before insert on public.convocatorias
for each row execute function private.block_completed_pps_enrollment();

drop trigger if exists block_completed_pps_enrollment_update on public.convocatorias;
create trigger block_completed_pps_enrollment_update
before update of estado_inscripcion, estudiante_id, lanzamiento_id on public.convocatorias
for each row execute function private.block_completed_pps_enrollment();

-- Una deselección sólo elimina la práctica activa. Los estados terminales
-- (especialmente Desaprobada) conservan siempre el antecedente.
do $$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef('public.handle_seleccion_alumno()'::regprocedure)
  into v_definition;

  v_patched := replace(
    v_definition,
    E'AND estado IS DISTINCT FROM ''Desaprobada'';',
    E'AND estado = ''En curso'';'
  );

  if v_patched = v_definition then
    raise exception 'No se pudo limitar la baja automática a prácticas En curso';
  end if;

  execute v_patched;
end;
$$;

create or replace function public.dar_baja_pps_con_penalizacion(
  p_convocatoria_id uuid,
  p_tipo_incumplimiento text,
  p_notas text default null,
  p_fecha_incidente date default ((now() at time zone 'America/Argentina/Buenos_Aires')::date)
)
returns table (penalizacion_id uuid, practicas_eliminadas integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_convocatoria public.convocatorias%rowtype;
  v_launch_name text;
  v_penalty_score numeric;
  v_penalty_id uuid;
  v_practice_count integer;
begin
  if not public.is_admin() then
    raise exception 'Sólo coordinación puede registrar una baja con penalización.'
      using errcode = '42501';
  end if;

  v_penalty_score := case p_tipo_incumplimiento
    when 'Baja Anticipada' then 30
    when 'Baja sobre la Fecha / Ausencia en Inicio' then 50
    when 'Abandono durante la PPS' then 70
    when 'Falta sin Aviso' then 40
    when 'Baja Administrativa / Sin Penalización' then 0
    else null
  end;

  if v_penalty_score is null then
    raise exception 'El tipo de baja no es válido.' using errcode = '22023';
  end if;

  select c.*
  into v_convocatoria
  from public.convocatorias as c
  where c.id = p_convocatoria_id
  for update;

  if not found then
    raise exception 'No se encontró la inscripción indicada.' using errcode = 'P0002';
  end if;

  if v_convocatoria.estado_inscripcion = 'No Seleccionado' then
    raise exception 'La inscripción ya se encuentra dada de baja.' using errcode = 'P0001';
  end if;

  select l.nombre_pps
  into v_launch_name
  from public.lanzamientos_pps as l
  where l.id = v_convocatoria.lanzamiento_id;

  select count(*)::integer
  into v_practice_count
  from public.practicas as p
  where p.estudiante_id = v_convocatoria.estudiante_id
    and p.lanzamiento_id = v_convocatoria.lanzamiento_id
    and p.estado = 'En curso';

  update public.convocatorias
  set estado_inscripcion = 'No Seleccionado',
      selected_at = null,
      reminder_sent_at = null,
      baja_automatica_at = null
  where id = v_convocatoria.id;

  -- Cubre también inconsistencias legacy donde la inscripción no figuraba como
  -- Seleccionado pero sí había quedado una práctica activa vinculada.
  delete from public.practicas
  where estudiante_id = v_convocatoria.estudiante_id
    and lanzamiento_id = v_convocatoria.lanzamiento_id
    and estado = 'En curso';

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
    v_convocatoria.estudiante_id,
    p_tipo_incumplimiento,
    p_fecha_incidente::text,
    nullif(btrim(p_notas), ''),
    v_penalty_score,
    coalesce(v_launch_name, 'PPS'),
    v_convocatoria.id,
    v_convocatoria.lanzamiento_id
  )
  returning id into v_penalty_id;

  return query select v_penalty_id, v_practice_count;
end;
$$;

revoke all on function public.dar_baja_pps_con_penalizacion(uuid, text, text, date)
from public, anon;
grant execute on function public.dar_baja_pps_con_penalizacion(uuid, text, text, date)
to authenticated;

comment on function public.dar_baja_pps_con_penalizacion(uuid, text, text, date) is
  'Baja atómica para coordinación: deselecciona, elimina sólo la práctica En curso y registra la penalización con puntaje canónico.';
