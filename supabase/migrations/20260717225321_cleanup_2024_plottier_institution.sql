-- Consolida el último duplicado institucional que impedía alcanzar cobertura
-- completa en los lanzamientos 2024. La diferencia era sólo un doble espacio.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '15s';

lock table public.instituciones, public.lanzamientos_pps, public.practicas
in share row exclusive mode;

do $$
declare
  v_institutions integer;
  v_launches integer;
  v_practices integer;
  v_external_references integer;
begin
  select count(*)::integer into v_institutions
  from public.instituciones
  where nombre in ('Municipalidad de Plottier', 'Municipalidad  de Plottier');

  select count(*)::integer into v_launches
  from public.lanzamientos_pps
  where nombre_pps = 'Municipalidad  de Plottier'
    and fecha_inicio = '2024-04-22'
    and institucion_id is null;

  select count(*)::integer into v_practices
  from public.practicas as p
  join public.lanzamientos_pps as l on l.id = p.lanzamiento_id
  where l.nombre_pps = 'Municipalidad  de Plottier'
    and l.fecha_inicio = '2024-04-22'
    and p.nombre_institucion = 'Municipalidad  de Plottier';

  select coalesce(sum(
    (select count(*) from public.agent_suggestions x where x.institucion_id = i.id) +
    (select count(*) from public.convenios x where x.institucion_id = i.id) +
    (select count(*) from public.gmail_hilos x where x.institucion_id = i.id) +
    (select count(*) from public.institucion_resumen x where x.institucion_id = i.id) +
    (select count(*) from public.lanzamientos_pps x where x.institucion_id = i.id::text) +
    (select count(*) from public.solicitudes_nueva_pps x where x.institucion_id = i.id) +
    (select count(*) from public.whatsapp_contactos x where x.institucion_id = i.id) +
    (select count(*) from public.whatsapp_mensajes x where x.institucion_id = i.id)
  ), 0)::integer into v_external_references
  from public.instituciones as i
  where i.nombre in ('Municipalidad de Plottier', 'Municipalidad  de Plottier');

  if v_institutions <> 2 or v_launches <> 1 or v_practices <> 1 or v_external_references <> 0 then
    raise exception
      'Consolidación Plottier abortada: instituciones %, lanzamientos %, prácticas %, referencias %',
      v_institutions, v_launches, v_practices, v_external_references;
  end if;
end;
$$;

update public.lanzamientos_pps
set
  nombre_pps = 'Municipalidad de Plottier',
  institucion_id = (
    select id::text
    from public.instituciones
    where nombre = 'Municipalidad de Plottier'
  ),
  notas_gestion = concat_ws(
    E'\n',
    nullif(notas_gestion, ''),
    '[reconciliacion_2024:institucion] Nombre normalizado y duplicado institucional consolidado.'
  ),
  updated_at = statement_timestamp()
where nombre_pps = 'Municipalidad  de Plottier'
  and fecha_inicio = '2024-04-22'
  and institucion_id is null;

alter table public.practicas disable trigger trg_check_practica_updates;
alter table public.practicas disable trigger trg_debug_practica;

update public.practicas as p
set nombre_institucion = 'Municipalidad de Plottier'
from public.lanzamientos_pps as l
where p.lanzamiento_id = l.id
  and l.nombre_pps = 'Municipalidad de Plottier'
  and l.fecha_inicio = '2024-04-22'
  and p.nombre_institucion = 'Municipalidad  de Plottier';

alter table public.practicas enable trigger trg_debug_practica;
alter table public.practicas enable trigger trg_check_practica_updates;

delete from public.instituciones
where nombre = 'Municipalidad  de Plottier';

do $$
declare
  v_canonical_institutions integer;
  v_linked_launches integer;
  v_total_launches integer;
  v_normalized_practices integer;
begin
  select count(*)::integer into v_canonical_institutions
  from public.instituciones
  where nombre = 'Municipalidad de Plottier';

  select
    count(*)::integer,
    count(*) filter (where institucion_id is not null)::integer
    into v_total_launches, v_linked_launches
  from public.lanzamientos_pps
  where tipo_actividad = 'pps'
    and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$';

  select count(*)::integer into v_normalized_practices
  from public.practicas as p
  join public.lanzamientos_pps as l on l.id = p.lanzamiento_id
  where l.nombre_pps = 'Municipalidad de Plottier'
    and l.fecha_inicio = '2024-04-22'
    and p.nombre_institucion = 'Municipalidad de Plottier';

  if v_canonical_institutions <> 1
     or v_total_launches <> 80
     or v_linked_launches <> 80
     or v_normalized_practices <> 1 then
    raise exception
      'Validación Plottier falló: instituciones %, lanzamientos %/%, prácticas %',
      v_canonical_institutions, v_linked_launches, v_total_launches, v_normalized_practices;
  end if;
end;
$$;

commit;
