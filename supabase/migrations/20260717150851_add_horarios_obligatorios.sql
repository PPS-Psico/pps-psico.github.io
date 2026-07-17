alter table public.lanzamientos_pps
  add column if not exists horarios_obligatorios text[];

comment on column public.lanzamientos_pps.horarios_obligatorios is
  'Franjas del horario_seleccionado que todos los estudiantes deben aceptar. NULL conserva la semantica legacy de horarios_fijos; un array vacio indica que ninguna franja es obligatoria.';
