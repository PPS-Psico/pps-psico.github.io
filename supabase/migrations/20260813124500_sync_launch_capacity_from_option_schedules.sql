-- Mantiene los totales derivados en sincronía cuando cambia el cupo de una
-- franja. `lanzamiento_opcion_horarios` es la fuente operativa de capacidad.

create or replace function private.sync_lanzamiento_opcion_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_option_id uuid;
  v_option_ids uuid[];
  v_launch_id uuid;
  v_total integer;
  v_schedules text[];
begin
  if tg_op = 'DELETE' then
    v_option_ids := array[old.opcion_id];
  elsif tg_op = 'UPDATE' and old.opcion_id <> new.opcion_id then
    v_option_ids := array[old.opcion_id, new.opcion_id];
  else
    v_option_ids := array[new.opcion_id];
  end if;

  foreach v_option_id in array v_option_ids loop
    select coalesce(sum(h.cupos), 0)::integer,
           coalesce(array_agg(h.horario order by h.orden, h.horario)
             filter (where h.activa), '{}'::text[])
    into v_total, v_schedules
    from public.lanzamiento_opcion_horarios h
    where h.opcion_id = v_option_id
      and h.activa;

    update public.lanzamiento_opciones o
    set cupos = case when v_total > 0 then v_total else o.cupos end,
        horarios = v_schedules,
        updated_at = now()
    where o.id = v_option_id
    returning o.lanzamiento_id into v_launch_id;

    if v_launch_id is not null then
      update public.lanzamientos_pps l
      set cupos_disponibles = (
            select coalesce(sum(o.cupos), 0)::integer
            from public.lanzamiento_opciones o
            where o.lanzamiento_id = v_launch_id
              and o.activa
          ),
          updated_at = now()
      where l.id = v_launch_id;
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
