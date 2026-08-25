begin;

-- Recalcula las notas ya aplicadas cuando cambia el contrato de escala.
--
-- Cuando una tarea esta mal configurada y se corrige su `grade_conversion_mode`
-- -como hizo 20260821200000 con las III Jornadas- las notas ya escritas quedan
-- con la lectura vieja. El reproceso deberia llegar con el siguiente escaneo,
-- pero Moodle sigue informando el mismo numero: lo que cambio es como se lee,
-- asi que la observacion nueva no trae "informacion nueva" y no reaplica.
--
-- Resultado real: tres alumnas vieron 0,8 y 0,9 durante un mes hasta que se
-- corrigio a mano en 20260824230000. Esto lo vuelve automatico.
--
-- Solo toca notas de origen automatico: las correcciones de coordinacion
-- (`admin`) quedan intactas.

create or replace function private.recompute_grades_after_scale_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_rows integer;
begin
  if new.grade_conversion_mode is not distinct from old.grade_conversion_mode then
    return new;
  end if;

  update public.practicas p
  set nota_moodle = r.recalculada,
      nota = rtrim(rtrim(to_char(r.recalculada, 'FM999999990.00'), '0'), '.'),
      nota_actualizada_at = now()
  from (
    select p2.id,
           private.read_moodle_grade_v1(s.grade_value, s.grade_max, new.grade_conversion_mode)
             as recalculada
    from public.practicas p2
    join public.moodle_grade_snapshots s
      on s.practica_id = p2.id and s.cmid = p2.nota_moodle_cmid
    where s.aula_entrega_id = new.id
      and p2.nota_fuente = 'moodle_session_observed'
      and s.task_status = 'graded'
      and s.grade_value is not null
      and p2.nota_moodle is not null
  ) r
  where p.id = r.id
    and r.recalculada is not null
    and r.recalculada <> p.nota_moodle;

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise notice 'Escala de la tarea % cambio a %: % notas recalculadas',
      new.id, new.grade_conversion_mode, v_rows;
  end if;

  return new;
end;
$function$;

drop trigger if exists recompute_grades_after_scale_change_trigger on public.aula_entregas;
create trigger recompute_grades_after_scale_change_trigger
after update of grade_conversion_mode on public.aula_entregas
for each row
execute function private.recompute_grades_after_scale_change();

commit;
