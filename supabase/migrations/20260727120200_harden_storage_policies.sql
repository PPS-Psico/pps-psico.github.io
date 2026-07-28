-- Cierra el acceso anónimo a los documentos de alumnos.
--
-- Problema verificado: `documentos_finalizacion` figura como bucket privado
-- (public = false), pero sus políticas apuntaban al rol `public`, que incluye
-- `anon`. El flag del bucket sólo desactiva la ruta /object/public/; el acceso
-- real lo gobierna la RLS de storage.objects. Con la anon key se podía listar
-- el bucket y descargar archivos (comprobado: PDF de asistencia, HTTP 200).
-- Peor aún, había INSERT y UPDATE anónimos: cualquiera podía SOBRESCRIBIR la
-- planilla de asistencia de un alumno.
--
-- Qué se preserva (verificado contra el código, no asumido):
--  - El alumno sube informes y planillas. Los tres uploaders escriben en
--    `<estudiante_id>/...`:
--      finalizacionService.uploadFinalizationFile  → documentos_finalizacion
--      solicitudesService.uploadSolicitudFile      → documentos_estudiantes
--      EnrollmentForm.uploadFile                   → documentos_estudiantes
--  - Los tres usan upsert:true. Un upsert sobre un archivo existente es UPDATE,
--    no INSERT: por eso se agregan políticas de UPDATE scopeadas por carpeta.
--    Sin esto, re-subir un informe fallaría.
--  - Coordinación conserva acceso total ("Admins gestionan todo storage").
--  - La revisión de informes ya usa createSignedUrl desde el panel admin
--    (FinalizacionReview.tsx, EgresoTab.tsx), que sigue funcionando.

-- Carpeta propia del alumno autenticado. SECURITY DEFINER para no depender de
-- la RLS de `estudiantes` al evaluar políticas de storage.
create or replace function public.owns_storage_folder(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(object_name))[1] in (
    select e.id::text
    from public.estudiantes e
    where e.user_id = (select auth.uid())
  );
$$;

comment on function public.owns_storage_folder(text) is
  'True si el primer segmento del path es el id del estudiante autenticado. Los uploaders del panel escriben en <estudiante_id>/...';

revoke execute on function public.owns_storage_folder(text) from public, anon;
grant execute on function public.owns_storage_folder(text) to authenticated;

-- ── Políticas permisivas que abrían los buckets a `anon` ──────────────────────
drop policy if exists "Acceso Publico Ver Documentos" on storage.objects;
drop policy if exists "Public Access Finalizacion" on storage.objects;
drop policy if exists "Permitir Subida Documentos" on storage.objects;
drop policy if exists "Permitir Actualizar Documentos" on storage.objects;
drop policy if exists "Public Access Estudiantes" on storage.objects;

-- Estas dos permitían a CUALQUIER autenticado escribir en todo el bucket
-- (no sólo en su carpeta). Se reemplazan por versiones scopeadas.
drop policy if exists "Authenticated Insert Finalizacion" on storage.objects;
drop policy if exists "Authenticated Insert Estudiantes" on storage.objects;

-- ── documentos_finalizacion: informes, planillas de asistencia y de horas ─────
-- SELECT e INSERT ya existen scopeados ("Alumnos ven/suben sus propios
-- archivos"). Falta UPDATE para que funcione el upsert.
drop policy if exists "Alumnos actualizan sus propios archivos" on storage.objects;
create policy "Alumnos actualizan sus propios archivos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documentos_finalizacion'
  and public.owns_storage_folder(name)
)
with check (
  bucket_id = 'documentos_finalizacion'
  and public.owns_storage_folder(name)
);

-- ── documentos_estudiantes: CV, certificado de trabajo, planillas de solicitud ─
drop policy if exists "Alumnos ven sus documentos" on storage.objects;
create policy "Alumnos ven sus documentos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documentos_estudiantes'
  and public.owns_storage_folder(name)
);

drop policy if exists "Alumnos suben sus documentos" on storage.objects;
create policy "Alumnos suben sus documentos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documentos_estudiantes'
  and public.owns_storage_folder(name)
);

drop policy if exists "Alumnos actualizan sus documentos" on storage.objects;
create policy "Alumnos actualizan sus documentos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documentos_estudiantes'
  and public.owns_storage_folder(name)
)
with check (
  bucket_id = 'documentos_estudiantes'
  and public.owns_storage_folder(name)
);

-- Esta migración cierra la enumeración de ambos buckets: ya no se pueden listar
-- sus objetos sin ser el dueño o coordinación.
--
-- Trabajo relacionado, aparte: las URLs históricas se guardaron con getPublicUrl
-- (cv_url, certificado_url, planilla_asistencia_url, ...). La migración a
-- bucket + object_path con URLs firmadas se hace por expand/contract, para no
-- romper los enlaces ya almacenados.
