-- Cuarto estado para solicitudes_nueva_pps y solicitudes_modificacion_pps.
--
-- 'archivada' saca una solicitud de la cola sin decidirla: no crea ni pisa
-- filas en `practicas`, no notifica al alumno, y es reversible (se puede volver
-- a 'pendiente'). Es para las solicitudes que ya no aplican — típicamente
-- carga retroactiva de PPS de un alumno que ya está acreditado, o duplicados
-- de algo ya cargado — donde ni "aprobar" ni "rechazar" es la acción correcta.
--
-- Nunca aplica a bajas (tipo_modificacion = 'eliminacion'): esas siguen su RPC
-- de penalización, y el constraint solicitudes_modificacion_pps_resolucion_check
-- ya rechaza cualquier estado que no sea pendiente/aprobada/rechazada para ellas.

ALTER TABLE public.solicitudes_nueva_pps
  DROP CONSTRAINT IF EXISTS solicitudes_nueva_pps_estado_check;
ALTER TABLE public.solicitudes_nueva_pps
  ADD CONSTRAINT solicitudes_nueva_pps_estado_check
  CHECK (estado::text = ANY (ARRAY['pendiente','aprobada','rechazada','archivada']::text[]));

ALTER TABLE public.solicitudes_modificacion_pps
  DROP CONSTRAINT IF EXISTS solicitudes_modificacion_pps_estado_check;
ALTER TABLE public.solicitudes_modificacion_pps
  ADD CONSTRAINT solicitudes_modificacion_pps_estado_check
  CHECK (estado::text = ANY (ARRAY['pendiente','aprobada','rechazada','archivada']::text[]));
