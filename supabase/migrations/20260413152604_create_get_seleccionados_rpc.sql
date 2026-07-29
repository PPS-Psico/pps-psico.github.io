create or replace function public.get_seleccionados_for_launch(p_lanzamiento_id uuid)
returns table(horario text, nombre text, legajo text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    coalesce(c.horario_asignado, c.horario_seleccionado, 'No especificado') as horario,
    coalesce(e.nombre, 'Estudiante') as nombre,
    coalesce(e.legajo::text, '---') as legajo
  from public.convocatorias c
  left join public.estudiantes e on e.id = c.estudiante_id
  where c.lanzamiento_id = p_lanzamiento_id
    and c.estado_inscripcion ilike '%Seleccionado%'
  order by horario, nombre;
end;
$$;

grant execute on function public.get_seleccionados_for_launch(uuid) to authenticated, service_role;

comment on function public.get_seleccionados_for_launch(uuid) is
  'RPC que devuelve los estudiantes seleccionados de un lanzamiento con nombre y legajo. Security definer para saltear RLS de estudiantes.';