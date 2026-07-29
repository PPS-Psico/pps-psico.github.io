-- Modificar políticas para solicitudes_nueva_pps
DROP POLICY IF EXISTS "Admins can view all new pps requests" ON solicitudes_nueva_pps;
CREATE POLICY "Admins can view all new pps requests" ON solicitudes_nueva_pps
FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all new pps requests" ON solicitudes_nueva_pps;
CREATE POLICY "Admins can update all new pps requests" ON solicitudes_nueva_pps
FOR UPDATE USING (is_admin());

-- Modificar políticas para solicitudes_modificacion_pps
DROP POLICY IF EXISTS "Admins can view all modification requests" ON solicitudes_modificacion_pps;
CREATE POLICY "Admins can view all modification requests" ON solicitudes_modificacion_pps
FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all modification requests" ON solicitudes_modificacion_pps;
CREATE POLICY "Admins can update all modification requests" ON solicitudes_modificacion_pps
FOR UPDATE USING (is_admin());
