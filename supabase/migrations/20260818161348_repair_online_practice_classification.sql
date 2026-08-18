-- La acreditacion por PPS no exige planilla de asistencia cuando la practica
-- es virtual. El backfill original solo reconocia `Modalidad Virtual`, pero los
-- lanzamientos historicos de 2025 usan tambien `Online`.

create schema if not exists private;

create or replace function private.is_online_pps_direction(p_direction text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(coalesce(p_direction, ''))) in (
    'online',
    'virtual',
    'modalidad virtual',
    'a distancia'
  );
$$;

revoke all on function private.is_online_pps_direction(text) from public;

update public.practicas as p
set es_online = true
from public.lanzamientos_pps as l
where p.lanzamiento_id = l.id
  and private.is_online_pps_direction(l.direccion)
  and p.es_online is distinct from true;

comment on column public.practicas.es_online is
  'TRUE si la PPS es online y no requiere planilla de asistencia. Se deriva del lanzamiento (Online, Virtual, Modalidad Virtual o A distancia) o de la solicitud que originó la práctica.';

-- Protege todos los flujos de alta (seleccionador clásico, multiopción y
-- futuras RPC): una práctica vinculada a un lanzamiento virtual siempre queda
-- clasificada como online, aunque el INSERT omita la columna.
create or replace function private.set_practica_online_from_launch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_direction text;
begin
  if new.lanzamiento_id is null or coalesce(new.es_online, false) then
    return new;
  end if;

  select l.direccion
  into v_direction
  from public.lanzamientos_pps as l
  where l.id = new.lanzamiento_id;

  if private.is_online_pps_direction(v_direction) then
    new.es_online := true;
  end if;

  return new;
end;
$$;

revoke all on function private.set_practica_online_from_launch() from public;

drop trigger if exists set_practica_online_from_launch on public.practicas;
create trigger set_practica_online_from_launch
before insert or update of lanzamiento_id, es_online
on public.practicas
for each row
execute function private.set_practica_online_from_launch();

-- Si coordinación corrige la modalidad de un lanzamiento ya utilizado,
-- sincroniza las prácticas vinculadas sin tocar las solicitudes independientes.
create or replace function private.sync_online_practices_from_launch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_online_pps_direction(new.direccion)
     and new.direccion is distinct from old.direccion then
    update public.practicas
    set es_online = true
    where lanzamiento_id = new.id
      and es_online is distinct from true;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_online_practices_from_launch() from public;

drop trigger if exists sync_online_practices_from_launch on public.lanzamientos_pps;
create trigger sync_online_practices_from_launch
after update of direccion
on public.lanzamientos_pps
for each row
execute function private.sync_online_practices_from_launch();
