begin;

-- 29 lanzamientos quedaron con el texto de plantilla "poner link de informe" en
-- el campo `informe`. Ese campo es el link a la tarea de Campus donde el alumno
-- sube el informe, y es también el último recurso del link que ve la jefatura
-- en su cola. Mientras dice "poner link de informe", el alumno no tiene a dónde
-- ir y la jefatura no tiene qué abrir.
--
-- Caso que lo destapó: "Colegio Psicólogos CPAVZO" (lanzamiento
-- 8af7715f-b27c-4ef4-ae04-3f4d23dbeb8d). El vínculo confirmado a la tarea
-- 817710 existe desde hace meses en lanzamiento_moodle_tareas; sólo faltaba
-- escribirlo donde el panel lo lee.
--
-- 28 de los 29 tienen un vínculo confirmado a una tarea del curso 3615, así que
-- el link se puede derivar sin inventar nada: se prefiere el vínculo cuya
-- orientación coincide con la del lanzamiento y, entre los que quedan, el año
-- académico más nuevo. El que no tiene vínculo se deja como está: no hay dato
-- del que derivarlo. Alcance: 156 prácticas.

update public.lanzamientos_pps l
set informe = 'https://campus.uflo.edu.ar/mod/assign/view.php?id=' || v.moodle_id
from (
  select
    l2.id,
    (
      select ae.moodle_id
      from public.lanzamiento_moodle_tareas lm
      join public.aula_entregas ae on ae.id = lm.aula_entrega_id
      where lm.lanzamiento_id = l2.id
        and lm.validation_status = 'confirmed'
        and ae.course_id = 3615
        and ae.moodle_id ~ '^\d+$'
      order by
        (lm.orientacion_key = private.jefe_orientation_key(l2.orientacion)) desc,
        ae.academic_year desc nulls last,
        ae.id
      limit 1
    ) as moodle_id
  from public.lanzamientos_pps l2
  where trim(coalesce(l2.informe, '')) = 'poner link de informe'
) v
where v.id = l.id
  and v.moodle_id is not null
  and trim(coalesce(l.informe, '')) = 'poner link de informe';

commit;
