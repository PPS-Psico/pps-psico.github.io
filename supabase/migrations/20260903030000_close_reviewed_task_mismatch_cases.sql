begin;

-- Cierre de los dos casos de `task_mismatch` que quedaron para revisión humana.
-- Ninguno es un informe perdido; se dejan resueltos con la evidencia para que
-- no vuelvan a pedir atención en cada barrido.
--
-- Leuze Alejandra (legajo 31231), tarea 630832 "A.Pa.Si.Do" de 2024: su práctica
-- en APASIDO es la de 2025, ya calificada con 10 y vinculada a la tarea 877154
-- "Apasido - 4". Aparece en la tarea vieja porque sigue inscripta, no porque
-- haya entregado algo sin corregir.
--
-- Laila Aedo (legajo 20740), tarea 1086464 "Centro SENSUS" de 2026: su práctica
-- de SENSUS es de 2025 y apunta a la tarea 927369, donde Moodle informa
-- `submitted = false` -- no entregó. Vincularla a una tarea de 2026 sería
-- inventar una entrega que no existe.
--
-- Queda anotado aparte un problema de datos real que apareció mirando este
-- caso: esa práctica de SENSUS está cargada TRES veces (mismo lanzamiento,
-- mismas fechas, 80 hs, creadas 11:39, 11:40 y 11:41 del 2025-09-16 con tres
-- airtable_id distintos). Infla la cola con dos filas fantasma. No se toca acá:
-- borrar registros académicos es decisión de coordinación.

update private.moodle_jefe_unmatched_diagnostics d
set resolution_status = 'ignored_no_area_practice',
    resolved_at = now(),
    resolution_evidence = jsonb_build_object(
      'rule', 'jefe-task-mismatch-review/v1',
      'motivo', case
        when d.cmid = 630832 then 'practica_del_area_ya_calificada_en_otra_tarea'
        else 'sin_entrega_en_la_tarea_vinculada'
      end
    )
from public.estudiantes e
where e.id = d.estudiante_id
  and d.reason = 'task_mismatch'
  and d.resolution_status in ('pending', 'needs_review')
  and (
    (e.legajo = '31231' and d.cmid = 630832)
    or (e.legajo = '20740' and d.cmid = 1086464)
  );

commit;
