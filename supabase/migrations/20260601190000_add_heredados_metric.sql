-- ============================================================================
-- Métrica "estudiantes heredados": con cuántos alumnos se arrancó el ciclo
-- ============================================================================
-- Depende de la columna `cohorte` (20260601150000).
--
-- Heredados del año p_year = alumnos con cohorte ANTERIOR a p_year que NO habían
-- finalizado antes de p_year (siguen en curso al iniciar el ciclo). Es el
-- "saldo inicial" con el que el coordinador arranca el año.
--
-- LÍMITE DE CONFIABILIDAD: solo se cuentan cohortes >= 2024. Los datos previos
-- a 2024 (heredados de Airtable) no son usables, así que se excluyen.
--
-- Devuelve un entero (count). Lista asociada en get_heredados_list.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_heredados_count(int);
CREATE OR REPLACE FUNCTION public.get_heredados_count(p_year int)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH grad AS (
    SELECT id, safe_date_cast(fecha_finalizacion) AS gd
    FROM estudiantes
    WHERE fecha_finalizacion IS NOT NULL AND fecha_finalizacion <> ''
  )
  SELECT count(*)::int
  FROM estudiantes e
  LEFT JOIN grad g ON g.id = e.id
  WHERE e.cohorte IS NOT NULL
    AND e.cohorte >= 2024        -- solo datos confiables (Airtable previo no sirve)
    AND e.cohorte < p_year       -- ingresó en un ciclo anterior
    AND (g.gd IS NULL OR extract(year FROM g.gd) >= p_year);  -- no finalizó antes
$$;

DROP FUNCTION IF EXISTS public.get_heredados_list(int);
CREATE OR REPLACE FUNCTION public.get_heredados_list(p_year int)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH grad AS (
    SELECT id, safe_date_cast(fecha_finalizacion) AS gd
    FROM estudiantes
    WHERE fecha_finalizacion IS NOT NULL AND fecha_finalizacion <> ''
  )
  SELECT COALESCE(json_agg(json_build_object(
    'nombre', e.nombre, 'legajo', e.legajo
  ) ORDER BY e.cohorte, e.nombre), '[]'::json)
  FROM estudiantes e
  LEFT JOIN grad g ON g.id = e.id
  WHERE e.cohorte IS NOT NULL
    AND e.cohorte >= 2024
    AND e.cohorte < p_year
    AND (g.gd IS NULL OR extract(year FROM g.gd) >= p_year);
$$;
