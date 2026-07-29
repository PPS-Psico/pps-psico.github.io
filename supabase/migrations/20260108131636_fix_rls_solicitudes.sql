DROP POLICY IF EXISTS "Permitir editar todo a usuarios autenticados" ON "public"."solicitudes_pps";

CREATE POLICY "Usuarios pueden editar sus propias solicitudes"
ON "public"."solicitudes_pps"
FOR UPDATE
TO authenticated
USING (
  estudiante_id IN (
    SELECT id FROM estudiantes WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  estudiante_id IN (
    SELECT id FROM estudiantes WHERE user_id = auth.uid()
  )
);
