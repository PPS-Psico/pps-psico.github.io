-- Isolated contract fixture: actual column types and helper definitions read from
-- production on 2026-09-05. No production records. This is not a full schema replay.
create schema if not exists private;
create schema if not exists auth;
DO $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; end $$;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
create table public.aula_entregas (id bigint, area text, institucion text, moodle_id text, orden integer, activo boolean, created_at timestamp with time zone, course_id bigint, academic_year smallint, moodle_name text, source_synced_at timestamp with time zone, moodle_grade_item_id bigint, moodle_grade_max numeric, gradebook_position integer, grade_conversion_mode text, closed_at timestamp with time zone, close_cutoff_at date, closed_by uuid, close_note text, primary key(id));
create table public.estudiantes (id uuid, created_at timestamp with time zone, airtable_id text, legajo text, nombre text, nombre_separado text, apellido_separado text, genero text, orientacion_elegida text, dni numeric, fecha_nacimiento text, correo text, telefono text, notas_internas text, fecha_finalizacion text, role text, must_change_password boolean, user_id uuid, trabaja boolean, certificado_trabajo text, estado text, cohorte smallint, primary key(id));
create table public.lanzamiento_moodle_tareas (id bigint, lanzamiento_id uuid, orientacion_key text, aula_entrega_id bigint, validation_status text, link_source text, rationale text, created_at timestamp with time zone, updated_at timestamp with time zone, validated_at timestamp with time zone, validated_by uuid, primary key(id));
create table public.moodle_grade_observations (id uuid, received_at timestamp with time zone, observed_at timestamp with time zone, auth_user_id uuid, estudiante_id uuid, practica_id uuid, lanzamiento_id uuid, aula_entrega_id bigint, course_id bigint, cmid bigint, moodle_user_id bigint, moodle_username text, task_status text, submitted boolean, grade_value numeric, grade_max numeric, grade_display text, graded_at_display text, request_id uuid, bridge_version text, parser_version text, confidence text, payload_hash text, submitted_at timestamp with time zone, submitted_at_display text, feedback_comment text, submission_file_count integer, submission_logical_file_count integer, submission_file_types jsonb, attendance_evidence text, attendance_confidence numeric(4,3), attendance_evidence_reasons jsonb, submission_classifier_version text, primary key(id));
create table public.practica_moodle_tareas (id bigint, practica_id uuid, aula_entrega_id bigint, validation_status text, link_source text, rationale text, created_at timestamp with time zone, updated_at timestamp with time zone, validated_at timestamp with time zone, validated_by uuid, primary key(id));
create table public.practicas (id uuid, created_at timestamp with time zone, airtable_id text, estudiante_id uuid, lanzamiento_id uuid, horas_realizadas numeric, fecha_inicio text, fecha_finalizacion text, estado text, especialidad text, nota text, nombre_institucion text, es_online boolean, tipo_actividad text, desaprobacion_fecha date, desaprobacion_causas text[], desaprobacion_motivo_publico text, desaprobacion_notificado_at timestamp with time zone, desaprobacion_registrado_por uuid, informe_estado text, nota_moodle numeric(5,2), nota_fuente text, nota_actualizada_at timestamp with time zone, nota_moodle_cmid bigint, opcion_id uuid, institucion_id uuid, opcion_horario_id uuid, primary key(id));
CREATE OR REPLACE FUNCTION private.classify_moodle_submission_files_v1(p_filenames text[], p_is_online boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_raw text;
  v_filename text;
  v_extension text;
  v_stem text;
  v_normalized text;
  v_logical_key text;
  v_logical_keys text[] := array[]::text[];
  v_file_count integer := 0;
  v_image_count integer := 0;
  v_pdf_count integer := 0;
  v_word_count integer := 0;
  v_other_count integer := 0;
  v_attendance_hints integer := 0;
  v_report_hints integer := 0;
  v_logical_file_count integer;
begin
  if p_filenames is null then
    return jsonb_build_object(
      'fileCount', null,
      'logicalFileCount', null,
      'fileTypeCounts', null,
      'attendanceEvidence', case when p_is_online then 'not_required' else 'needs_review' end,
      'attendanceConfidence', case when p_is_online then 1 else 0 end,
      'reasons', jsonb_build_array(
        case when p_is_online then 'online_attendance_not_required' else 'file_list_not_observed' end
      ),
      'classifierVersion', 'submission-files/v1'
    );
  end if;

  foreach v_raw in array p_filenames loop
    v_filename := left(trim(coalesce(v_raw, '')), 180);
    if v_filename = '' then
      continue;
    end if;

    v_file_count := v_file_count + 1;
    v_extension := lower(coalesce(substring(v_filename from '\.([a-z0-9]{1,8})$'), ''));
    if v_extension in ('jpg', 'jpeg', 'png', 'heic', 'webp', 'tif', 'tiff') then
      v_image_count := v_image_count + 1;
    elsif v_extension = 'pdf' then
      v_pdf_count := v_pdf_count + 1;
    elsif v_extension in ('doc', 'docx', 'odt', 'rtf') then
      v_word_count := v_word_count + 1;
    else
      v_other_count := v_other_count + 1;
    end if;

    v_stem := case
      when v_extension = '' then v_filename
      else left(v_filename, -(length(v_extension) + 1))
    end;
    v_stem := regexp_replace(v_stem, '\s*[\[(][0-9]+[\])]\s*$', '', 'i');
    v_stem := regexp_replace(v_stem, '[\s_-]+(copia|copy)[\s_-]+[0-9]+\s*$', '', 'i');
    v_stem := regexp_replace(v_stem, '[\s_-]+(copia|copy)\s*$', '', 'i');
    v_logical_key := trim(regexp_replace(
      lower(translate(v_stem, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
      '[^a-z0-9]+',
      ' ',
      'g'
    ));
    if v_logical_key = '' then
      v_logical_key := trim(regexp_replace(
        lower(translate(v_filename, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
        '[^a-z0-9]+',
        ' ',
        'g'
      ));
    end if;
    if not (v_logical_key = any(v_logical_keys)) then
      v_logical_keys := array_append(v_logical_keys, v_logical_key);
    end if;

    v_normalized := trim(regexp_replace(
      lower(translate(v_filename, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
      '[^a-z0-9]+',
      ' ',
      'g'
    ));
    if v_normalized ~ '(^| )(asistencia|asistencias|presentismo|planilla|firma|firmas|firmada|horas|registro)( |$)' then
      v_attendance_hints := v_attendance_hints + 1;
    end if;
    if v_normalized ~ '(^| )(informe|reporte|trabajo final)( |$)' then
      v_report_hints := v_report_hints + 1;
    end if;
  end loop;

  v_logical_file_count := cardinality(v_logical_keys);

  if p_is_online then
    return jsonb_build_object(
      'fileCount', v_file_count,
      'logicalFileCount', v_logical_file_count,
      'fileTypeCounts', jsonb_build_object(
        'image', v_image_count, 'pdf', v_pdf_count, 'word', v_word_count, 'other', v_other_count
      ),
      'attendanceEvidence', 'not_required',
      'attendanceConfidence', 1,
      'reasons', jsonb_build_array('online_attendance_not_required'),
      'classifierVersion', 'submission-files/v1'
    );
  end if;

  return jsonb_build_object(
    'fileCount', v_file_count,
    'logicalFileCount', v_logical_file_count,
    'fileTypeCounts', jsonb_build_object(
      'image', v_image_count, 'pdf', v_pdf_count, 'word', v_word_count, 'other', v_other_count
    ),
    'attendanceEvidence', case
      when v_file_count = 0 then 'missing'
      when v_logical_file_count = 1 and v_file_count > 1 then 'duplicate_only'
      when v_logical_file_count = 1 and v_attendance_hints > 0 then 'needs_review'
      when v_logical_file_count = 1 then 'single_file'
      when v_attendance_hints > 0 then 'detected'
      when v_report_hints >= v_logical_file_count and v_image_count = 0 then 'needs_review'
      else 'assumed'
    end,
    'attendanceConfidence', case
      when v_file_count = 0 then 0
      when v_logical_file_count = 1 and v_file_count > 1 then 0.1
      when v_logical_file_count = 1 and v_attendance_hints > 0 then 0.2
      when v_logical_file_count = 1 then 0
      when v_attendance_hints > 0 then 0.99
      when v_report_hints >= v_logical_file_count and v_image_count = 0 then 0.25
      when (v_pdf_count + v_word_count) > 0 and v_image_count > 0 then 0.92
      when v_image_count >= 2 then 0.85
      else 0.65
    end,
    'reasons', case
      when v_file_count = 0 then jsonb_build_array('no_files_observed')
      when v_logical_file_count = 1 and v_file_count > 1 then
        jsonb_build_array('obvious_copies_collapsed', 'only_one_logical_file')
      when v_logical_file_count = 1 and v_attendance_hints > 0 then
        jsonb_build_array('attendance_named_but_report_not_observed')
      when v_logical_file_count = 1 then jsonb_build_array('only_one_logical_file')
      when v_attendance_hints > 0 then
        jsonb_build_array('attendance_filename_hint', 'multiple_logical_files')
      when v_report_hints >= v_logical_file_count and v_image_count = 0 then
        jsonb_build_array('all_files_look_like_reports', 'multiple_logical_files')
      when (v_pdf_count + v_word_count) > 0 and v_image_count > 0 then
        jsonb_build_array('document_plus_image_cluster', 'multiple_logical_files')
      when v_image_count >= 2 then
        jsonb_build_array('multiple_image_pages', 'multiple_logical_files')
      else jsonb_build_array('multiple_logical_files', 'generic_file_mix')
    end,
    'classifierVersion', 'submission-files/v1'
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION private.jefe_orientation_key(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select regexp_replace(
    translate(lower(coalesce(p_value, '')), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+', '', 'g'
  );
$function$
;
CREATE OR REPLACE FUNCTION private.jefe_text_has_area(p_value text, p_area_key text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select private.jefe_orientation_key(p_value) like '%' || p_area_key || '%';
$function$
;
CREATE OR REPLACE FUNCTION private.moodle_v2_is_coordinator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(auth.role(), '') = 'service_role'
    or exists (
      select 1 from public.estudiantes e
      where e.user_id = (select auth.uid()) and e.role in ('SuperUser', 'AdminTester')
    );
$function$
;
