-- ============================================================================
-- Permitir 'Confirmacion' en lanzamientos_pps.estado_convocatoria
-- ----------------------------------------------------------------------------
-- El pipeline del Lanzador pasa de 5 a 5 pasos visibles (Borrador →
-- Selección → Seguro → Confirmación → Activa) pero ahora la sala de
-- consentimientos es un paso explícito en la DB (no se deriva solo de la
-- marca `seguro_gestionado_at`). El admin transiciona a 'Activa' mediante
-- un click explícito en `ConfirmacionView` — antes la marca de seguro
-- clasificaba como 'Activa' directamente, saltándose la sala de
-- consentimientos.
--
-- Esta migración solo agrega el valor al CHECK constraint. La transición
-- `marcarAseguramiento` (en aseguramientoService.ts) pasa a setear AMBOS:
-- `seguro_gestionado_at = NOW()` y `estado_convocatoria = 'Confirmacion'`.
-- ============================================================================

ALTER TABLE public.lanzamientos_pps
  DROP CONSTRAINT IF EXISTS lanzamientos_estado_convocatoria_check;

ALTER TABLE public.lanzamientos_pps
  ADD CONSTRAINT lanzamientos_estado_convocatoria_check
  CHECK (estado_convocatoria = ANY (ARRAY[
    'Oculto'::text,
    'Abierta'::text,
    'Cerrado'::text,
    'Confirmacion'::text,
    'Activa'::text,
    'Archivado'::text
  ]));
