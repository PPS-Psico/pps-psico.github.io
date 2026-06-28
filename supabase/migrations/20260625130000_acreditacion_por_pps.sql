-- Acreditación por PPS: flujo guiado de finalización (informe + asistencia + nota por práctica).
--
-- Migración ADITIVA y retrocompatible: sólo agrega columnas nuevas (nullable / con
-- default). El código viejo en producción no las referencia, así que aplicarla NO
-- rompe la app actual. El frontend nuevo se puede deployar después.
--
-- 1) practicas.es_online: marca de modalidad online para no exigir planilla de asistencia.
--    Hoy la modalidad online vive en lanzamientos_pps.direccion = 'Modalidad Virtual'
--    (checkbox del Lanzador). Persistimos un booleano en la práctica para poder
--    detectarlo de forma estable (incluye prácticas creadas desde solicitudes).
ALTER TABLE practicas
  ADD COLUMN IF NOT EXISTS es_online boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN practicas.es_online IS
  'TRUE si la PPS es online (no requiere planilla de asistencia). Derivado de lanzamientos_pps.direccion = ''Modalidad Virtual'' o de la solicitud que la originó.';

-- Backfill desde el lanzamiento vinculado (tolerante a espacios en direccion).
UPDATE practicas p
SET es_online = true
FROM lanzamientos_pps l
WHERE p.lanzamiento_id = l.id
  AND btrim(l.direccion) = 'Modalidad Virtual'
  AND p.es_online IS DISTINCT FROM true;

-- 2) finalizacion_pps.detalle_practicas: snapshot por PPS de la acreditación
--    (informe/asistencia/nota/horas/fechas por práctica + totales).
--    Las columnas legacy (planilla_horas_url, informe_final_url,
--    planilla_asistencia_url) se conservan para registros viejos y el ZIP.
ALTER TABLE finalizacion_pps
  ADD COLUMN IF NOT EXISTS detalle_practicas jsonb;

COMMENT ON COLUMN finalizacion_pps.detalle_practicas IS
  'Snapshot por-PPS del trámite nuevo: { totalHoras, notaPromedio, items[] }. NULL en registros viejos (que siguen usando las columnas *_url legacy).';

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual, sólo si hiciera falta revertir):
--   ALTER TABLE practicas DROP COLUMN IF EXISTS es_online;
--   ALTER TABLE finalizacion_pps DROP COLUMN IF EXISTS detalle_practicas;
-- ----------------------------------------------------------------------------
