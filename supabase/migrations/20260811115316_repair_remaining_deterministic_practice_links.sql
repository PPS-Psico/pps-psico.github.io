begin;

-- Second deterministic pass for legacy rows whose start or end date was
-- corrected independently. Exact institution + orientation + one matching
-- boundary must still identify a single launch.
create temporary table remaining_moodle_practice_resolutions on commit drop as
with name_start_raw as (
  select distinct p.id as practice_id, l.id as lanzamiento_id
  from public.practicas p
  join public.lanzamientos_pps l
    on lower(regexp_replace(trim(replace(l.nombre_pps, chr(160), ' ')), '[[:space:]]+', ' ', 'g')) =
       lower(regexp_replace(trim(replace(p.nombre_institucion, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
   and left(l.fecha_inicio, 10) is not distinct from left(p.fecha_inicio, 10)
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
name_start as (
  select practice_id, min(lanzamiento_id::text)::uuid as lanzamiento_id
  from name_start_raw
  group by practice_id
  having count(distinct lanzamiento_id) = 1
),
name_end_raw as (
  select distinct p.id as practice_id, l.id as lanzamiento_id
  from public.practicas p
  join public.lanzamientos_pps l
    on lower(regexp_replace(trim(replace(l.nombre_pps, chr(160), ' ')), '[[:space:]]+', ' ', 'g')) =
       lower(regexp_replace(trim(replace(p.nombre_institucion, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
   and left(l.fecha_finalizacion, 10) is not distinct from left(p.fecha_finalizacion, 10)
  where p.lanzamiento_id is null
    and p.tipo_actividad = 'pps'
    and l.tipo_actividad = 'pps'
    and p.fecha_finalizacion is not null
    and (
      nullif(trim(p.especialidad), '') is null
      or nullif(trim(l.orientacion), '') is null
      or translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') || '%'
      or translate(lower(p.especialidad), 'áéíóúüñ', 'aeiouun') like
         '%' || translate(lower(l.orientacion), 'áéíóúüñ', 'aeiouun') || '%'
    )
),
name_end as (
  select practice_id, min(lanzamiento_id::text)::uuid as lanzamiento_id
  from name_end_raw
  group by practice_id
  having count(distinct lanzamiento_id) = 1
)
select p.id as practice_id,
       coalesce(s.lanzamiento_id, e.lanzamiento_id) as lanzamiento_id,
       case when s.lanzamiento_id is not null
         then array['institution_name_orientation_start_date']::text[]
         else array['institution_name_orientation_end_date']::text[]
       end as evidence_sources
from public.practicas p
left join name_start s on s.practice_id = p.id
left join name_end e on e.practice_id = p.id
where p.lanzamiento_id is null
  and coalesce(s.lanzamiento_id, e.lanzamiento_id) is not null;

insert into private.moodle_practice_link_repair_audit (
  practice_id,
  previous_lanzamiento_id,
  repaired_lanzamiento_id,
  evidence_sources
)
select p.id, p.lanzamiento_id, r.lanzamiento_id, r.evidence_sources
from public.practicas p
join remaining_moodle_practice_resolutions r on r.practice_id = p.id
where p.lanzamiento_id is null
on conflict (practice_id) do nothing;

update public.practicas p
set lanzamiento_id = r.lanzamiento_id
from remaining_moodle_practice_resolutions r
where r.practice_id = p.id
  and p.lanzamiento_id is null;

-- One previously empty 2025 Barriletes launch becomes reachable in this pass.
-- Seed its annual task by natural launch attributes, never by generated UUID.
with launch_orientations as (
  select distinct
    l.id as lanzamiento_id,
    case
      when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%clin%' then 'clinica'
      when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%labor%' then 'laboral'
      when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%educ%' then 'educacional'
      when translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%comunit%'
        or translate(lower(coalesce(p.especialidad, l.orientacion, '')), 'áéíóúüñ', 'aeiouun') like '%social%' then 'comunitaria'
      else 'otra'
    end as orientacion_key
  from remaining_moodle_practice_resolutions r
  join public.practicas p on p.id = r.practice_id
  join public.lanzamientos_pps l on l.id = r.lanzamiento_id
  where coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2025'
    and translate(lower(l.nombre_pps), 'áéíóúüñ', 'aeiouun') like '%pensar%barriletes%'
),
resolved as (
  select o.lanzamiento_id, o.orientacion_key, a.id as aula_entrega_id
  from launch_orientations o
  join public.aula_entregas a on a.course_id = 3615 and a.moodle_id = '805657'
)
insert into public.lanzamiento_moodle_tareas (
  lanzamiento_id, orientacion_key, aula_entrega_id, validation_status,
  link_source, rationale, validated_at
)
select lanzamiento_id, orientacion_key, aula_entrega_id, 'confirmed', 'catalog_alias',
       'Barriletes 2025 comparte la tarea anual institucional, corroborada en el libro de calificaciones.',
       statement_timestamp()
from resolved
on conflict (lanzamiento_id, orientacion_key) do nothing;

commit;
