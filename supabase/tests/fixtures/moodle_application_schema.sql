-- Narrow synthetic fixture; table column types and helpers read from live schema 2026-09-06.
create table instituciones (id uuid, created_at timestamp with time zone, airtable_id text, nombre text, direccion text, telefono text, convenio_nuevo smallint, tutor text, codigo_tarjeta_campus text, orientaciones text, logo_url text, logo_invert_dark boolean);
create table lanzamientos_pps (id uuid, created_at timestamp with time zone, airtable_id text, nombre_pps text, fecha_inicio text, fecha_finalizacion text, direccion text, horario_seleccionado text, orientacion text, horas_acreditadas numeric, cupos_disponibles numeric, estado_convocatoria text, plazo_inscripcion_dias numeric, informe text, estado_gestion text, notas_gestion text, fecha_relanzamiento text, permite_certificado boolean, plantilla_seguro_url text, req_certificado_trabajo boolean, req_cv boolean, codigo_tarjeta_campus text, descripcion_larga text, actividades_lista text[], requisito_obligatorio text, fecha_inicio_inscripcion text, fecha_fin_inscripcion text, mensaje_whatsapp text, fecha_publicacion text, actividades_label text, horarios_fijos boolean, institucion_id text, fecha_encuentro_inicial text, updated_at timestamp with time zone, historial_gestion text, proximo_seguimiento text, archivo_descargable_nombre text, archivo_descargable_url text, seguro_gestionado_at timestamp with time zone, seguro_gestionado_por uuid, horarios_obligatorios text[], tipo_actividad text, modalidad_cupo text, selection_closed_at timestamp with time zone, selection_closed_by uuid, lista_estudiantes_entregada_at timestamp with time zone, lista_estudiantes_entregada_por uuid, finalizacion_por_horas boolean, moodle_pilot_dedicated boolean, consentimiento_requerido boolean, unidad_id bigint);
create table convocatorias (id uuid, created_at timestamp with time zone, airtable_id text, lanzamiento_id uuid, estudiante_id uuid, estado_inscripcion text, termino_cursar text, cursando_electivas text, finales_adeuda text, otra_situacion_academica text, informe_subido boolean, fecha_entrega_informe text, horario_seleccionado text, certificado_url text, correo text, telefono text, dni numeric, fecha_nacimiento text, direccion text, nombre_pps text, fecha_inicio text, fecha_finalizacion text, orientacion text, horas_acreditadas numeric, legajo numeric, trabaja boolean, certificado_trabajo text, cv_url text, horario_asignado text, selected_at timestamp with time zone, reminder_sent_at timestamp with time zone, baja_automatica_at timestamp with time zone, selection_decided_at timestamp with time zone, final_reminder_sent_at timestamp with time zone, final_reminder_sent_by uuid, final_reminder_claimed_at timestamp with time zone, final_reminder_claim_token uuid, final_reminder_claimed_by uuid, opcion_asignada_id uuid, opcion_horario_asignado_id uuid, consentimiento_exceptuado_at timestamp with time zone, consentimiento_exceptuado_por uuid, consentimiento_exceptuado_motivo text, seleccion_notificada_at timestamp with time zone, seleccion_notificada_por uuid, seleccion_notificacion_claimed_at timestamp with time zone, seleccion_notificacion_claim_token uuid, seleccion_notificacion_claimed_by uuid);
create table moodle_grade_snapshots (practica_id uuid, cmid bigint, latest_observation_id uuid, estudiante_id uuid, lanzamiento_id uuid, aula_entrega_id bigint, task_status text, submitted boolean, grade_value numeric, grade_max numeric, grade_display text, graded_at_display text, observed_at timestamp with time zone, received_at timestamp with time zone, confidence text, last_observation_id uuid, last_task_status text, last_submitted boolean, last_grade_value numeric, last_grade_max numeric, last_grade_display text, last_graded_at_display text, last_observed_at timestamp with time zone, last_received_at timestamp with time zone, last_confidence text, scan_closed boolean, grade_revision integer, reopened_at timestamp with time zone, submitted_at timestamp with time zone, submitted_at_display text, feedback_comment text, submission_file_count integer, submission_logical_file_count integer, submission_file_types jsonb, attendance_evidence text, attendance_confidence numeric(4,3), attendance_evidence_reasons jsonb, submission_classifier_version text);
CREATE OR REPLACE FUNCTION private.jefe_report_status_v1(p_graded boolean, p_submitted boolean, p_deadline date, p_today date)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_graded then 'corrected'
    when p_submitted
      and p_deadline is not null
      and p_deadline < p_today - 90
      then 'stale'
    when p_submitted then 'pending'
    else 'waiting'
  end;
$function$;

CREATE OR REPLACE FUNCTION private.read_moodle_grade_v1(p_grade_value numeric, p_grade_max numeric, p_mode text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_grade_value is null then null
    -- pass_fail no produce un numero; lo resuelve is_passing_moodle_grade_v1.
    when p_mode = 'pass_fail' then null
    when p_mode = 'direct_10' then
      case
        when p_grade_value >= 4 and p_grade_value <= 10 then round(p_grade_value, 2)
        else null
      end
    when p_grade_max is null or p_grade_max <= 0 then null
    when p_grade_value < 0 or p_grade_value > p_grade_max then null
    -- El piso se evalua sin redondear: un 39/100 no puede volverse un 4.
    when (p_grade_value / p_grade_max) * 10 >= 4
      then round((p_grade_value / p_grade_max) * 10, 2)
    when p_grade_value >= 4 and p_grade_value <= 10 then round(p_grade_value, 2)
    else null
  end;
$function$;

CREATE OR REPLACE FUNCTION private.apply_moodle_grade_observation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

create trigger apply_observation after insert on public.moodle_grade_observations for each row execute function private.apply_moodle_grade_observation();
create function private.require_jefe_areas_v1() returns text[] language plpgsql as $$ begin raise exception 'No assigned areas' using errcode='42501'; end $$;



