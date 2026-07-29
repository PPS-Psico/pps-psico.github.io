-- Optimize Estudiantes Policies
DROP POLICY IF EXISTS "Ver perfil propio" ON "public"."estudiantes";
CREATE POLICY "Ver perfil propio" ON "public"."estudiantes"
AS PERMISSIVE FOR SELECT TO authenticated
USING ( user_id = (select auth.uid()) );

DROP POLICY IF EXISTS "Editar perfil propio" ON "public"."estudiantes";
CREATE POLICY "Editar perfil propio" ON "public"."estudiantes"
AS PERMISSIVE FOR UPDATE TO authenticated
USING ( user_id = (select auth.uid()) )
WITH CHECK ( user_id = (select auth.uid()) );

-- Optimize Solicitudes PPS Policies (Already fixed Update/Delete, ensuring Select is efficient)
DROP POLICY IF EXISTS "Ver solicitudes propias" ON "public"."solicitudes_pps";
CREATE POLICY "Ver solicitudes propias" ON "public"."solicitudes_pps"
AS PERMISSIVE FOR SELECT TO authenticated
USING ( 
  estudiante_id IN (SELECT id FROM estudiantes WHERE user_id = (select auth.uid()))
);

