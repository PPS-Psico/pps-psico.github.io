
CREATE OR REPLACE FUNCTION get_finalizados_list(p_year int)
RETURNS TABLE(id uuid, nombre text, legajo text)
LANGUAGE sql SECURITY DEFINER AS $$
SELECT DISTINCT ON (s) e.id, e.nombre, e.legajo
FROM (
  SELECT estudiante_id as s FROM finalizacion_pps 
  WHERE extract(year from COALESCE(safe_date_cast(fecha_solicitud), created_at)) = p_year
  UNION
  SELECT id as s FROM estudiantes 
  WHERE safe_date_cast(fecha_finalizacion) IS NOT NULL 
    AND extract(year from safe_date_cast(fecha_finalizacion)) = p_year
) x
JOIN estudiantes e ON e.id = x.s
ORDER BY s, e.nombre;
$$;

CREATE OR REPLACE FUNCTION get_haciendo_pps_list(p_year int)
RETURNS TABLE(id uuid, nombre text, legajo text)
LANGUAGE sql SECURITY DEFINER AS $$
WITH first_activities AS (
  SELECT estudiante_id, min(dt) as first_activity
  FROM (
    SELECT estudiante_id, created_at as dt FROM convocatorias WHERE estudiante_id IS NOT NULL
    UNION ALL
    SELECT estudiante_id, COALESCE(safe_date_cast(fecha_inicio), created_at) as dt FROM practicas WHERE estudiante_id IS NOT NULL
  ) sub GROUP BY estudiante_id
),
grad_dates AS (
  SELECT id, safe_date_cast(fecha_finalizacion) as gd FROM estudiantes
  WHERE lower(estado) = 'finalizado' AND fecha_finalizacion IS NOT NULL AND fecha_finalizacion != ''
),
active_year AS (
  SELECT DISTINCT fa.estudiante_id
  FROM first_activities fa
  LEFT JOIN grad_dates g ON g.id = fa.estudiante_id
  WHERE extract(year from fa.first_activity) <= p_year
    AND (g.gd IS NULL OR extract(year from g.gd) >= p_year)
    AND NOT EXISTS (SELECT 1 FROM estudiantes e WHERE e.id = fa.estudiante_id AND lower(e.estado) = 'finalizado')
)
SELECT DISTINCT e.id, e.nombre, e.legajo
FROM practicas p
JOIN estudiantes e ON e.id = p.estudiante_id
WHERE lower(p.estado) IN ('en curso','pendiente','en proceso')
  AND EXISTS (SELECT 1 FROM active_year a WHERE a.estudiante_id = p.estudiante_id)
ORDER BY e.nombre;
$$;

CREATE OR REPLACE FUNCTION get_proximos_finalizar_list(p_year int)
RETURNS TABLE(id uuid, nombre text, legajo text, horas_total numeric)
LANGUAGE sql SECURITY DEFINER AS $$
WITH first_activities AS (
  SELECT estudiante_id, min(dt) as first_activity
  FROM (
    SELECT estudiante_id, created_at as dt FROM convocatorias WHERE estudiante_id IS NOT NULL
    UNION ALL
    SELECT estudiante_id, COALESCE(safe_date_cast(fecha_inicio), created_at) as dt FROM practicas WHERE estudiante_id IS NOT NULL
  ) sub GROUP BY estudiante_id
),
grad_dates AS (
  SELECT id, safe_date_cast(fecha_finalizacion) as gd FROM estudiantes
  WHERE lower(estado) = 'finalizado' AND fecha_finalizacion IS NOT NULL AND fecha_finalizacion != ''
),
active_year AS (
  SELECT DISTINCT fa.estudiante_id
  FROM first_activities fa
  LEFT JOIN grad_dates g ON g.id = fa.estudiante_id
  WHERE extract(year from fa.first_activity) <= p_year
    AND (g.gd IS NULL OR extract(year from g.gd) >= p_year)
    AND NOT EXISTS (SELECT 1 FROM estudiantes e WHERE e.id = fa.estudiante_id AND lower(e.estado) = 'finalizado')
),
student_hours AS (
  SELECT estudiante_id, sum(COALESCE(horas_realizadas, 0)) as total
  FROM practicas GROUP BY estudiante_id
)
SELECT e.id, e.nombre, e.legajo, sh.total as horas_total
FROM student_hours sh
JOIN estudiantes e ON e.id = sh.estudiante_id
WHERE sh.total >= 230
  AND EXISTS (SELECT 1 FROM active_year a WHERE a.estudiante_id = sh.estudiante_id)
  AND NOT EXISTS (
    SELECT 1 FROM finalizacion_pps f 
    WHERE f.estudiante_id = sh.estudiante_id 
    AND lower(f.estado) IN ('tramite','realizada','cargado')
  )
ORDER BY sh.total DESC;
$$;
