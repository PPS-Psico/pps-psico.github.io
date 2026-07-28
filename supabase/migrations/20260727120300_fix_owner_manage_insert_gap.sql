-- Cierra un hueco detectado al probar la migración anterior.
--
-- Las políticas "Owner Manage Finalizacion" y "Owner Manage Estudiantes" estaban
-- declaradas FOR ALL con sólo USING (bucket_id = ... AND auth.uid() = owner).
-- En un INSERT, Postgres usa la expresión de USING como WITH CHECK cuando no hay
-- WITH CHECK explícito. Como la única condición es "sos el owner", cualquier
-- alumno autenticado podía CREAR archivos dentro de la carpeta de otro alumno
-- simplemente poniéndose a sí mismo como owner (comprobado: el insert pasaba).
--
-- Se separan por comando: el acceso por owner queda para leer/actualizar/borrar
-- lo propio (incluye archivos legacy sin carpeta reconocible), pero la CREACIÓN
-- pasa exclusivamente por las políticas scopeadas por carpeta.

drop policy if exists "Owner Manage Finalizacion" on storage.objects;
drop policy if exists "Owner Manage Estudiantes" on storage.objects;

drop policy if exists "Owner lee sus objetos" on storage.objects;
create policy "Owner lee sus objetos"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('documentos_finalizacion', 'documentos_estudiantes')
  and (select auth.uid()) = owner
);

drop policy if exists "Owner actualiza sus objetos" on storage.objects;
create policy "Owner actualiza sus objetos"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('documentos_finalizacion', 'documentos_estudiantes')
  and (select auth.uid()) = owner
)
with check (
  bucket_id in ('documentos_finalizacion', 'documentos_estudiantes')
  and (select auth.uid()) = owner
);

drop policy if exists "Owner borra sus objetos" on storage.objects;
create policy "Owner borra sus objetos"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('documentos_finalizacion', 'documentos_estudiantes')
  and (select auth.uid()) = owner
);
