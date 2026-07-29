-- ============================================================================
-- CHECK constraint en lanzamientos_pps.estado_gestion
-- ----------------------------------------------------------------------------
-- Último campo de estado sin blindar. A diferencia de los otros, este es más
-- laxo: NULL es válido (lanzamiento sin gestión iniciada) y conviven valores
-- canónicos (los que escribe STATE_TO_DB en GestionView) con dos legacy que el
-- código todavía interpreta al leer (dbToUiState).
--
-- Los datos ya están limpios (auditados: sin casing roto ni espacios), así que
-- NO se normaliza nada — sólo se agrega el constraint para impedir valores
-- nuevos inválidos a futuro.
--
--   Canónicos (escritura): Pendiente de Gestión · Esperando Respuesta ·
--                          En Conversación · Relanzamiento Confirmado · Archivado
--   Legacy (sólo lectura):  Relanzada · No se Relanza
--   NULL = sin gestión iniciada
-- ============================================================================

begin;

alter table lanzamientos_pps
  drop constraint if exists lanzamientos_estado_gestion_check;
alter table lanzamientos_pps
  add  constraint lanzamientos_estado_gestion_check
  check (
    estado_gestion is null
    or estado_gestion in (
      'Pendiente de Gestión',
      'Esperando Respuesta',
      'En Conversación',
      'Relanzamiento Confirmado',
      'Archivado',
      -- legacy aún interpretados por el código (no se generan nuevos):
      'Relanzada',
      'No se Relanza'
    )
  );

commit;
