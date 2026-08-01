-- ============================================================================
-- Apagar el auto-archivado de lanzamientos_pps
-- ----------------------------------------------------------------------------
-- El Lanzador ya no usa `estado_gestion` para decidir visibilidad. Ahora una
-- convocatoria está "activa" entre `fecha_inicio` y `fecha_finalizacion`, y sale
-- de la vista operativa cuando esa última pasa. Esa regla se deriva en el
-- cliente (`deriveTimeline` / `deriveBucket`), sin escribir nada en la DB.
--
-- El cron `archive-lanzamientos-after-start-grace` escribía
-- `estado_gestion = 'Archivado'` 2 días después de la fecha de inicio, sin mirar
-- si la convocatoria tenía seguro gestionado o alumnos seleccionados. Efecto
-- medido sobre datos de producción (24/07/2026): archivó 8 convocatorias con el
-- pipeline avanzado, 4 de ellas con el seguro ya gestionado y hasta 9 alumnos
-- seleccionados — PPS que estaban corriendo y quedaron invisibles.
--
-- Además contaminaba `estado_gestion`, que es el eje de convenio/relanzamiento
-- de Gestión ('Relanzada', 'En Conversación', 'Esperando Respuesta', …): mezclar
-- ahí un interruptor de visibilidad hacía imposible distinguir lo que archivó el
-- admin de lo que archivó el cron.
--
-- Esta migración solo desprograma el job. NO borra la función ni toca datos:
--   * la función queda disponible por si hace falta ejecutarla a mano;
--   * revertir las 8 filas mal archivadas se hace por separado, caso por caso.
-- ============================================================================

do $$
begin
  perform cron.unschedule('archive-lanzamientos-after-start-grace');
exception
  when others then
    -- El job ya no existe (o pg_cron no está disponible): nada que hacer.
    null;
end;
$$;

comment on function public.archive_lanzamientos_after_start_grace()
is 'OBSOLETA (24/07/2026): el Lanzador deriva activa/finalizada de fecha_inicio y fecha_finalizacion, no de estado_gestion. Ya no está programada en cron porque archivaba PPS en curso. Se conserva solo para ejecución manual.';
