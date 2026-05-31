-- ============================================================================
-- Normalización de estados + CHECK constraints
-- ----------------------------------------------------------------------------
-- Objetivo: eliminar la clase de bugs causada por estados en texto libre
-- (casing/typos). Primero se normalizan los datos existentes, luego se aplican
-- CHECK constraints que sólo permiten valores canónicos a futuro.
--
-- Hallazgos de la auditoría (datos reales):
--   convocatorias.estado_inscripcion: 1×'no_seleccionado', 2×NULL
--   practicas.estado:                 33×'En Curso' (debe ser 'En curso'), 2×NULL
--   estudiantes.estado:               1×'' (Paula Gerez, sin actividad)
--   instituciones.convenio_nuevo:     'false'/'2025'/'2024'/NULL mezclados (texto)
--
-- Idempotente: usa DROP CONSTRAINT IF EXISTS antes de crear, y los UPDATE
-- son seguros de re-ejecutar.
--
-- NOTA: instituciones.convenio_nuevo NO se toca acá. Hoy es text y mezcla
-- 'false'/'2024'/'2025'/'Legacy'/NULL, y hay código (EditorInstituciones,
-- metricsLists, metricsCalculations) que depende de esos strings. Migrar su
-- tipo requiere coordinar SQL + código en el mismo paso → queda para una
-- migración aparte.
-- ============================================================================

begin;

-- ── 1. convocatorias.estado_inscripcion ─────────────────────────────────────
-- Canónicos: Inscripto · Seleccionado · No Seleccionado
-- NOTA: convocatorias tiene un trigger AFTER UPDATE (handle_seleccion_alumno)
-- que crea/borra prácticas al pasar a/desde 'Seleccionado'. Nuestros cambios
-- sólo tocan 'no_seleccionado'/NULL → 'No Seleccionado' (nunca 'Seleccionado'),
-- así que el trigger no generaría prácticas; aun así lo deshabilitamos durante
-- la migración por prudencia y lo reactivamos al final.
alter table convocatorias disable trigger trigger_gestion_automatica_practicas;

update convocatorias
   set estado_inscripcion = 'No Seleccionado'
 where estado_inscripcion is null
    or lower(replace(estado_inscripcion, '_', ' ')) = 'no seleccionado';

update convocatorias
   set estado_inscripcion = 'Seleccionado'
 where lower(estado_inscripcion) = 'seleccionado'
   and estado_inscripcion <> 'Seleccionado';

update convocatorias
   set estado_inscripcion = 'Inscripto'
 where lower(estado_inscripcion) = 'inscripto'
   and estado_inscripcion <> 'Inscripto';

alter table convocatorias enable trigger trigger_gestion_automatica_practicas;

alter table convocatorias
  alter column estado_inscripcion set default 'Inscripto';

alter table convocatorias
  drop constraint if exists convocatorias_estado_inscripcion_check;
alter table convocatorias
  add  constraint convocatorias_estado_inscripcion_check
  check (estado_inscripcion in ('Inscripto', 'Seleccionado', 'No Seleccionado'));

-- ── 2. practicas.estado ─────────────────────────────────────────────────────
-- Canónicos: En curso · Finalizada · Convenio Realizado · No se pudo concretar
--
-- IMPORTANTE: la tabla practicas tiene un trigger (check_practica_updates) que
-- revierte cambios de 'estado' salvo que is_admin() sea true. En una migración
-- por conexión directa NO hay sesión de usuario, así que is_admin() es false y
-- el trigger bloquearía el UPDATE. Lo deshabilitamos SOLO durante la migración
-- y lo reactivamos al final (sigue protegiendo a los estudiantes en runtime).
alter table practicas disable trigger trg_check_practica_updates;

update practicas set estado = 'En curso'
 where lower(estado) = 'en curso' and estado <> 'En curso';
update practicas set estado = 'Finalizada'
 where lower(estado) = 'finalizada' and estado <> 'Finalizada';
update practicas set estado = 'Convenio Realizado'
 where lower(estado) = 'convenio realizado' and estado <> 'Convenio Realizado';
update practicas set estado = 'No se pudo concretar'
 where lower(estado) = 'no se pudo concretar' and estado <> 'No se pudo concretar';
-- Las prácticas sin estado (NULL) se asumen en curso (no estaban cerradas)
update practicas set estado = 'En curso' where estado is null;

alter table practicas enable trigger trg_check_practica_updates;

alter table practicas
  drop constraint if exists practicas_estado_check;
alter table practicas
  add  constraint practicas_estado_check
  check (estado in ('En curso', 'Finalizada', 'Convenio Realizado', 'No se pudo concretar'));

-- ── 3. estudiantes.estado ───────────────────────────────────────────────────
-- Canónicos: Activo · Finalizado · Inactivo · Nuevo (Sin cuenta)
-- El registro con '' (sin prácticas ni convocatorias) → Inactivo (default).
update estudiantes set estado = 'Inactivo'
 where estado is null or btrim(estado) = '';

alter table estudiantes
  alter column estado set default 'Inactivo';

alter table estudiantes
  drop constraint if exists estudiantes_estado_check;
alter table estudiantes
  add  constraint estudiantes_estado_check
  check (estado in ('Activo', 'Finalizado', 'Inactivo', 'Nuevo (Sin cuenta)'));

-- ── 4. lanzamientos_pps.estado_convocatoria ─────────────────────────────────
-- Canónicos (mapeados en el código): Oculto · Abierta · Cerrado · Activa · Archivado
update lanzamientos_pps set estado_convocatoria = 'Oculto'
 where estado_convocatoria is null or btrim(estado_convocatoria) = '';

alter table lanzamientos_pps
  drop constraint if exists lanzamientos_estado_convocatoria_check;
alter table lanzamientos_pps
  add  constraint lanzamientos_estado_convocatoria_check
  check (estado_convocatoria in ('Oculto', 'Abierta', 'Cerrado', 'Activa', 'Archivado'));

commit;
