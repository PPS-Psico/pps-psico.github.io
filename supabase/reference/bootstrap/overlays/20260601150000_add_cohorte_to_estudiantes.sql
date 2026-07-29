-- ============================================================================
-- Cohorte (año de ingreso real al sistema de PPS) para estudiantes
-- ============================================================================
-- PROBLEMA QUE RESUELVE
--   La métrica "ingresantes / matrícula generada" usaba estudiantes.created_at o
--   la primera convocatoria (created_at). Ambos están CONTAMINADOS por la
--   migración de Airtable: al migrar, todos los registros históricos entraron
--   con created_at de 2025, inflando ese año (218 "nuevos" 2025 vs 73 en 2026,
--   cuando la actividad real de los dos años es comparable).
--
-- CRITERIO PROFESIONAL (acordado)
--   cohorte = año de la PRIMERA ACTIVIDAD PPS REAL del estudiante, definida como
--   el mínimo entre:
--     · fecha_inicio de sus prácticas (del lanzamiento), y
--     · fecha_inicio del lanzamiento de sus convocatorias.
--   NUNCA created_at (aplastado por la migración).
--
-- REGLA PARA LOS "SIN PPS"
--   Un estudiante cargado a mano (solo nombre+legajo, sin cuenta y sin PPS) NO
--   tiene cohorte (queda NULL) y no cuenta para ninguna métrica de ingresantes.
--   Recién cuando se inscribe a su primera PPS se le asigna la cohorte = año de
--   esa primera actividad. Esto lo hace AUTOMÁTICO un trigger (abajo), así no
--   hay que recalcular ni cargar a mano nunca más.
--
-- Idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================================

-- 1. Columna -----------------------------------------------------------------
ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS cohorte smallint;

COMMENT ON COLUMN public.estudiantes.cohorte IS
  'Año de ingreso al sistema de PPS = año de la primera actividad PPS real '
  '(min fecha_inicio entre prácticas y lanzamientos de convocatorias). NULL si '
  'el estudiante todavia no hizo ninguna PPS. Se asigna automáticamente por '
  'trigger en la primera actividad; editable a mano para correcciones.';


-- 2. Función que calcula la cohorte de UN estudiante -------------------------
--    Devuelve el año (smallint) de su primera actividad PPS real, o NULL.
--    Descarta fechas con años fuera de rango (basura tipo 2202 de la migración).
CREATE OR REPLACE FUNCTION public.calc_cohorte_estudiante(p_estudiante_id uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fechas AS (
    -- convocatorias: fecha_inicio del lanzamiento ligado
    SELECT public.safe_date_cast(l.fecha_inicio) AS dt
    FROM convocatorias c
    JOIN lanzamientos_pps l ON l.id = c.lanzamiento_id
    WHERE c.estudiante_id = p_estudiante_id
    UNION ALL
    -- convocatorias: fecha_inicio propia (copia desnormalizada del lanzamiento)
    SELECT public.safe_date_cast(c.fecha_inicio) AS dt
    FROM convocatorias c
    WHERE c.estudiante_id = p_estudiante_id
    UNION ALL
    -- prácticas: fecha_inicio real
    SELECT public.safe_date_cast(p.fecha_inicio) AS dt
    FROM practicas p
    WHERE p.estudiante_id = p_estudiante_id
  )
  SELECT extract(year FROM min(dt))::smallint
  FROM fechas
  WHERE dt IS NOT NULL
    AND extract(year FROM dt) BETWEEN 2018 AND 2100;
$$;


-- 3. Backfill histórico ------------------------------------------------------
--    Asigna la cohorte a todos los estudiantes que YA tienen actividad PPS.
--    Los que no tienen actividad quedan en NULL (correcto: no son ingresantes
--    de ningún año todavía).
UPDATE public.estudiantes e
SET cohorte = public.calc_cohorte_estudiante(e.id)
WHERE public.calc_cohorte_estudiante(e.id) IS NOT NULL;


-- 4. Trigger de auto-asignación ----------------------------------------------
--    Cuando se inserta una convocatoria o práctica, si el estudiante todavía no
--    tiene cohorte (NULL), se la calcula y setea. Así los "sin PPS" entran solos
--    en el año de su primera inscripción, sin intervención manual.
CREATE OR REPLACE FUNCTION public.set_cohorte_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohorte smallint;
BEGIN
  IF NEW.estudiante_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Solo si el estudiante aún no tiene cohorte (no pisamos correcciones manuales).
  PERFORM 1 FROM public.estudiantes
    WHERE id = NEW.estudiante_id AND cohorte IS NOT NULL;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  v_cohorte := public.calc_cohorte_estudiante(NEW.estudiante_id);
  IF v_cohorte IS NOT NULL THEN
    UPDATE public.estudiantes SET cohorte = v_cohorte WHERE id = NEW.estudiante_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cohorte_conv ON public.convocatorias;
CREATE TRIGGER trg_set_cohorte_conv
  AFTER INSERT ON public.convocatorias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cohorte_on_activity();

DROP TRIGGER IF EXISTS trg_set_cohorte_prac ON public.practicas;
CREATE TRIGGER trg_set_cohorte_prac
  AFTER INSERT ON public.practicas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cohorte_on_activity();


-- 5. Índice para las métricas por cohorte ------------------------------------
CREATE INDEX IF NOT EXISTS idx_estudiantes_cohorte
  ON public.estudiantes(cohorte)
  WHERE cohorte IS NOT NULL;
