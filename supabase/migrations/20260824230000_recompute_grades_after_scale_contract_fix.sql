begin;

-- Recalcula las notas aplicadas por Campus que quedaron con una lectura vieja.
--
-- Cuando una tarea esta mal configurada y se corrige su `grade_conversion_mode`
-- -como hizo 20260821200000 con las III Jornadas- la migracion cambia el
-- contrato pero NO reprocesa las notas ya aplicadas. El reproceso deberia haber
-- llegado con el siguiente escaneo, pero `scan_closed` lo impedia, asi que
-- quedaron congeladas con la interpretacion equivocada:
--
--   Bianca Saavedra y Azul Benavente (III Jornadas, 8,00/100) -> 0,8 en vez de 8
--   Agustina Garcia (Sanatorio Juan XXIII, 9,00/100, x2)      -> 0,9 en vez de 9
--
-- Eso es lo que estaban viendo las tres en "Mis Prácticas".
--
-- Ojo: esto tampoco se arregla solo con el trigger destrabado, porque Moodle
-- sigue informando el mismo numero: lo que cambio es como se lee. Solo se tocan
-- las notas de origen automatico; las correcciones de coordinacion (`admin`)
-- quedan intactas.

do $$
declare
  v_rows integer;
begin
  update public.practicas p
  set nota_moodle = r.recalculada,
      nota = rtrim(rtrim(to_char(r.recalculada, 'FM999999990.00'), '0'), '.')
  from (
    select p2.id,
           private.read_moodle_grade_v1(s.grade_value, s.grade_max, ae.grade_conversion_mode)
             as recalculada
    from public.practicas p2
    join public.moodle_grade_snapshots s
      on s.practica_id = p2.id and s.cmid = p2.nota_moodle_cmid
    join public.aula_entregas ae on ae.id = s.aula_entrega_id
    where p2.nota_fuente = 'moodle_session_observed'
      and s.task_status = 'graded'
      and s.grade_value is not null
      and p2.nota_moodle is not null
  ) r
  where p.id = r.id
    and r.recalculada is not null
    and r.recalculada <> p.nota_moodle;

  get diagnostics v_rows = row_count;
  if v_rows <> 4 then
    raise exception 'Se esperaban 4 notas a recalcular y hubo %', v_rows;
  end if;
end $$;

commit;
