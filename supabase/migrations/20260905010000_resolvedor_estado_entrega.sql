begin;

-- "¿Esta práctica tiene el informe entregado, y con qué nota?" se contesta hoy
-- en tres implementaciones distintas:
--
--   1. `selectCurrentMoodleSnapshots`, en TypeScript, para el panel.
--   2. `candidate_counts` dentro del sync de jefatura, en SQL.
--   3. `practicas.informe_estado` / `nota_moodle`, denormalizado.
--
-- Tres respuestas a una sola pregunta divergen. El 04/09 divergieron en la misma
-- fila: el panel mostraba "Sin entrega detectada" al lado de "Entregado" y de la
-- nota 7, porque el chip leía el snapshot de la tarea vinculada y el resto leía
-- la práctica.
--
-- La causa de fondo es el supuesto que venimos sacando de todos lados: que una
-- práctica tiene exactamente una tarea de Moodle. Desde que la atribución acepta
-- la entrega en cualquier tarea de la unidad, una práctica acumula un snapshot
-- por tarea y hay que ELEGIR cuál representa su estado. Mientras cada consumidor
-- elija por su cuenta, el próximo consumidor va a elegir distinto.
--
-- Esta vista hace esa elección una sola vez.
--
-- PRECEDENCIA
--
-- 1. La tarea vinculada manda mientras tenga algo que contar. Si ahí consta la
--    entrega, un snapshot terminal de una tarea anterior no debe pisarla después
--    de un remapeo.
-- 2. Si la vinculada no vio nada, gana la hermana con más evidencia. "Sin
--    entrega" no es evidencia de que el alumno no entregó: puede haber
--    entregado en otra tarea de la misma institución.
-- 3. A igual evidencia desempata la vinculada, y después la lectura más
--    reciente.
--
-- Es la misma regla que quedó en `selectCurrentMoodleSnapshots` tras el fix de
-- hoy; la diferencia es que acá vive una vez y la leen todos.
--
-- `security_invoker` a propósito: las policies de `practicas` y
-- `moodle_grade_snapshots` son simétricas (admin o alumno dueño), así que la
-- vista hereda la visibilidad vigente y no abre nada nuevo.
--
-- Incluye TODAS las prácticas, también las que no tienen ninguna lectura
-- (`estado = 'sin_lectura'`), para que ningún consumidor tenga que hacer el
-- left join ni inventar el caso vacío.

create or replace view public.practica_estado_entrega
with (security_invoker = on) as
with vinculo as (
  select
    p.id as practica_id,
    coalesce(directo.moodle_id, por_lanzamiento.moodle_id)::bigint as cmid_vinculado
  from public.practicas p
  left join lateral (
    select ae.moodle_id
    from public.practica_moodle_tareas pm
    join public.aula_entregas ae on ae.id = pm.aula_entrega_id
    where pm.practica_id = p.id
      and pm.validation_status = 'confirmed'
      and ae.moodle_id ~ '^\d+$'
    order by pm.created_at desc
    limit 1
  ) directo on true
  left join lateral (
    select ae.moodle_id
    from public.lanzamiento_moodle_tareas lm
    join public.aula_entregas ae on ae.id = lm.aula_entrega_id
    where lm.lanzamiento_id = p.lanzamiento_id
      and lm.validation_status = 'confirmed'
      and private.jefe_text_has_area(coalesce(p.especialidad, ''), lm.orientacion_key)
      and ae.moodle_id ~ '^\d+$'
    order by lm.created_at desc
    limit 1
  ) por_lanzamiento on true
)
select
  p.id                        as practica_id,
  p.estudiante_id,
  p.lanzamiento_id,
  p.nombre_institucion,
  p.especialidad,
  v.cmid_vinculado,
  elegido.cmid                as cmid_evidencia,
  tarea.moodle_name           as tarea_evidencia,
  case coalesce(elegido.evidencia, 0)
    when 3 then 'calificado'
    when 2 then 'entregado'
    when 1 then 'sin_entrega'
    else        'sin_lectura'
  end                         as estado,
  coalesce(elegido.submitted, false) as entregado,
  elegido.submitted_at,
  elegido.submitted_at_display,
  elegido.grade_value,
  elegido.grade_max,
  elegido.grade_display,
  elegido.observed_at,
  -- true cuando la entrega se leyó en una tarea distinta de la vinculada: es la
  -- señal de que el vínculo de la práctica apunta a otro lado que la realidad.
  (elegido.cmid is not null and elegido.cmid is distinct from v.cmid_vinculado)
                              as desde_tarea_hermana
from public.practicas p
left join vinculo v on v.practica_id = p.id
left join lateral (
  select
    s.cmid,
    s.submitted,
    s.submitted_at,
    s.submitted_at_display,
    s.grade_value,
    s.grade_max,
    s.grade_display,
    s.observed_at,
    case
      when s.task_status = 'graded' then 3
      when s.task_status = 'submitted' or s.submitted then 2
      when s.task_status = 'not_submitted' then 1
      else 0
    end as evidencia,
    coalesce(s.cmid = v.cmid_vinculado, false) as es_vinculada
  from public.moodle_grade_snapshots s
  where s.practica_id = p.id
  order by
    (coalesce(s.cmid = v.cmid_vinculado, false)
      and case
            when s.task_status = 'graded' then 3
            when s.task_status = 'submitted' or s.submitted then 2
            when s.task_status = 'not_submitted' then 1
            else 0
          end >= 2) desc,
    case
      when s.task_status = 'graded' then 3
      when s.task_status = 'submitted' or s.submitted then 2
      when s.task_status = 'not_submitted' then 1
      else 0
    end desc,
    coalesce(s.cmid = v.cmid_vinculado, false) desc,
    s.observed_at desc
  limit 1
) elegido on true
left join public.aula_entregas tarea on tarea.moodle_id = elegido.cmid::text;

comment on view public.practica_estado_entrega is
  'Estado de entrega resuelto por práctica: elige un único snapshot entre todas las tareas de su unidad. Fuente única para panel, cola de jefatura y reportes.';

grant select on public.practica_estado_entrega to anon, authenticated, service_role;

commit;
