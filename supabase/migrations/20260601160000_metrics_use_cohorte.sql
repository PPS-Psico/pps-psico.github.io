-- ============================================================================
-- Métricas de "ingresantes" basadas en cohorte (no en created_at)
-- ============================================================================
-- Depende de 20260601150000_add_cohorte_to_estudiantes.sql (columna cohorte +
-- backfill + trigger).
--
-- Cambia la definición de:
--   · matricula_generada  → estudiantes con cohorte = p_year
--   · enrollment_evolution→ conteo de estudiantes por cohorte (serie por año)
--   · trends.matricula_generada → variación cohorte p_year vs p_year-1
-- El resto del RPC queda igual.
--
-- También (re)crea get_ingresantes_list(p_year) para que el drill-down liste
-- exactamente esos estudiantes (no estaba versionada en el repo).
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_admin_metrics_kpis(int);
CREATE OR REPLACE FUNCTION public.get_admin_metrics_kpis(p_year int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH 
  first_activities AS (
    SELECT estudiante_id, min(dt) as first_activity
    FROM (
      SELECT estudiante_id, created_at as dt 
      FROM convocatorias WHERE estudiante_id IS NOT NULL
      UNION ALL
      SELECT estudiante_id, COALESCE(safe_date_cast(fecha_inicio), created_at) as dt 
      FROM practicas WHERE estudiante_id IS NOT NULL
    ) sub
    GROUP BY estudiante_id
  ),
  grad_dates AS (
    SELECT id, safe_date_cast(fecha_finalizacion) as gd
    FROM estudiantes
    WHERE lower(estado) = 'finalizado' 
      AND fecha_finalizacion IS NOT NULL 
      AND fecha_finalizacion != ''
  ),
  active_year AS (
    SELECT DISTINCT fa.estudiante_id
    FROM first_activities fa
    LEFT JOIN grad_dates g ON g.id = fa.estudiante_id
    WHERE extract(year from fa.first_activity) <= p_year
      AND (g.gd IS NULL OR extract(year from g.gd) >= p_year)
      AND NOT EXISTS (
        SELECT 1 FROM estudiantes e 
        WHERE e.id = fa.estudiante_id AND lower(e.estado) = 'finalizado'
      )
  ),
  active_prev AS (
    SELECT DISTINCT fa.estudiante_id
    FROM first_activities fa
    LEFT JOIN grad_dates g ON g.id = fa.estudiante_id
    WHERE extract(year from fa.first_activity) <= p_year - 1
      AND (g.gd IS NULL OR extract(year from g.gd) >= p_year - 1)
      AND NOT EXISTS (
        SELECT 1 FROM estudiantes e 
        WHERE e.id = fa.estudiante_id AND lower(e.estado) = 'finalizado'
      )
  ),
  student_hours AS (
    SELECT estudiante_id, sum(COALESCE(horas_realizadas, 0)) as total
    FROM practicas GROUP BY estudiante_id
  ),
  year_launches AS (
    SELECT * FROM lanzamientos_pps
    WHERE extract(year from COALESCE(safe_date_cast(fecha_inicio), created_at)) = p_year
  ),
  -- ── COHORTE: ingresantes reales por año ──────────────────────────────────
  -- matricula_generada = estudiantes cuya cohorte (1ª PPS real) cae en el año.
  c_mg AS (
    SELECT count(*) as v FROM estudiantes WHERE cohorte = p_year
  ),
  p_mg AS (
    SELECT count(*) as v FROM estudiantes WHERE cohorte = p_year - 1
  ),
  c_fin AS (
    SELECT count(DISTINCT s) as v FROM (
      SELECT estudiante_id as s FROM finalizacion_pps 
      WHERE extract(year from COALESCE(safe_date_cast(fecha_solicitud), created_at)) = p_year
      UNION
      SELECT id as s FROM estudiantes 
      WHERE safe_date_cast(fecha_finalizacion) IS NOT NULL 
        AND extract(year from safe_date_cast(fecha_finalizacion)) = p_year
    ) x
  ),
  p_fin AS (
    SELECT count(DISTINCT s) as v FROM (
      SELECT estudiante_id as s FROM finalizacion_pps 
      WHERE extract(year from COALESCE(safe_date_cast(fecha_solicitud), created_at)) = p_year - 1
      UNION
      SELECT id as s FROM estudiantes 
      WHERE safe_date_cast(fecha_finalizacion) IS NOT NULL 
        AND extract(year from safe_date_cast(fecha_finalizacion)) = p_year - 1
    ) x
  ),
  c_act AS (
    SELECT count(*) as v FROM active_year
  ),
  p_act AS (
    SELECT count(*) as v FROM active_prev
  )
  SELECT json_build_object(
    'matricula_generada', (SELECT v FROM c_mg),
    'alumnos_finalizados', (SELECT v FROM c_fin),
    'matricula_activa', (SELECT v FROM c_act),
    'sin_pps', (
      SELECT count(*) FROM estudiantes e
      WHERE lower(e.estado) != 'finalizado'
        AND e.correo IS NOT NULL AND e.correo != ''
        AND EXISTS (
          SELECT 1 FROM convocatorias c 
          WHERE c.estudiante_id = e.id 
          AND extract(year from c.created_at) <= p_year
        )
        AND NOT EXISTS (
          SELECT 1 FROM practicas p 
          WHERE p.estudiante_id = e.id 
          AND extract(year from p.created_at) <= p_year
        )
    ),
    'proximos_finalizar', (
      SELECT count(*) FROM student_hours sh
      WHERE sh.total >= 230
        AND EXISTS (SELECT 1 FROM active_year a WHERE a.estudiante_id = sh.estudiante_id)
        AND NOT EXISTS (
          SELECT 1 FROM finalizacion_pps f 
          WHERE f.estudiante_id = sh.estudiante_id 
            AND lower(f.estado) IN ('tramite','realizada','cargado')
        )
    ),
    'haciendo_pps', (
      SELECT count(DISTINCT p.estudiante_id) FROM practicas p
      WHERE lower(p.estado) = 'en curso'
        AND EXISTS (SELECT 1 FROM active_year a WHERE a.estudiante_id = p.estudiante_id)
    ),
    'pps_lanzadas', (SELECT count(*) FROM year_launches),
    'instituciones_activas', (
      SELECT count(DISTINCT split_part(nombre_pps, ' - ', 1)) 
      FROM year_launches WHERE nombre_pps IS NOT NULL
    ),
    'cupos_ofrecidos', (SELECT COALESCE(sum(cupos_disponibles), 0)::int FROM year_launches),
    'nuevos_convenios', (
      SELECT count(DISTINCT split_part(nombre, ' - ', 1))
      FROM instituciones WHERE convenio_nuevo = p_year
    ),
    'orientation_distribution', (
      SELECT COALESCE(json_object_agg(orientation, cnt), '{}')
      FROM (
        SELECT 
          CASE 
            WHEN l.orientacion ~* 'cl[ií]nica' THEN 'Clínica'
            WHEN l.orientacion ~* 'educacional|educaci[oó]n' THEN 'Educacional'
            WHEN l.orientacion ~* 'laboral|trabajo' THEN 'Laboral'
            WHEN l.orientacion ~* 'comunitaria|comunidad' THEN 'Comunitaria'
            ELSE 'Sin definir'
          END as orientation,
          count(*) as cnt
        FROM convocatorias c
        JOIN lanzamientos_pps l ON l.id = c.lanzamiento_id
        WHERE extract(year from c.created_at) = p_year
          AND lower(c.estado_inscripcion) IN ('seleccionado','inscripto')
        GROUP BY 1
      ) sub
    ),
    -- Evolución de ingresantes por año = conteo por cohorte (estable, no created_at).
    'enrollment_evolution', (
      SELECT COALESCE(
        json_agg(json_build_object('year', yr::text, 'value', cnt) ORDER BY yr), 
        '[]'::json
      )
      FROM (
        SELECT cohorte::int as yr, count(*) as cnt
        FROM estudiantes WHERE cohorte IS NOT NULL
        GROUP BY cohorte
      ) sub
    ),
    'trend_data', (
      SELECT COALESCE(
        json_agg(json_build_object('year', yr::text, 'value', cnt) ORDER BY yr), 
        '[]'::json
      )
      FROM (
        SELECT y.yr, count(DISTINCT fa.estudiante_id) as cnt
        FROM generate_series(2022, GREATEST(p_year, 2022)) AS y(yr)
        JOIN first_activities fa ON extract(year from fa.first_activity) <= y.yr
        LEFT JOIN grad_dates g ON g.id = fa.estudiante_id
        WHERE g.gd IS NULL OR extract(year from g.gd) > y.yr
        GROUP BY y.yr
      ) sub
    ),
    'trends', json_build_object(
      'matricula_generada', CASE WHEN (SELECT v FROM p_mg) > 0 
        THEN round(((SELECT v FROM c_mg) - (SELECT v FROM p_mg))::numeric / (SELECT v FROM p_mg) * 100)::int 
        ELSE 0 END,
      'acreditados', CASE WHEN (SELECT v FROM p_fin) > 0 
        THEN round(((SELECT v FROM c_fin) - (SELECT v FROM p_fin))::numeric / (SELECT v FROM p_fin) * 100)::int 
        ELSE 0 END,
      'activos', CASE WHEN (SELECT v FROM p_act) > 0 
        THEN round(((SELECT v FROM c_act) - (SELECT v FROM p_act))::numeric / (SELECT v FROM p_act) * 100)::int 
        ELSE 0 END
    ),
    'target_year', p_year
  ) INTO result;
  
  RETURN result;
END;
$$;


-- get_ingresantes_list: estudiantes cuya cohorte (1ª PPS real) cae en el año.
DROP FUNCTION IF EXISTS public.get_ingresantes_list(int);
CREATE OR REPLACE FUNCTION public.get_ingresantes_list(p_year int)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'nombre', nombre,
    'legajo', legajo
  ) ORDER BY nombre), '[]'::json)
  FROM estudiantes
  WHERE cohorte = p_year;
$$;
