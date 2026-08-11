begin;

-- A scalar task URL saved by coordination is stronger evidence than a
-- same-name catalogue match. Restrict the correction to launches that have one
-- confirmed task relation so multi-orientation JSON mappings stay untouched.
with raw_urls as (
  select l.id as lanzamiento_id,
         coalesce(
           substring(v.url from '[?&]id=([0-9]+)'),
           substring(trim(v.url) from '^([0-9]+)$')
         ) as moodle_id
  from public.lanzamientos_pps l
  cross join lateral (values (l.codigo_tarjeta_campus), (l.informe)) v(url)
  where nullif(trim(v.url), '') is not null
    and left(ltrim(v.url), 1) <> '{'
), unique_urls as (
  select lanzamiento_id, min(moodle_id) as moodle_id
  from raw_urls
  where moodle_id is not null
  group by lanzamiento_id
  having count(distinct moodle_id) = 1
), single_link_launches as (
  select lanzamiento_id
  from public.lanzamiento_moodle_tareas
  where validation_status = 'confirmed'
  group by lanzamiento_id
  having count(*) = 1
), resolved as (
  select t.id as link_id, a.id as aula_entrega_id
  from unique_urls u
  join single_link_launches s on s.lanzamiento_id = u.lanzamiento_id
  join public.lanzamiento_moodle_tareas t
    on t.lanzamiento_id = u.lanzamiento_id
   and t.validation_status = 'confirmed'
  join public.aula_entregas a
    on a.course_id = 3615
   and a.moodle_id = u.moodle_id
)
update public.lanzamiento_moodle_tareas t
set aula_entrega_id = r.aula_entrega_id,
    link_source = 'legacy_confirmed',
    rationale = 'URL escalar de Tarea Moodle guardada explícitamente por coordinación; prevalece sobre la coincidencia de catálogo.',
    validated_at = statement_timestamp(),
    updated_at = statement_timestamp()
from resolved r
where t.id = r.link_id
  and t.aula_entrega_id is distinct from r.aula_entrega_id;

commit;
