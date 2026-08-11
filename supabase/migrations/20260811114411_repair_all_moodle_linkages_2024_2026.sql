begin;

-- Keep the historical repair reproducible without exposing student-level
-- reconciliation data through the public API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.moodle_practice_link_repair_audit (
  practice_id uuid primary key references public.practicas(id) on delete restrict,
  previous_lanzamiento_id uuid references public.lanzamientos_pps(id) on delete restrict,
  repaired_lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete restrict,
  evidence_sources text[] not null,
  repaired_at timestamptz not null default statement_timestamp(),
  check (coalesce(array_length(evidence_sources, 1), 0) > 0)
);

revoke all on private.moodle_practice_link_repair_audit from public, anon, authenticated;

comment on table private.moodle_practice_link_repair_audit is
  'Bitácora privada del backfill práctica→lanzamiento usado por la integración Moodle. Cada vínculo exige una única conclusión entre fuentes independientes.';

-- A candidate is admitted only when it is unique inside its evidence source.
-- If several sources are available, they must all point to the same launch.
create temporary table moodle_practice_resolution_candidates on commit drop as
with selected_dates_raw as (
  select distinct p.id as practice_id, c.lanzamiento_id
  from public.practicas p
  join public.convocatorias c
    on c.estudiante_id = p.estudiante_id
   and c.estado_inscripcion = 'Seleccionado'
   and c.lanzamiento_id is not null
  join public.lanzamientos_pps l on l.id = c.lanzamiento_id
  where p.lanzamiento_id is null
    and p.tipo_actividad = 'pps'
    and l.tipo_actividad = 'pps'
    and left(l.fecha_inicio, 10) is not distinct from left(p.fecha_inicio, 10)
    and left(l.fecha_finalizacion, 10) is not distinct from left(p.fecha_finalizacion, 10)
    and (
      nullif(trim(p.especialidad), '') is null
      or nullif(trim(l.orientacion), '') is null
      or translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') || '%'
      or translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') || '%'
    )
),
selected_dates as (
  select practice_id, min(lanzamiento_id::text)::uuid as lanzamiento_id,
         'selected_student_and_dates'::text as evidence_source
  from selected_dates_raw
  group by practice_id
  having count(distinct lanzamiento_id) = 1
),
name_dates_raw as (
  select distinct p.id as practice_id, l.id as lanzamiento_id
  from public.practicas p
  join public.lanzamientos_pps l
    on lower(regexp_replace(trim(replace(l.nombre_pps, chr(160), ' ')), '[[:space:]]+', ' ', 'g')) =
       lower(regexp_replace(trim(replace(p.nombre_institucion, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
   and left(l.fecha_inicio, 10) is not distinct from left(p.fecha_inicio, 10)
   and left(l.fecha_finalizacion, 10) is not distinct from left(p.fecha_finalizacion, 10)
  where p.lanzamiento_id is null
    and p.tipo_actividad = 'pps'
    and l.tipo_actividad = 'pps'
    and (
      nullif(trim(p.especialidad), '') is null
      or nullif(trim(l.orientacion), '') is null
      or translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') || '%'
      or translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') || '%'
    )
),
name_dates as (
  select practice_id, min(lanzamiento_id::text)::uuid as lanzamiento_id,
         'institution_name_and_dates'::text as evidence_source
  from name_dates_raw
  group by practice_id
  having count(distinct lanzamiento_id) = 1
),
selected_name_raw as (
  select distinct p.id as practice_id, c.lanzamiento_id
  from public.practicas p
  join public.convocatorias c
    on c.estudiante_id = p.estudiante_id
   and c.estado_inscripcion = 'Seleccionado'
   and c.lanzamiento_id is not null
  join public.lanzamientos_pps l on l.id = c.lanzamiento_id
  where p.lanzamiento_id is null
    and p.tipo_actividad = 'pps'
    and l.tipo_actividad = 'pps'
    and lower(regexp_replace(trim(replace(l.nombre_pps, chr(160), ' ')), '[[:space:]]+', ' ', 'g')) =
        lower(regexp_replace(trim(replace(p.nombre_institucion, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
    and (
      nullif(trim(p.especialidad), '') is null
      or nullif(trim(l.orientacion), '') is null
      or translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') || '%'
      or translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') || '%'
    )
),
selected_name as (
  select practice_id, min(lanzamiento_id::text)::uuid as lanzamiento_id,
         'selected_student_and_institution'::text as evidence_source
  from selected_name_raw
  group by practice_id
  having count(distinct lanzamiento_id) = 1
)
select * from selected_dates
union all select * from name_dates
union all select * from selected_name;

create temporary table moodle_practice_resolutions on commit drop as
select
  practice_id,
  min(lanzamiento_id::text)::uuid as lanzamiento_id,
  array_agg(distinct evidence_source order by evidence_source) as evidence_sources
from moodle_practice_resolution_candidates
group by practice_id
having count(distinct lanzamiento_id) = 1;

insert into private.moodle_practice_link_repair_audit (
  practice_id,
  previous_lanzamiento_id,
  repaired_lanzamiento_id,
  evidence_sources
)
select p.id, p.lanzamiento_id, r.lanzamiento_id, r.evidence_sources
from public.practicas p
join moodle_practice_resolutions r on r.practice_id = p.id
where p.lanzamiento_id is null
on conflict (practice_id) do nothing;

update public.practicas p
set lanzamiento_id = a.repaired_lanzamiento_id
from private.moodle_practice_link_repair_audit a
where a.practice_id = p.id
  and p.lanzamiento_id is null;

-- Canonical orientation keys used by the browser bridge. Academic year follows
-- the practice end date because a cohort may start in December and deliver in
-- the following year's task.
create temporary table moodle_launch_orientations on commit drop as
select distinct
  p.lanzamiento_id,
  coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4))::integer as academic_year,
  case
    when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%clin%' then 'clinica'
    when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%labor%'
      or translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%organiz%' then 'laboral'
    when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%educ%' then 'educacional'
    when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%comunit%'
      or translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%social%'
      or translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%socio%' then 'comunitaria'
    else 'otra'
  end as orientacion_key
from public.practicas p
join public.lanzamientos_pps l on l.id = p.lanzamiento_id
where p.lanzamiento_id is not null
  and p.tipo_actividad = 'pps'
  and coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) ~ '^[0-9]{4}$';

-- URLs already recorded by coordination are first-party evidence. Promote a
-- previous review link only when both stored URL fields agree on one task.
with raw_direct as (
  select l.id as lanzamiento_id,
         coalesce(
           substring(v.url from '[?&]id=([0-9]+)'),
           substring(trim(v.url) from '^([0-9]+)$')
         ) as moodle_id
  from public.lanzamientos_pps l
  cross join lateral (values (l.codigo_tarjeta_campus), (l.informe)) v(url)
  where nullif(trim(v.url), '') is not null
),
unique_direct as (
  select lanzamiento_id, min(moodle_id) as moodle_id
  from raw_direct
  where moodle_id is not null
  group by lanzamiento_id
  having count(distinct moodle_id) = 1
),
resolved_direct as (
  select o.lanzamiento_id, o.orientacion_key, a.id as aula_entrega_id
  from unique_direct d
  join moodle_launch_orientations o on o.lanzamiento_id = d.lanzamiento_id
  join public.aula_entregas a on a.course_id = 3615 and a.moodle_id = d.moodle_id
)
insert into public.lanzamiento_moodle_tareas (
  lanzamiento_id, orientacion_key, aula_entrega_id, validation_status,
  link_source, rationale, validated_at
)
select lanzamiento_id, orientacion_key, aula_entrega_id, 'confirmed',
       'legacy_confirmed',
       'Vínculo confirmado desde la URL de Tarea Moodle guardada por coordinación.',
       statement_timestamp()
from resolved_direct
on conflict (lanzamiento_id, orientacion_key) do update
set aula_entrega_id = excluded.aula_entrega_id,
    validation_status = 'confirmed',
    link_source = excluded.link_source,
    rationale = excluded.rationale,
    validated_at = excluded.validated_at,
    updated_at = statement_timestamp()
where public.lanzamiento_moodle_tareas.validation_status <> 'confirmed';

-- 2024 used explicit institution tasks plus three catch-all tasks by area for
-- legacy cohorts. This is preferable to guessing against the current-year
-- directory in the frontend.
with candidates as (
  select
    o.lanzamiento_id,
    o.orientacion_key,
    case
      when n ~ '(entrevista.*(psicolog|profesional)|uflo.*entrevista)' then '263128'
      when n ~ '(^| )(sau|paos)( |$)' then '273606'
      when n like '%pensar%' then '275376'
      when n like '%crianza%' then '301534'
      when n like '%gestion de emocion%' then '569009'
      when n like '%proyecto de vida%' then '569006'
      when n ~ '(^| )aser( |$)' then '623565'
      when n like '%apasido%' then '630832'
      when n like '%liens%' then '629950'
      when n like '%crybe%' or n like '%rehabilitacion y bienestar emocional%' then '627701'
      when n like '%fernandez oro%' and o.orientacion_key = 'laboral' then '626240'
      when n like '%san jose obrero%' then '625361'
      when n ~ '(ifd|formacion docente).*(n ?6|numero ?6)' then '625787'
      when n like '%parque industrial%' then '631037'
      when n like '%mindfulness%' then '635182'
      when n like '%psicoterapia corporal%' then '631039'
      when n like '%fundacion tiempo%' then '631041'
      when n like '%consumos problem%' then '641298'
      when n ~ '(^| )crea( |$)' then '668671'
      when n like '%banco provincia%' then '690928'
      when n like '%subsecretaria%trabajo%' or n like '%ministerio%trabajo%' then '623118'
      when o.orientacion_key = 'clinica' then '614156'
      when o.orientacion_key = 'educacional' then '614159'
      when o.orientacion_key in ('laboral', 'comunitaria') then '614155'
      else null
    end as moodle_id,
    case
      when n ~ '(entrevista.*(psicolog|profesional)|uflo.*entrevista)'
        or n ~ '(^| )(sau|paos)( |$)'
        or n like '%pensar%'
        or n like '%crianza%'
        or n like '%gestion de emocion%'
        or n like '%proyecto de vida%'
        or n ~ '(^| )aser( |$)'
        or n like '%apasido%'
        or n like '%liens%'
        or n like '%crybe%'
        or n like '%rehabilitacion y bienestar emocional%'
        or n like '%fernandez oro%'
        or n like '%san jose obrero%'
        or n ~ '(ifd|formacion docente).*(n ?6|numero ?6)'
        or n like '%parque industrial%'
        or n like '%mindfulness%'
        or n like '%psicoterapia corporal%'
        or n like '%fundacion tiempo%'
        or n like '%consumos problem%'
        or n ~ '(^| )crea( |$)'
        or n like '%banco provincia%'
        or n like '%subsecretaria%trabajo%'
        or n like '%ministerio%trabajo%'
      then 'catalog_exact' else 'catalog_alias'
    end as link_source
  from (
    select o.*,
           regexp_replace(
             translate(lower(replace(l.nombre_pps, chr(160), ' ')), 'áéíóúüñ', 'aeiouun'),
             '[^a-z0-9]+', ' ', 'g'
           ) as n
    from moodle_launch_orientations o
    join public.lanzamientos_pps l on l.id = o.lanzamiento_id
    where o.academic_year = 2024
  ) o
),
resolved as (
  select c.lanzamiento_id, c.orientacion_key, a.id as aula_entrega_id, c.link_source
  from candidates c
  join public.aula_entregas a on a.course_id = 3615 and a.moodle_id = c.moodle_id
  where c.moodle_id is not null
)
insert into public.lanzamiento_moodle_tareas (
  lanzamiento_id, orientacion_key, aula_entrega_id, validation_status,
  link_source, rationale, validated_at
)
select lanzamiento_id, orientacion_key, aula_entrega_id, 'confirmed', link_source,
       case when link_source = 'catalog_exact'
         then 'Tarea 2024 específica para la institución o actividad, contrastada con el libro de calificaciones.'
         else 'Tarea general 2024 de la orientación para cohortes históricas, contrastada con la estructura del curso.'
       end,
       statement_timestamp()
from resolved
on conflict (lanzamiento_id, orientacion_key) do update
set aula_entrega_id = excluded.aula_entrega_id,
    validation_status = 'confirmed',
    link_source = excluded.link_source,
    rationale = excluded.rationale,
    validated_at = excluded.validated_at,
    updated_at = statement_timestamp()
where public.lanzamiento_moodle_tareas.validation_status <> 'confirmed';

-- Missing 2025 links with unambiguous catalogue, saved-URL or gradebook
-- evidence. AYUN and Escuela Cooperativa N8 intentionally remain unlinked
-- because the Moodle course has no identifiable task for them.
with candidates as (
  select
    o.lanzamiento_id,
    o.orientacion_key,
    case
      when n like '%pensar%barriletes%' then '805657'
      when n like '%banco provincia%' then '690928'
      when n like '%camioneros%' then '906141'
      when n like '%escuela cristiana vida%' then '915629'
      when n like '%escuela integral%discapacidad%n 7%' then '794670'
      when n like '%hospital centenario%' then '924909'
      when n like '%ulloa%entrevista%' then '920727'
      when n like '%ulloa%' then '926287'
      when n ~ '(ifd|formacion docente).*(n ?4|numero ?4)' then '907745'
      when n ~ '(ifd|formacion docente).*(n ?6|numero ?6)' then '905705'
      when n like '%fernandez oro%' then '769021'
      when n like '%sanatorio juan xxiii%' then '903035'
      when n like '%consumos problem%' and l.fecha_inicio < '2025-04-01' then '752521'
      when n like '%consumos problem%' then '795721'
      else null
    end as moodle_id
  from (
    select o.*,
           regexp_replace(
             translate(lower(replace(l.nombre_pps, chr(160), ' ')), 'áéíóúüñ', 'aeiouun'),
             '[^a-z0-9]+', ' ', 'g'
           ) as n
    from moodle_launch_orientations o
    join public.lanzamientos_pps l on l.id = o.lanzamiento_id
    where o.academic_year = 2025
  ) o
  join public.lanzamientos_pps l on l.id = o.lanzamiento_id
),
resolved as (
  select c.lanzamiento_id, c.orientacion_key, a.id as aula_entrega_id,
         case when a.academic_year = 2025 then 'catalog_alias' else 'legacy_cross_year' end as link_source
  from candidates c
  join public.aula_entregas a on a.course_id = 3615 and a.moodle_id = c.moodle_id
  where c.moodle_id is not null
)
insert into public.lanzamiento_moodle_tareas (
  lanzamiento_id, orientacion_key, aula_entrega_id, validation_status,
  link_source, rationale, validated_at
)
select lanzamiento_id, orientacion_key, aula_entrega_id, 'confirmed', link_source,
       'Vínculo 2025 reconstruido con nombre institucional, cohorte y libro de calificaciones de Moodle.',
       statement_timestamp()
from resolved
on conflict (lanzamiento_id, orientacion_key) do update
set aula_entrega_id = excluded.aula_entrega_id,
    validation_status = 'confirmed',
    link_source = excluded.link_source,
    rationale = excluded.rationale,
    validated_at = excluded.validated_at,
    updated_at = statement_timestamp()
where public.lanzamiento_moodle_tareas.validation_status <> 'confirmed';

-- These 2026 cohorts demonstrably reused the institution task already present
-- in Moodle. Brochero remains unlinked because no task exists in the course.
with candidates as (
  select
    o.lanzamiento_id,
    o.orientacion_key,
    case
      when n ~ '(^| )aser( |$)' then '805658'
      when n like '%camioneros%' then '906141'
      when n like '%ulloa%ateneo%' then '926287'
      else null
    end as moodle_id
  from (
    select o.*,
           regexp_replace(
             translate(lower(replace(l.nombre_pps, chr(160), ' ')), 'áéíóúüñ', 'aeiouun'),
             '[^a-z0-9]+', ' ', 'g'
           ) as n
    from moodle_launch_orientations o
    join public.lanzamientos_pps l on l.id = o.lanzamiento_id
    where o.academic_year = 2026
  ) o
),
resolved as (
  select c.lanzamiento_id, c.orientacion_key, a.id as aula_entrega_id
  from candidates c
  join public.aula_entregas a on a.course_id = 3615 and a.moodle_id = c.moodle_id
  where c.moodle_id is not null
)
insert into public.lanzamiento_moodle_tareas (
  lanzamiento_id, orientacion_key, aula_entrega_id, validation_status,
  link_source, rationale, validated_at
)
select lanzamiento_id, orientacion_key, aula_entrega_id, 'confirmed',
       'legacy_cross_year',
       'La cohorte 2026 reutiliza la tarea institucional previa; el vínculo fue corroborado con el libro de calificaciones.',
       statement_timestamp()
from resolved
on conflict (lanzamiento_id, orientacion_key) do update
set aula_entrega_id = excluded.aula_entrega_id,
    validation_status = 'confirmed',
    link_source = excluded.link_source,
    rationale = excluded.rationale,
    validated_at = excluded.validated_at,
    updated_at = statement_timestamp()
where public.lanzamiento_moodle_tareas.validation_status <> 'confirmed';

commit;
