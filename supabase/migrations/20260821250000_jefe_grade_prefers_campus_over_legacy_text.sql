begin;

-- La cola de jefaturas prefiere `practicas.nota` sobre lo que informa Campus, y
-- eso es correcto cuando la nota es real. Pero varios registros conservan
-- textos legado ("Entregado (sin corregir)", "Sin calificar") que ganaban por
-- el solo hecho de no estar vacios, tapando una nota que Campus si tiene.
--
-- Hoy son cuatro casos (Di Paolo x2, Hernandez Ortiz, Martin) que el estudiante
-- ve calificados y la jefatura veia como sin corregir. En vez de corregirlos
-- uno por uno, se cambia la precedencia: una nota numerica -- o un
-- Aprobado/Desaprobado explicito -- manda; si lo unico que hay es un texto de
-- relleno, se muestra la nota leida de Campus.
do $patch$
declare
  v_src text;
  v_anchor text;
  v_count integer;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'jefe_report_rows_v1';

  if v_src is null then
    raise exception 'No se encontro jefe_report_rows_v1';
  end if;

  v_anchor := 'coalesce(
      nullif(trim(s.nota), ''''),
      rtrim(rtrim(to_char(s.campus_grade, ''FM999999990.00''), ''0''), ''.''),
      nullif(trim(s.grade_display), '''')
    ) as grade,';

  v_count := (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor);
  if v_count <> 1 then
    raise exception 'Se esperaba 1 ancla de grade; hay %', v_count;
  end if;

  v_src := replace(v_src, v_anchor, 'coalesce(
      case
        when trim(coalesce(s.nota, '''')) ~ ''^(10|[0-9])([.,][0-9]{1,2})?$''
          or lower(trim(coalesce(s.nota, ''''))) in (''aprobado'', ''desaprobado'')
        then trim(s.nota)
      end,
      rtrim(rtrim(to_char(s.campus_grade, ''FM999999990.00''), ''0''), ''.''),
      nullif(trim(s.nota), ''''),
      nullif(trim(s.grade_display), '''')
    ) as grade,');

  execute v_src;
end;
$patch$;

commit;
