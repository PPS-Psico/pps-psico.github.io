-- Permite persistir convocatorias programadas sin alterar los estados existentes.
-- La fecha sigue siendo text por compatibilidad legacy; solo se exige contenido
-- mientras la convocatoria permanezca en estado Programada.

alter table public.lanzamientos_pps
  drop constraint if exists lanzamientos_estado_convocatoria_check;

alter table public.lanzamientos_pps
  add constraint lanzamientos_estado_convocatoria_check
  check (
    estado_convocatoria = any (
      array[
        'Oculto'::text,
        'Programada'::text,
        'Abierta'::text,
        'Cerrado'::text,
        'Confirmacion'::text,
        'Activa'::text,
        'Archivado'::text
      ]
    )
  );

alter table public.lanzamientos_pps
  add constraint lanzamientos_programada_fecha_publicacion_check
  check (
    estado_convocatoria <> 'Programada'
    or nullif(btrim(fecha_publicacion), '') is not null
  );
