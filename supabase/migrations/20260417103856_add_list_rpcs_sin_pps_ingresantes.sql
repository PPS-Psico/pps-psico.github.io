
CREATE OR REPLACE FUNCTION get_sin_pps_list(p_year int)
RETURNS TABLE(id uuid, nombre text, legajo text, correo text)
LANGUAGE sql SECURITY DEFINER AS $$
SELECT e.id, e.nombre, e.legajo, e.correo
FROM estudiantes e
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
ORDER BY e.nombre;
$$;

CREATE OR REPLACE FUNCTION get_ingresantes_list(p_year int)
RETURNS TABLE(id uuid, nombre text, legajo text)
LANGUAGE sql SECURITY DEFINER AS $$
SELECT e.id, e.nombre, e.legajo
FROM estudiantes e
WHERE EXISTS (
    SELECT 1 FROM convocatorias c
    WHERE c.estudiante_id = e.id
    GROUP BY c.estudiante_id
    HAVING extract(year from min(c.created_at)) = p_year
  )
ORDER BY e.nombre;
$$;
