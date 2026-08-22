-- Contrato de lectura de notas de Moodle.
--
-- Debe mantenerse en paridad con readMoodleGrade / isPassingGrade de
-- src/domain/moodle/moodleReportStatus.ts. Si cambia una regla, cambian las dos
-- y estos casos se actualizan juntos.
do $$
declare
  v_fallas text := '';
  v_caso record;
begin
  for v_caso in
    with casos(descr, val, maxv, modo, espera_nota, espera_aprueba) as (values
      -- Porcentaje real: se prorratea contra el maximo de la tarea.
      ('percentage 80/100', 80.0, 100.0, 'percentage', 8.0,  true),
      ('percentage 85/100', 85.0, 100.0, 'percentage', 8.5,  true),
      ('percentage 40/100', 40.0, 100.0, 'percentage', 4.0,  true),
      ('percentage 8/20',    8.0,  20.0, 'percentage', 4.0,  true),
      -- El piso se evalua sin redondear: 3,9 no puede volverse un 4.
      ('percentage 39/100', 39.0, 100.0, 'percentage', null, false),
      -- Nota de escala 1-10 cargada en una tarea configurada sobre 100.
      ('percentage 10/100', 10.0, 100.0, 'percentage', 10.0, true),
      ('percentage 8/100',   8.0, 100.0, 'percentage', 8.0,  true),
      ('percentage 4/100',   4.0, 100.0, 'percentage', 4.0,  true),
      -- Debajo del piso y fuera de la escala 1-10: no es una nota.
      ('percentage 3/100',   3.0, 100.0, 'percentage', null, false),
      ('percentage 0/100',   0.0, 100.0, 'percentage', null, false),
      ('percentage max 0',   4.0,   0.0, 'percentage', null, false),
      ('percentage fuera de rango', 120.0, 100.0, 'percentage', null, false),
      -- Escala 1-10 declarada por la tarea.
      ('direct_10 8',        8.0, 100.0, 'direct_10',  8.0,  true),
      ('direct_10 10',      10.0, 100.0, 'direct_10', 10.0,  true),
      ('direct_10 3.99',    3.99, 100.0, 'direct_10',  null, false),
      ('direct_10 40',      40.0, 100.0, 'direct_10',  null, false),
      -- Aprobado / desaprobado: no produce numero.
      ('pass_fail 1',        1.0,   2.0, 'pass_fail',  null, true),
      ('pass_fail 0',        0.0,   2.0, 'pass_fail',  null, false),
      ('sin nota',           null, 100.0,'percentage', null, false)
    )
    select
      c.descr,
      private.read_moodle_grade_v1(c.val, c.maxv, c.modo) as nota,
      c.espera_nota,
      private.is_passing_moodle_grade_v1(c.val, c.maxv, c.modo) as aprueba,
      c.espera_aprueba
    from casos c
  loop
    if v_caso.nota is distinct from v_caso.espera_nota then
      v_fallas := v_fallas || format(
        E'\n  %s: nota %s, se esperaba %s',
        v_caso.descr, coalesce(v_caso.nota::text, 'NULL'),
        coalesce(v_caso.espera_nota::text, 'NULL')
      );
    end if;
    if v_caso.aprueba is distinct from v_caso.espera_aprueba then
      v_fallas := v_fallas || format(
        E'\n  %s: aprueba %s, se esperaba %s',
        v_caso.descr, v_caso.aprueba, v_caso.espera_aprueba
      );
    end if;
  end loop;

  if v_fallas <> '' then
    raise exception 'La lectura de notas de Moodle no cumple el contrato:%', v_fallas;
  end if;
end $$;

-- La cola de jefaturas no puede dar por corregido un informe cuyo unico
-- respaldo es un numero que no es una nota (el 0 que deja Campus cuando la
-- correccion real va escrita en los comentarios).
do $$
declare
  v_falsos integer;
begin
  select count(*) into v_falsos
  from private.jefe_report_rows_v1(array['clinica','educacional','laboral','comunitaria']) r
  join public.practicas p on p.id = r.practica_id
  join public.moodle_grade_snapshots s on s.practica_id = p.id
  left join public.aula_entregas ae on ae.id = s.aula_entrega_id
  where r.report_status = 'corrected'
    and s.task_status = 'graded'
    and private.read_moodle_grade_v1(s.grade_value, s.grade_max, ae.grade_conversion_mode) is null
    and coalesce(ae.grade_conversion_mode, '') <> 'pass_fail'
    -- Salvo que la practica tenga su propia nota cargada en el panel.
    and coalesce(p.nota, '') !~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
    and lower(trim(coalesce(p.nota, ''))) <> 'desaprobado';

  if v_falsos > 0 then
    raise exception
      'Hay % informes dados por corregidos cuyo unico respaldo no es una nota valida', v_falsos;
  end if;
end $$;
