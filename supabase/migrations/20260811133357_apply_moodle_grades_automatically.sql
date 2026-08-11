-- Aplica en practicas.nota las calificaciones validadas por el puente Moodle.
-- La escritura ocurre dentro de la misma transaccion que incorpora la
-- observacion: el navegador nunca recibe permisos directos sobre la nota.

create schema if not exists private;

create table private.moodle_grade_applications (
  id uuid primary key default gen_random_uuid(),
  applied_at timestamptz not null default now(),
  source_observation_id uuid not null unique
    references public.moodle_grade_observations(id) on delete restrict,
  source_observed_at timestamptz not null,
  estudiante_id uuid not null references public.estudiantes(id) on delete restrict,
  practica_id uuid not null references public.practicas(id) on delete restrict,
  cmid bigint not null,
  previous_note text,
  applied_note text not null,
  grade_value numeric not null,
  grade_max numeric not null,
  conversion_rule text not null
    check (conversion_rule in ('direct_legacy_ten_point', 'normalized_to_ten')),
  confidence text not null,
  changed boolean not null
);

comment on table private.moodle_grade_applications is
  'Auditoria append-only de notas Moodle aplicadas automaticamente a practicas.nota.';

create index moodle_grade_applications_practice_latest_idx
  on private.moodle_grade_applications (practica_id, source_observed_at desc);

revoke all on table private.moodle_grade_applications from public, anon, authenticated;
grant select, insert on table private.moodle_grade_applications to service_role;

create or replace function private.apply_moodle_grade_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_note text;
  normalized_grade numeric;
  note_text text;
  conversion_rule text;
  latest_applied_observation timestamptz;
begin
  if new.task_status <> 'graded'
     or new.grade_value is null
     or new.grade_max is null
     or new.grade_max <= 0 then
    return new;
  end if;

  -- El curso tiene tareas historicas configuradas sobre 100 cuyos docentes
  -- cargaron directamente 7, 8, 9 o 10. Para esas lecturas preservamos el
  -- valor. Los porcentajes reales (por ejemplo 80/100 o 83/100) se convierten
  -- a la escala 0-10 del panel. Escalas menores (por ejemplo 2/2) tambien se
  -- normalizan matematicamente a diez.
  if new.grade_max > 10 and new.grade_value <= 10 then
    normalized_grade := round(new.grade_value, 2);
    conversion_rule := 'direct_legacy_ten_point';
  else
    normalized_grade := round((new.grade_value / new.grade_max) * 10, 2);
    conversion_rule := 'normalized_to_ten';
  end if;

  if normalized_grade < 0 or normalized_grade > 10 then
    raise exception 'La nota Moodle normalizada queda fuera del rango 0-10.'
      using errcode = '22003';
  end if;

  note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');

  select max(a.source_observed_at)
    into latest_applied_observation
  from private.moodle_grade_applications a
  where a.practica_id = new.practica_id;

  -- Nunca permitimos que una lectura demorada pise una correccion mas nueva.
  if latest_applied_observation is not null
     and latest_applied_observation > new.observed_at then
    return new;
  end if;

  select p.nota
    into current_note
  from public.practicas p
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id
  for update;

  if not found then
    raise exception 'La practica observada no pertenece al estudiante validado.'
      using errcode = '23503';
  end if;

  if current_note is distinct from note_text then
    update public.practicas
    set nota = note_text
    where id = new.practica_id;
  end if;

  insert into private.moodle_grade_applications (
    source_observation_id,
    source_observed_at,
    estudiante_id,
    practica_id,
    cmid,
    previous_note,
    applied_note,
    grade_value,
    grade_max,
    conversion_rule,
    confidence,
    changed
  ) values (
    new.id,
    new.observed_at,
    new.estudiante_id,
    new.practica_id,
    new.cmid,
    current_note,
    note_text,
    new.grade_value,
    new.grade_max,
    conversion_rule,
    new.confidence,
    current_note is distinct from note_text
  );

  return new;
end;
$$;

revoke all on function private.apply_moodle_grade_observation()
  from public, anon, authenticated;

drop trigger if exists apply_moodle_grade_observation_trigger
  on public.moodle_grade_observations;
create trigger apply_moodle_grade_observation_trigger
after insert on public.moodle_grade_observations
for each row execute function private.apply_moodle_grade_observation();

comment on function private.apply_moodle_grade_observation() is
  'Normaliza una nota Moodle validada, actualiza practicas.nota y registra before/after de forma atomica.';

-- El trigger de practicas debe reconocer explicitamente a service_role. Las
-- sesiones estudiantiles siguen limitadas a fecha_finalizacion.
create or replace function public.check_practica_updates()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if (select auth.role()) = 'service_role'
     or (select auth.uid()) is null
     or (select public.is_admin()) then
    return new;
  end if;

  if (to_jsonb(new) - 'fecha_finalizacion')
     is distinct from
     (to_jsonb(old) - 'fecha_finalizacion') then
    raise exception 'Los datos academicos de la PPS solo pueden ser modificados por coordinacion.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.check_practica_updates() is
  'Fail-closed para estudiantes: solo permite fecha_finalizacion. Coordinacion y service_role mantienen los flujos academicos.';

-- El reporte de discrepancias adopta la misma regla que la aplicacion
-- automatica. Asi permite verificar si la ultima observacion ya fue aplicada.
create or replace function public.get_moodle_grade_discrepancies()
returns table (
  practica_id uuid,
  estudiante_id uuid,
  estudiante_nombre text,
  estudiante_dni text,
  institucion text,
  especialidad text,
  legacy_nota text,
  moodle_status text,
  moodle_grade_value numeric,
  moodle_grade_max numeric,
  moodle_grade_display text,
  moodle_suggested_10_scale numeric,
  observed_at timestamptz,
  comparison_state text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;

  return query
  with normalized as (
    select
      s.*,
      case
        when s.task_status <> 'graded' or s.grade_max is null or s.grade_max <= 0 then null
        when s.grade_max > 10 and s.grade_value <= 10 then round(s.grade_value, 2)
        else round((s.grade_value / s.grade_max) * 10, 2)
      end as panel_grade
    from public.moodle_grade_snapshots s
  )
  select
    p.id,
    p.estudiante_id,
    nullif(btrim(concat_ws(' ', e.nombre, e.apellido)), ''),
    e.dni,
    coalesce(p.nombre_institucion, l.nombre_pps),
    p.especialidad,
    p.nota,
    s.task_status,
    s.grade_value,
    s.grade_max,
    s.grade_display,
    s.panel_grade,
    s.observed_at,
    case
      when s.task_status <> 'graded' then 'not_graded'
      when nullif(btrim(coalesce(p.nota, '')), '') is null
        or lower(btrim(p.nota)) = 'sin calificar' then 'legacy_missing'
      when replace(btrim(p.nota), ',', '.') !~ '^[0-9]+([.][0-9]+)?$' then 'legacy_text'
      when replace(btrim(p.nota), ',', '.')::numeric = s.panel_grade then 'matches_moodle'
      else 'different_from_moodle'
    end
  from normalized s
  join public.practicas p on p.id = s.practica_id
  join public.estudiantes e on e.id = p.estudiante_id
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  order by s.observed_at desc, e.apellido, e.nombre, coalesce(p.nombre_institucion, l.nombre_pps);
end;
$$;

comment on function public.get_moodle_grade_discrepancies() is
  'Reporte admin read-only que compara practicas.nota con la conversion Moodle 0-10 aplicada automaticamente.';
