DROP POLICY IF EXISTS "Crear solicitudes propias" ON "public"."solicitudes_pps";

CREATE POLICY "Crear solicitudes propias" ON "public"."solicitudes_pps" FOR INSERT TO authenticated
WITH CHECK (
  estudiante_id IN (SELECT id FROM estudiantes WHERE user_id = (select auth.uid()))
);
