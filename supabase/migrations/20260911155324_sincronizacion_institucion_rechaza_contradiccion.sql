-- El trigger de sincronizacion del paso 1 copiaba el valor solo cuando una de
-- las dos columnas venia vacia. Si llegaban las dos completas y distintas, las
-- aceptaba sin compararlas: la FK validaba el uuid nuevo, pero la columna vieja
-- podia quedar apuntando a otra institucion. Mientras dure la transicion, un
-- lector viejo y uno nuevo leerian instituciones distintas para el mismo
-- lanzamiento.
--
-- Verificado antes de corregir: un INSERT con las dos columnas cargadas y
-- distintas entraba y quedaba inconsistente.
--
-- Ahora, mientras convivan, o coinciden o se rechaza. En UPDATE, si cambio una
-- sola columna se sincroniza la otra; si cambiaron las dos, tienen que estar de
-- acuerdo. La baja en cascada de una institucion (on delete set null) entra por
-- el caso de "cambio una sola" y deja las dos en null.

create or replace function private.sincronizar_institucion_lanzamiento()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_desde_texto uuid;
begin
  v_desde_texto := nullif(btrim(coalesce(new.institucion_id, '')), '')::uuid;

  if tg_op = 'INSERT' then
    if v_desde_texto is not null and new.institucion_uuid is not null then
      if v_desde_texto is distinct from new.institucion_uuid then
        raise exception
          'institucion_id y institucion_uuid apuntan a instituciones distintas (% y %).',
          v_desde_texto, new.institucion_uuid
          using errcode = '22023';
      end if;
    elsif new.institucion_uuid is null then
      new.institucion_uuid := v_desde_texto;
    else
      new.institucion_id := new.institucion_uuid::text;
    end if;

    return new;
  end if;

  if new.institucion_id is distinct from old.institucion_id
     and new.institucion_uuid is distinct from old.institucion_uuid then
    if v_desde_texto is distinct from new.institucion_uuid then
      raise exception
        'institucion_id y institucion_uuid apuntan a instituciones distintas (% y %).',
        v_desde_texto, new.institucion_uuid
        using errcode = '22023';
    end if;
  elsif new.institucion_id is distinct from old.institucion_id then
    new.institucion_uuid := v_desde_texto;
  elsif new.institucion_uuid is distinct from old.institucion_uuid then
    new.institucion_id := new.institucion_uuid::text;
  end if;

  return new;
end;
$fn$;

revoke all on function private.sincronizar_institucion_lanzamiento()
  from public, anon, authenticated;

-- Y la garantia declarativa, que no depende de razonar sobre las ramas del
-- trigger: mientras convivan las dos columnas, en reposo no pueden discrepar.
-- (Aplicada como migracion aparte: 20260911155344_institucion_lanzamiento_check_coherencia)
