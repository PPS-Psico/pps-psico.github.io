begin;

-- left(text, -n) conserva todo menos los últimos n caracteres. Para quitar
-- ".pdf" hay que retirar length('pdf') + 1; el +2 anterior dejaba el stem
-- un carácter corto e impedía colapsar copias obvias como "Informe (1).pdf".
do $patch$
declare
  v_src text;
begin
  select pg_get_functiondef(
    'private.classify_moodle_submission_files_v1(text[],boolean)'::regprocedure
  ) into v_src;

  if v_src is null then
    raise exception 'No se encontró classify_moodle_submission_files_v1';
  end if;
  if position('else left(v_filename, -(length(v_extension) + 2))' in v_src) = 0 then
    raise exception 'Ancla de extensión no encontrada';
  end if;

  v_src := replace(
    v_src,
    'else left(v_filename, -(length(v_extension) + 2))',
    'else left(v_filename, -(length(v_extension) + 1))'
  );
  execute v_src;
end;
$patch$;

commit;
