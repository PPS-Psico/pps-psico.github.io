-- La incorporación manual desde el Lanzador crea la convocatoria directamente
-- como Seleccionado. El trigger histórico sólo escuchaba UPDATE, por lo que esa
-- ruta podía dejar una selección sin su práctica En curso.
drop trigger if exists trigger_gestion_automatica_practicas_insert on public.convocatorias;
create trigger trigger_gestion_automatica_practicas_insert
after insert on public.convocatorias
for each row execute function public.handle_seleccion_alumno();
