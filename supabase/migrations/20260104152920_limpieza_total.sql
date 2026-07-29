-- ==============================================================================
-- LIMPIEZA DE ARTEFACTOS DE IMPORTACIÓN (Array Strings a Texto Plano)
-- ==============================================================================

-- 1. Crear función auxiliar de limpieza
-- Esta función detecta si el texto está envuelto en ["..."] o {"..."} y lo limpia.
CREATE OR REPLACE FUNCTION clean_dirty_text(val text) RETURNS text AS $$
BEGIN
    IF val IS NULL OR val = 'null' THEN RETURN NULL; END IF;
    
    -- Caso 1: Formato JSON Array simple ["Texto"]
    IF val ~ '^\[".*"\]$' THEN
        RETURN substring(val from 3 for length(val) - 4);
    END IF;

    -- Caso 2: Formato Array Postgres Stringificado {"Texto"}
    IF val ~ '^\{".*"\}$' THEN
        RETURN substring(val from 3 for length(val) - 4);
    END IF;

    -- Caso 3: Comillas sueltas al inicio/fin
    RETURN BTRIM(val, '"');
END;
$$ LANGUAGE plpgsql;
-- 2. Ejecutar limpieza dinámica
-- Recorre todas las tablas y columnas, pero SOLO aplica la limpieza a columnas de TEXTO.
-- Esto evita el error "operator does not exist: uuid = text".
DO $$
DECLARE
    r RECORD;
    query text;
BEGIN
    FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          -- FILTRO CRÍTICO: Solo columnas de texto
          AND data_type IN ('text', 'character varying', 'character')
          -- Lista blanca de tablas para seguridad
          AND table_name IN (
            'estudiantes', 
            'practicas', 
            'convocatorias', 
            'lanzamientos_pps', 
            'instituciones', 
            'solicitudes_pps'
          )
    LOOP
        -- Ejecuta el update solo si el valor parece sucio (mejora performance)
        query := format(
            'UPDATE %I SET %I = clean_dirty_text(%I) WHERE %I LIKE ''["%%'']'' OR %I LIKE ''{"%%''}''',
            r.table_name, r.column_name, r.column_name, r.column_name, r.column_name
        );
        
        -- Ejecutar query (ignoramos errores puntuales para que continúe)
        BEGIN
            EXECUTE query;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo limpiar % in %: %', r.column_name, r.table_name, SQLERRM;
        END;
    END LOOP;
END $$;
