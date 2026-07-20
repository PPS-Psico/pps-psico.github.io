-- PREVISUALIZACIÓN SOLAMENTE.
-- Este archivo prueba los dos backfills determinísticos y termina con ROLLBACK.
-- Conteos esperados al 2026-07-17:
--   lanzamientos_pps.institucion_id: 68 actualizaciones, 1 caso ambiguo.
--   practicas.lanzamiento_id: 317 actualizaciones unívocas por nombre + fecha.

begin;

with institution_candidates as (
  select
    l.id as lanzamiento_id,
    count(i.id)::integer as candidate_count,
    (array_agg(i.id order by i.id))[1] as institucion_id
  from public.lanzamientos_pps as l
  join public.instituciones as i
    on lower(regexp_replace(trim(i.nombre), '\s+', ' ', 'g')) =
       lower(regexp_replace(trim(l.nombre_pps), '\s+', ' ', 'g'))
  where l.tipo_actividad = 'pps'
    and l.fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}'
    and l.institucion_id is null
  group by l.id
),
updated_launches as (
  update public.lanzamientos_pps as l
  set
    institucion_id = c.institucion_id::text,
    updated_at = statement_timestamp()
  from institution_candidates as c
  where l.id = c.lanzamiento_id
    and c.candidate_count = 1
    and l.institucion_id is null
  returning l.id
)
select count(*)::integer as institution_links_that_would_be_updated
from updated_launches;

with practice_candidates as (
  select
    p.id as practica_id,
    count(l.id)::integer as candidate_count,
    (array_agg(l.id order by l.id))[1] as lanzamiento_id
  from public.practicas as p
  join public.lanzamientos_pps as l
    on lower(regexp_replace(trim(l.nombre_pps), '\s+', ' ', 'g')) =
       lower(regexp_replace(trim(p.nombre_institucion), '\s+', ' ', 'g'))
   and left(l.fecha_inicio, 10) = left(p.fecha_inicio, 10)
   and l.tipo_actividad = 'pps'
  where p.tipo_actividad = 'pps'
    and p.fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}'
    and p.lanzamiento_id is null
  group by p.id
),
updated_practices as (
  update public.practicas as p
  set lanzamiento_id = c.lanzamiento_id
  from practice_candidates as c
  where p.id = c.practica_id
    and c.candidate_count = 1
    and p.lanzamiento_id is null
  returning p.id
)
select count(*)::integer as practice_links_that_would_be_updated
from updated_practices;

select
  count(*)::integer as launches_2024,
  count(*) filter (where institucion_id is not null)::integer as launches_with_institution
from public.lanzamientos_pps
where tipo_actividad = 'pps'
  and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}';

select
  count(*)::integer as practices_2024,
  count(*) filter (where lanzamiento_id is not null)::integer as practices_with_launch
from public.practicas
where tipo_actividad = 'pps'
  and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}';

rollback;
