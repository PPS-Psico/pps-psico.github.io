-- Cierra el acceso anónimo a `convocatorias`.
--
-- Problema: la política "Ver seleccionados publicos" estaba concedida al rol
-- `public` (incluye `anon`) con la condición
--   estado_inscripcion ILIKE '%Seleccionado%'
-- que también matchea 'No Seleccionado'. En la práctica no filtraba nada:
-- exponía las 1.717 filas con dni, correo, telefono, direccion,
-- fecha_nacimiento, cv_url y certificado_url.
--
-- Por qué es seguro quitarla:
--  - Los alumnos ven sus propias inscripciones por "Ver inscripciones propias".
--  - Coordinación las ve por "Admin select convocatorias".
--  - La lista de seleccionados que ve el alumno se sirve por la RPC
--    `get_seleccionados_for_launch` (SECURITY DEFINER, concedida sólo a
--    `authenticated`), que devuelve nombre/legajo/horario/firmó y ninguna PII.
--    Verificado: has_function_privilege('anon', ...) = false.

drop policy if exists "Ver seleccionados publicos" on public.convocatorias;
