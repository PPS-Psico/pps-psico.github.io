-- Repara la unica referencia institucional invalida de lanzamientos_pps.
--
-- El formulario del lanzador guardaba el string "recInstMock_nuevo" cuando no se
-- elegia institucion. Quedo asi el lanzamiento del Ministerio de Trabajo
-- (2026-04-22 -> 2026-08-01, 70 h acreditadas, 27 practicas colgando) apuntando a
-- una institucion que no existe: invisible para cualquier cruce por institucion_id,
-- que es como se resuelve la referencia de horas de una solicitud.
--
-- El origen ya se cerro en codigo (commit "fix(lanzador): exige institucion real
-- al crear una PPS"). Esto limpia la fila que quedo.
--
-- Guardado por el valor viejo: si ya fue reparado, es un no-op.
--
-- NOTA: la FK hacia instituciones todavia no se puede agregar. La columna es
-- `text` y `instituciones.id` es `uuid`; convertirla rompe en runtime seis
-- funciones que hoy dependen de que sea texto (comparan con `~*` o joinean con
-- `i.id::text = l.institucion_id`), entre ellas la inscripcion de alumnos. La
-- conversion tiene que viajar junto con la reescritura de esas funciones.

UPDATE lanzamientos_pps
SET institucion_id = 'c197d5bd-97dd-47d5-ab9c-c80e4f5088b3'
WHERE id = '2a2649e8-5585-42b4-8175-24216c2a459c'
  AND institucion_id = 'recInstMock_nuevo';
