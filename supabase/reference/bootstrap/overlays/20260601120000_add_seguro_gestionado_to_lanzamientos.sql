-- ============================================================================
-- Flujo de aseguramiento de PPS
-- Marca persistente de "seguro gestionado" a nivel lanzamiento.
--
-- El bucket "A asegurar" del Lanzador se deriva de seguro_gestionado_at:
--   NULL  = el seguro todavía no se gestionó (cae en "A asegurar")
--   fecha = el seguro ya se gestionó (pasa a "Activas")
--
-- NO se toca estado_convocatoria: la transición a "Activa" se deriva en el
-- cliente para no acoplar este flujo con el auto-archivado ni otras reglas.
-- ============================================================================

alter table public.lanzamientos_pps
  add column if not exists seguro_gestionado_at timestamptz,
  add column if not exists seguro_gestionado_por uuid;

comment on column public.lanzamientos_pps.seguro_gestionado_at is
  'Momento en que se cerró el flujo de aseguramiento (paso 4: descargar lista). NULL = pendiente de asegurar.';

comment on column public.lanzamientos_pps.seguro_gestionado_por is
  'auth.users.id del coordinador que ejecutó el cierre o la reversión del aseguramiento. Informativo.';
