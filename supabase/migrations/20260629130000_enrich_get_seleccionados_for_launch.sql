-- ============================================================================
-- Enriquecer get_seleccionados_for_launch con el estado de firma del compromiso
-- ============================================================================
--
-- Problema: la vista "Ver convocados" (estudiante) mostraba a TODOS como
-- pendientes ("nadie firmó"), aunque hubiera firmas. Causa raíz: por RLS, un
-- estudiante solo puede leer su propio perfil (estudiantes) y su propia firma
-- (compromisos_pps). La lista de convocados se arma vía esta función
-- SECURITY DEFINER, que devolvía nombre/legajo/horario pero NO el estado de
-- firma → el cliente marcaba a todos como "pendiente".
--
-- Solución: la función (SECURITY DEFINER, ya saltea RLS) ahora hace LEFT JOIN
-- con compromisos_pps y devuelve `convocatoria_id`, `firmo` y `accepted_at`.
-- Además se corrige el filtro de membresía: antes `ilike '%Seleccionado%'`
-- también incluía "No Seleccionado". Ahora se exige match exacto de
-- "Seleccionado" (o cualquier "Asignado"), igual que la vista de Confirmación
-- del Lanzador (admin).
--
-- compromisos_pps.convocatoria_id es UNIQUE (un compromiso por convocatoria),
-- por lo que el LEFT JOIN no duplica filas.
-- ============================================================================

drop function if exists public.get_seleccionados_for_launch(uuid);

create or replace function public.get_seleccionados_for_launch(p_lanzamiento_id uuid)
returns table(
  convocatoria_id uuid,
  horario text,
  nombre text,
  legajo text,
  firmo boolean,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return query
  select
    c.id as convocatoria_id,
    coalesce(c.horario_asignado, c.horario_seleccionado, 'No especificado') as horario,
    coalesce(e.nombre, 'Estudiante') as nombre,
    coalesce(e.legajo::text, '---') as legajo,
    (cp.id is not null and lower(cp.estado) = 'aceptado') as firmo,
    cp.accepted_at as accepted_at
  from public.convocatorias c
  left join public.estudiantes e on e.id = c.estudiante_id
  left join public.compromisos_pps cp on cp.convocatoria_id = c.id
  where c.lanzamiento_id = p_lanzamiento_id
    and (
      lower(c.estado_inscripcion) = 'seleccionado'
      or lower(c.estado_inscripcion) like '%asignado%'
    )
  order by horario, nombre;
end;
$function$;

grant execute on function public.get_seleccionados_for_launch(uuid)
  to anon, authenticated, service_role;
