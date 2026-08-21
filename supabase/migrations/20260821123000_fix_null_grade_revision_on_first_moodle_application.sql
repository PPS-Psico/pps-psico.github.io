-- Corrige la perdida de calificaciones introducida por workflow_v2.
--
-- En plpgsql, SELECT INTO que no devuelve filas asigna NULL a los destinos y
-- pisa el inicializador current_revision := 1. La primera observacion 'graded'
-- de una practica sin snapshot previo para (practica_id, cmid) insertaba
-- grade_revision NULL en private.moodle_grade_applications (23502) y abortaba
-- la transaccion completa: se perdian la observacion, el snapshot y la nota,
-- y cada reintento del puente volvia a fallar.
-- Detectado via moodle_sync_runs: 65 corridas perdidas desde 2026-08-19 con
-- detalle "null value in column grade_revision".
--
-- El resto del cuerpo queda identico a la version vigente.

create or replace function private.apply_moodle_grade_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
begin
  next_report_status := case new.task_status
    when 'graded' then 'calificado'
    when 'submitted' then 'entregado'
    when 'not_submitted' then 'sin_entrega'
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
     or new.grade_max <= 0 then
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

  if found and current_scan_closed then
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

  select a.grade_conversion_mode
    into conversion_mode
  from public.aula_entregas a
  where a.id = new.aula_entrega_id;

  if conversion_mode = 'direct_10' then
    normalized_grade := round(new.grade_value, 2);
    note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');
    conversion_rule := 'explicit_direct_10';
  elsif conversion_mode = 'pass_fail' then
    normalized_grade := null;
    note_text := case when new.grade_value > 0 then 'Aprobado' else 'Desaprobado' end;
    conversion_rule := 'explicit_pass_fail';
  else
    normalized_grade := round((new.grade_value / new.grade_max) * 10, 2);
    note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');
    conversion_rule := 'explicit_percentage';
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
$$;

revoke all on function private.apply_moodle_grade_observation()
  from public, anon, authenticated;
