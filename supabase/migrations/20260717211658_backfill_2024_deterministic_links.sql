-- Vínculos históricos 2024 demostrables sin inferencia:
-- 1) lanzamiento -> institución por nombre normalizado exacto y único;
-- 2) práctica -> lanzamiento por nombre normalizado + fecha exacta y candidato único.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table backfill_2024_launch_institution_candidates
on commit drop
as
select
  l.id as lanzamiento_id,
  (array_agg(i.id order by i.id))[1] as institucion_id
from public.lanzamientos_pps as l
join public.instituciones as i
  on lower(regexp_replace(trim(i.nombre), '\s+', ' ', 'g')) =
     lower(regexp_replace(trim(l.nombre_pps), '\s+', ' ', 'g'))
where l.tipo_actividad = 'pps'
  and l.fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}'
  and l.institucion_id is null
group by l.id
having count(i.id) = 1;

alter table backfill_2024_launch_institution_candidates
  add primary key (lanzamiento_id);

create temporary table backfill_2024_practice_launch_candidates
on commit drop
as
select
  p.id as practica_id,
  (array_agg(l.id order by l.id))[1] as lanzamiento_id
from public.practicas as p
join public.lanzamientos_pps as l
  on lower(regexp_replace(trim(l.nombre_pps), '\s+', ' ', 'g')) =
     lower(regexp_replace(trim(p.nombre_institucion), '\s+', ' ', 'g'))
 and left(l.fecha_inicio, 10) = left(p.fecha_inicio, 10)
 and l.tipo_actividad = 'pps'
where p.tipo_actividad = 'pps'
  and p.fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}'
  and p.lanzamiento_id is null
group by p.id
having count(l.id) = 1;

alter table backfill_2024_practice_launch_candidates
  add primary key (practica_id);

do $$
declare
  v_launch_candidates integer;
  v_practice_candidates integer;
begin
  select count(*) into v_launch_candidates
  from backfill_2024_launch_institution_candidates;

  select count(*) into v_practice_candidates
  from backfill_2024_practice_launch_candidates;

  if v_launch_candidates <> 68 then
    raise exception
      'Backfill 2024 abortado: se esperaban 68 vínculos lanzamiento-institución y se obtuvieron %',
      v_launch_candidates;
  end if;

  if v_practice_candidates <> 317 then
    raise exception
      'Backfill 2024 abortado: se esperaban 317 vínculos práctica-lanzamiento y se obtuvieron %',
      v_practice_candidates;
  end if;
end;
$$;

update public.lanzamientos_pps as l
set
  institucion_id = c.institucion_id::text,
  updated_at = statement_timestamp()
from backfill_2024_launch_institution_candidates as c
where l.id = c.lanzamiento_id
  and l.institucion_id is null;

-- Dos triggers legacy revierten lanzamiento_id cuando no hay una sesión admin y
-- generan una fila de debug por UPDATE. Se suspenden únicamente durante este
-- backfill transaccional; el trigger de sincronización de tipo permanece activo.
alter table public.practicas disable trigger trg_check_practica_updates;
alter table public.practicas disable trigger trg_debug_practica;

update public.practicas as p
set lanzamiento_id = c.lanzamiento_id
from backfill_2024_practice_launch_candidates as c
where p.id = c.practica_id
  and p.lanzamiento_id is null;

alter table public.practicas enable trigger trg_debug_practica;
alter table public.practicas enable trigger trg_check_practica_updates;

do $$
declare
  v_linked_launches integer;
  v_linked_practices integer;
begin
  select count(*) into v_linked_launches
  from public.lanzamientos_pps
  where tipo_actividad = 'pps'
    and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}'
    and institucion_id is not null;

  select count(*) into v_linked_practices
  from public.practicas
  where tipo_actividad = 'pps'
    and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}'
    and lanzamiento_id is not null;

  if v_linked_launches <> 68 then
    raise exception
      'Validación post-backfill falló: se esperaban 68 lanzamientos vinculados y se obtuvieron %',
      v_linked_launches;
  end if;

  if v_linked_practices <> 319 then
    raise exception
      'Validación post-backfill falló: se esperaban 319 prácticas vinculadas y se obtuvieron %',
      v_linked_practices;
  end if;
end;
$$;

commit;
