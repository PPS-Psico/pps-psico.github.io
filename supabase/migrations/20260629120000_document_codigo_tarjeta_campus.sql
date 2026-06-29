-- ============================================================================
-- Documentación formal: lanzamientos_pps.codigo_tarjeta_campus
-- ----------------------------------------------------------------------------
-- Esta columna pasa a tener un uso explícito dentro del flujo
-- "Lanzador → Campus (aula virtual en Moodle)":
--
--   Guarda el LINK de la Tarea de Moodle (mod_assign, el "buzón de entrega")
--   que el coordinador crea a mano en el campus para esa PPS.
--
-- Quién lo escribe:
--   • Lanzador, formulario de Nueva convocatoria
--     (src/components/admin/launcher/NewLaunchForm.tsx → campo "Link de la Tarea").
--   • Lanzador, modal "Editar datos" de una PPS ya lanzada
--     (src/components/admin/launcher/launchTableConfig.ts → sección "Campus Virtual").
--   Ambos persisten el valor en esta columna vía db.lanzamientos.
--
-- Quién lo lee:
--   • La página estática del campus public/entregas.html (embebida en Moodle por
--     iframe). Lee en vivo, vía Supabase REST + anon key, las convocatorias que
--     tengan esta columna NO nula y estado != 'Oculto', y genera sola la tarjeta
--     de entrega en la orientación correspondiente, recortando el nombre de la PPS.
--   La lectura pública la habilita la policy RLS "Leer lanzamientos" (SELECT, true).
--
-- Formato esperado del valor:
--   • URL completa de la Tarea, p.ej.
--       https://campus.uflo.edu.ar/mod/assign/view.php?id=946366
--   • o, alternativamente, sólo el id numérico del mod_assign (el campus le
--     antepone el prefijo estándar).
--   • NULL / vacío = todavía no se creó la Tarea; no se genera tarjeta.
--
-- Nota histórica: antes esta columna se usaba de forma laxa para un "código" de
-- institución (p.ej. "GARRAHAN"). Ese uso queda deprecado para lanzamientos_pps;
-- el campo institucional equivalente vive en instituciones.codigo_tarjeta_campus.
--
-- Esta migración NO altera datos ni el esquema: sólo agrega el COMMENT que
-- documenta el contrato de la columna. Es idempotente.
-- ============================================================================

COMMENT ON COLUMN public.lanzamientos_pps.codigo_tarjeta_campus IS
  'Link de la Tarea de Moodle (mod_assign) de esta PPS. Lo carga el coordinador '
  'desde el Lanzador (alta o "Editar datos"). public/entregas.html lo lee vía '
  'Supabase REST (anon, policy "Leer lanzamientos") y genera la tarjeta de entrega '
  'en el campus, en la orientación de la PPS. Acepta URL completa '
  '(https://campus.uflo.edu.ar/mod/assign/view.php?id=NNN) o sólo el id numérico. '
  'NULL/vacío = sin Tarea, no se muestra tarjeta.';
