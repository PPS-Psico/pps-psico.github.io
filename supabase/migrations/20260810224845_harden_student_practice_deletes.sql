-- Una PPS es un antecedente académico y no puede borrarse desde una sesión
-- estudiantil. Las bajas operativas siguen pasando por los flujos atómicos de
-- coordinación; el administrador conserva su policy específica de DELETE.

drop policy if exists "Usuarios pueden borrar sus propias practicas"
  on public.practicas;
