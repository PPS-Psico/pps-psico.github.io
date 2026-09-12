-- Paso 1 de 3 hacia la FK de lanzamientos_pps.institucion_id.
--
-- La columna es `text` y instituciones.id es `uuid`, asi que la FK exige
-- convertir el tipo. Convertirla de una rompe en runtime ocho funciones que hoy
-- dependen de que sea texto: comparan con `~*` para ver si "parece" un uuid, o
-- joinean con `i.id::text = l.institucion_id`. Entre ellas estan las cuatro de
-- inscripcion y seleccion de convocatoria, que usan los estudiantes.
--
-- Por eso la transicion es compatible y en tres pasos:
--
--   1. (este) columna uuid nueva, con la FK, llenada y sincronizada en ambos
--      sentidos. Nada que lea o escriba la columna vieja se entera.
--   2. migrar los ocho lectores de a uno a la columna nueva.
--   3. retirar la columna vieja y su sincronizacion.
--
-- La FK va con `on delete set null`, que es como referencian a instituciones
-- practicas, solicitudes_nueva_pps y whatsapp_contactos.

alter table public.lanzamientos_pps
  add column if not exists institucion_uuid uuid
  references public.instituciones(id) on delete set null;

-- El backfill puede ser total porque ya no quedan referencias invalidas: la
-- unica que habia (el string "recInstMock_nuevo") se reparo antes.
update public.lanzamientos_pps
set institucion_uuid = institucion_id::uuid
where institucion_id is not null
  and institucion_uuid is null;

create index if not exists lanzamientos_pps_institucion_uuid_idx
  on public.lanzamientos_pps (institucion_uuid);

-- Mientras convivan las dos columnas, escribir cualquiera actualiza la otra.
-- Es lo que permite migrar los lectores de a uno sin coordinar un unico corte.
create or replace function private.sincronizar_institucion_lanzamiento()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.institucion_uuid is null and new.institucion_id is not null then
      new.institucion_uuid := new.institucion_id::uuid;
    elsif new.institucion_id is null and new.institucion_uuid is not null then
      new.institucion_id := new.institucion_uuid::text;
    end if;
    return new;
  end if;

  -- En UPDATE manda la columna que efectivamente cambio. Si cambiaron las dos,
  -- la vieja sigue siendo la fuente hasta que termine el paso 2.
  if new.institucion_id is distinct from old.institucion_id then
    new.institucion_uuid := nullif(btrim(new.institucion_id), '')::uuid;
  elsif new.institucion_uuid is distinct from old.institucion_uuid then
    new.institucion_id := new.institucion_uuid::text;
  end if;

  return new;
end;
$fn$;

revoke all on function private.sincronizar_institucion_lanzamiento()
  from public, anon, authenticated;

drop trigger if exists sincronizar_institucion_lanzamiento on public.lanzamientos_pps;
create trigger sincronizar_institucion_lanzamiento
before insert or update of institucion_id, institucion_uuid on public.lanzamientos_pps
for each row execute function private.sincronizar_institucion_lanzamiento();

comment on column public.lanzamientos_pps.institucion_uuid is
  'Referencia real a instituciones, con FK. Convive con institucion_id (text) mientras se migran los lectores; las dos se mantienen sincronizadas por trigger.';
