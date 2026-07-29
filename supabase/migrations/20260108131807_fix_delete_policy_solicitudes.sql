DROP POLICY IF EXISTS "Permitir borrar solicitudes a usuarios autenticados" ON "public"."solicitudes_pps";

CREATE POLICY "Usuarios pueden borrar sus propias solicitudes"
ON "public"."solicitudes_pps"
FOR DELETE
TO authenticated
USING (
  estudiante_id IN (
    SELECT id FROM estudiantes WHERE user_id = auth.uid()
  )
);
