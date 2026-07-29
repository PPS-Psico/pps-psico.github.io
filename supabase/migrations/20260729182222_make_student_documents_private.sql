-- Completa el cierre expand/contract de documentos estudiantiles.
-- El frontend ya resuelve las URLs historicas mediante URLs firmadas, por lo
-- que el bucket puede dejar de exponer descargas publicas sin cambiar paths.

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'documentos_estudiantes'
  ) then
    raise exception 'Bucket documentos_estudiantes does not exist';
  end if;

  update storage.buckets
  set public = false
  where id = 'documentos_estudiantes';
end
$$;
