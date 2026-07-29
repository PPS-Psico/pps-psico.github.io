-- Drop vulnerable policies
DROP POLICY IF EXISTS "Permitir editar todo a usuarios autenticados" ON "public"."practicas";
DROP POLICY IF EXISTS "Permitir borrar practicas a usuarios autenticados" ON "public"."practicas";
DROP POLICY IF EXISTS "Ver practicas" ON "public"."practicas"; 

-- Create secure policies
CREATE POLICY "Usuarios pueden ver sus propias practicas"
ON "public"."practicas" FOR SELECT TO authenticated
USING (
  estudiante_id IN (SELECT id FROM estudiantes WHERE user_id = (select auth.uid()))
);

CREATE POLICY "Usuarios pueden editar sus propias practicas"
ON "public"."practicas" FOR UPDATE TO authenticated
USING (
  estudiante_id IN (SELECT id FROM estudiantes WHERE user_id = (select auth.uid()))
);

CREATE POLICY "Usuarios pueden borrar sus propias practicas"
ON "public"."practicas" FOR DELETE TO authenticated
USING (
  estudiante_id IN (SELECT id FROM estudiantes WHERE user_id = (select auth.uid()))
);
