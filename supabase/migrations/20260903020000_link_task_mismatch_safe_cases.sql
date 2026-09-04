begin;

-- `task_mismatch` es el motivo más numeroso entre las filas que el barrido lee
-- de Campus y descarta: el alumno entregó en una tarea distinta a la que apunta
-- su práctica. En crudo asustaba -- 178 filas de 97 alumnos -- pero al preguntar
-- cuáles corresponden a una práctica terminada y todavía sin corregir, el
-- conjunto se derrumba: 113 diagnósticos distintos, 58 con tarea del área, y
-- sólo 4 con una única práctica candidata e institución coincidente. El resto
-- son alumnos cuyo informe ya está corregido por otra vía, o casos ambiguos que
-- no se pueden decidir sin mirarlos.
--
-- `resolve_safe_jefe_moodle_links_v1` no los cubre: exige
-- `reason = 'practice_without_confirmed_task_link'` y `linked_task_count = 0`, y
-- en un mismatch el vínculo existe pero apunta a otra tarea. Se aplican acá los
-- cuatro seguros con la misma vara que usa ese resolvedor -- orientación igual,
-- práctica única, similitud de institución >= 0.75 -- y quedan marcados con
-- `link_source = 'jefe_observed'` para poder revertirlos identificándolos.
--
-- Los cuatro tienen similitud 1.00: Cerda (20744), Luna (32236) y Castillo
-- (32260) contra "Camioneros", y Espinoza (24968) contra "Sanatorio Juan XXIII".

with diag as (
  select distinct on (d.estudiante_id, d.cmid)
    d.id, d.estudiante_id, d.cmid, d.course_id, d.area_keys
  from private.moodle_jefe_unmatched_diagnostics d
  where d.reason = 'task_mismatch'
    and d.resolution_status in ('pending', 'needs_review')
  order by d.estudiante_id, d.cmid, d.observed_at desc, d.id desc
), tarea as (
  select g.*, ae.id as aula_entrega_id, ae.area as task_area, ae.institucion as task_institucion
  from diag g
  join public.aula_entregas ae
    on ae.course_id = g.course_id
   and nullif(regexp_replace(coalesce(ae.moodle_id, ''), '\D', '', 'g'), '')::bigint = g.cmid
  where private.moodle_orientation_key(ae.area) = any (g.area_keys)
), cand as (
  select t.id as diagnostic_id, t.aula_entrega_id, p.id as practica_id,
    greatest(
      public.similarity(
        translate(lower(coalesce(t.task_institucion, '')), 'áéíóúüñ', 'aeiouun'),
        translate(lower(coalesce(p.nombre_institucion, '')), 'áéíóúüñ', 'aeiouun')),
      public.word_similarity(
        translate(lower(coalesce(t.task_institucion, '')), 'áéíóúüñ', 'aeiouun'),
        translate(lower(coalesce(p.nombre_institucion, '')), 'áéíóúüñ', 'aeiouun'))
    ) as score,
    count(*) over (partition by t.id) as candidatos
  from tarea t
  join public.practicas p
    on p.estudiante_id = t.estudiante_id
   and private.moodle_orientation_key(p.especialidad) = private.moodle_orientation_key(t.task_area)
  where lower(trim(coalesce(p.estado, ''))) = 'finalizada'
    and coalesce(p.informe_estado, '') <> 'calificado'
    and coalesce(p.nota, '') !~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
    and not exists (
      select 1 from public.practica_moodle_tareas l where l.practica_id = p.id
    )
), seguros as (
  select * from cand where candidatos = 1 and score >= 0.75
), insertados as (
  insert into public.practica_moodle_tareas (
    practica_id, aula_entrega_id, validation_status, link_source, rationale, validated_at
  )
  select s.practica_id, s.aula_entrega_id, 'confirmed', 'jefe_observed',
         'jefe-task-mismatch/v1: entrega observada en otra tarea, institución única y misma orientación',
         now()
  from seguros s
  returning practica_id
)
update private.moodle_jefe_unmatched_diagnostics d
set resolution_status = 'auto_linked',
    resolved_practica_id = s.practica_id,
    resolved_at = now(),
    resolution_evidence = jsonb_build_object(
      'rule', 'jefe-task-mismatch/v1',
      'institution_score', round(s.score::numeric, 3)
    )
from seguros s
where d.id = s.diagnostic_id;

commit;
