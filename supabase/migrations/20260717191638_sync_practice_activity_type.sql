-- Mantiene la clasificación de prácticas alineada con su lanzamiento.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_practice_activity_from_launch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lanzamiento_id is not null then
    select l.tipo_actividad
      into new.tipo_actividad
    from public.lanzamientos_pps as l
    where l.id = new.lanzamiento_id;
  end if;
  return new;
end;
$$;

create or replace function private.propagate_launch_activity_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo_actividad is distinct from old.tipo_actividad then
    update public.practicas
    set tipo_actividad = new.tipo_actividad
    where lanzamiento_id = new.id
      and tipo_actividad is distinct from new.tipo_actividad;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_practice_activity_from_launch()
  from public, anon, authenticated;
revoke all on function private.propagate_launch_activity_type()
  from public, anon, authenticated;

drop trigger if exists sync_practice_activity_from_launch on public.practicas;
create trigger sync_practice_activity_from_launch
before insert or update of lanzamiento_id on public.practicas
for each row execute function private.sync_practice_activity_from_launch();

drop trigger if exists propagate_launch_activity_type on public.lanzamientos_pps;
create trigger propagate_launch_activity_type
after update of tipo_actividad on public.lanzamientos_pps
for each row execute function private.propagate_launch_activity_type();

commit;
