begin;

-- La nota de Moodle quedaba atrapada en el snapshot y nunca llegaba a practicas.
--
-- `scan_closed` existe para que un rescaneo no pise una nota ya establecida
-- (correccion de coordinacion o aplicacion previa). Pero el trigger BEFORE de
-- moodle_grade_snapshots hace `new.scan_closed := new.task_status = 'graded'`,
-- o sea cierra el scan en el mismo momento en que Moodle marca la tarea como
-- calificada, antes de que apply_moodle_grade_observation llegue a aplicarla.
-- Al respetar el candado cuando todavia no habia nada que proteger, la nota
-- nunca cruzaba del snapshot a la practica: nota_fuente, nota_moodle y
-- nota_moodle_cmid quedaban en NULL, y get_finalization_grade_resolution -que
-- anula toda nota sin fuente- mostraba "-" en la solicitud de egreso.
--
-- El candado ahora solo bloquea cuando la practica ya tiene una nota verificada
-- que proteger. La primera aplicacion siempre pasa.

create or replace function private.apply_moodle_grade_observation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_note text;
  note_text text;
  normalized_grade numeric;
  conversion_mode text;
  conversion_rule text;
  current_revision integer := 1;
  current_scan_closed boolean := false;
  application_id uuid;
  next_report_status text;
  grade_is_usable boolean := false;
  has_protected_grade boolean := false;
begin
  select a.grade_conversion_mode
    into conversion_mode
  from public.aula_entregas a
  where a.id = new.aula_entrega_id;

  if new.task_status = 'graded' then
    grade_is_usable := conversion_mode = 'pass_fail'
      or private.read_moodle_grade_v1(new.grade_value, new.grade_max, conversion_mode) is not null;
  end if;

  next_report_status := case
    when new.task_status = 'graded' and grade_is_usable then 'calificado'
    -- Moodle marca la tarea calificada pero el numero no es una nota: el
    -- informe sigue esperando su correccion real.
    when new.task_status = 'graded' then 'entregado'
    when new.task_status = 'submitted' then 'entregado'
    when new.task_status = 'not_submitted' then 'sin_entrega'
    else 'a_revisar'
  end;

  -- El estado operativo progresa de forma monotona y ya no contamina nota.
  update public.practicas p
  set informe_estado = case
    when p.informe_estado = 'calificado' then p.informe_estado
    when p.informe_estado = 'entregado' and next_report_status in ('sin_entrega', 'a_revisar')
      then p.informe_estado
    when p.informe_estado = 'sin_entrega' and next_report_status = 'a_revisar'
      then p.informe_estado
    else next_report_status
  end
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id;

  if new.task_status <> 'graded'
     or new.grade_value is null
     or new.grade_max is null
     or new.grade_max <= 0
     or not grade_is_usable then
    return new;
  end if;

  select s.grade_revision, s.scan_closed
    into current_revision, current_scan_closed
  from public.moodle_grade_snapshots s
  where s.practica_id = new.practica_id
    and s.cmid = new.cmid
  for update;

  -- Sin fila previa es la revision inicial (1), no NULL: SELECT INTO vacio
  -- asigna NULL aunque exista el inicializador.
  if not found then
    current_revision := 1;
    current_scan_closed := false;
  else
    current_revision := coalesce(current_revision, 1);
  end if;

  -- Solo hay algo que proteger si la practica ya tiene nota con procedencia.
  select p.nota_fuente is not null and p.nota_fuente <> 'legacy'
    into has_protected_grade
  from public.practicas p
  where p.id = new.practica_id;

  if current_scan_closed and coalesce(has_protected_grade, false) then
    return new;
  end if;

  if exists (
    select 1 from private.moodle_grade_finalizations f
    where f.practica_id = new.practica_id
      and f.cmid = new.cmid
      and f.grade_revision = current_revision
  ) then
    return new;
  end if;

  if conversion_mode = 'pass_fail' then
    normalized_grade := null;
    note_text := case when new.grade_value > 0 then 'Aprobado' else 'Desaprobado' end;
    conversion_rule := 'explicit_pass_fail';
  else
    normalized_grade := private.read_moodle_grade_v1(
      new.grade_value, new.grade_max, conversion_mode
    );
    note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');
    conversion_rule := case
      when conversion_mode = 'direct_10' then 'explicit_direct_10'
      when normalized_grade = round(new.grade_value, 2)
        and (new.grade_value / new.grade_max) * 10 < 4 then 'recovered_ten_scale'
      else 'explicit_percentage'
    end;
  end if;

  if normalized_grade is not null and (normalized_grade < 0 or normalized_grade > 10) then
    raise exception 'La nota Moodle normalizada queda fuera del rango 0-10.'
      using errcode = '22003';
  end if;

  select p.nota into current_note
  from public.practicas p
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id
  for update;

  if not found then
    raise exception 'La practica observada no pertenece al estudiante validado.'
      using errcode = '23503';
  end if;

  update public.practicas
  set nota = note_text,
      informe_estado = 'calificado',
      nota_moodle = normalized_grade,
      nota_fuente = new.confidence,
      nota_actualizada_at = new.observed_at,
      nota_moodle_cmid = new.cmid
  where id = new.practica_id;

  insert into private.moodle_grade_applications (
    source_observation_id, source_observed_at, estudiante_id, practica_id,
    cmid, previous_note, applied_note, grade_value, grade_max,
    conversion_rule, confidence, changed, grade_revision
  ) values (
    new.id, new.observed_at, new.estudiante_id, new.practica_id,
    new.cmid, current_note, note_text, new.grade_value, new.grade_max,
    conversion_rule, new.confidence, current_note is distinct from note_text,
    current_revision
  ) returning id into application_id;

  insert into private.moodle_grade_finalizations (
    practica_id, cmid, grade_revision, source_observation_id, application_id
  ) values (
    new.practica_id, new.cmid, current_revision, new.id, application_id
  );

  return new;
end;
$function$;

commit;
