begin;

-- Clasificador SQL equivalente al v1 de TypeScript. Los nombres de archivo
-- existen sólo durante esta llamada: la función devuelve conteos, tipos y
-- códigos de decisión, y ninguna tabla persiste el texto recibido.
create or replace function private.classify_moodle_submission_files_v1(
  p_filenames text[],
  p_is_online boolean
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
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
      else left(v_filename, -(length(v_extension) + 2))
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
$function$;

revoke all on function private.classify_moodle_submission_files_v1(text[], boolean)
  from public, anon, authenticated;

-- El barrido anual ya leía la tabla #submissions, pero ignoraba la columna
-- "Archivos enviados". Se amplía el parser SQL vigente mediante anclas para
-- no reescribir ni deshacer los parches de alcance y precedencia de jefatura.
do $patch$
declare
  v_src text;
begin
  select pg_get_functiondef(
    'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
  ) into v_src;

  if v_src is null then
    raise exception 'No se encontró sync_jefe_moodle_reports_scoped_v1_impl';
  end if;
  if position('assignment-grading-table/v2' in v_src) > 0 then
    return;
  end if;

  if position($old$      "submittedAtDisplay" text
$old$ in v_src) = 0 then
    raise exception 'Ancla row_data no encontrada';
  end if;
  v_src := replace(v_src, $old$      "submittedAtDisplay" text
$old$, $new$      "submittedAtDisplay" text,
      "submissionFiles" text[]
$new$);

  if position($old$      nullif(trim(r."submittedAtDisplay"), '') as submitted_at_display,
      (
$old$ in v_src) = 0 then
    raise exception 'Ancla normalized no encontrada';
  end if;
  v_src := replace(v_src, $old$      nullif(trim(r."submittedAtDisplay"), '') as submitted_at_display,
      (
$old$, $new$      nullif(trim(r."submittedAtDisplay"), '') as submitted_at_display,
      r."submissionFiles" as submission_files,
      (
$new$);

  if position($old$        and length(coalesce(r."submittedAtDisplay", '')) <= 200
        and (
$old$ in v_src) = 0 then
    raise exception 'Ancla validación de fila no encontrada';
  end if;
  v_src := replace(v_src, $old$        and length(coalesce(r."submittedAtDisplay", '')) <= 200
        and (
$old$, $new$        and length(coalesce(r."submittedAtDisplay", '')) <= 200
        and (
          r."submissionFiles" is null
          or (
            cardinality(r."submissionFiles") <= 20
            and not exists (
              select 1
              from unnest(r."submissionFiles") filename
              where filename is null
                 or trim(filename) = ''
                 or length(trim(filename)) > 180
            )
          )
        )
        and (
$new$);

  if position($old$      regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') as student_dni,
      matched.area_key
$old$ in v_src) = 0 then
    raise exception 'Ancla practice_scope no encontrada';
  end if;
  v_src := replace(v_src, $old$      regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') as student_dni,
      matched.area_key
$old$, $new$      regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') as student_dni,
      coalesce(p.es_online, false) as es_online,
      matched.area_key
$new$);

  if position($old$      ps.student_dni,
      ae.id as aula_entrega_id,
$old$ in v_src) = 0 then
    raise exception 'Ancla de candidatos no encontrada';
  end if;
  v_src := replace(v_src, $old$      ps.student_dni,
      ae.id as aula_entrega_id,
$old$, $new$      ps.student_dni,
      ps.es_online,
      ae.id as aula_entrega_id,
$new$);

  if position($old$      (array_agg(s.grade_conversion_mode order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as grade_conversion_mode
$old$ in v_src) = 0 then
    raise exception 'Ancla candidate_counts no encontrada';
  end if;
  v_src := replace(v_src, $old$      (array_agg(s.grade_conversion_mode order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as grade_conversion_mode
$old$, $new$      (array_agg(s.grade_conversion_mode order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as grade_conversion_mode,
      (array_agg(s.es_online order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as es_online
$new$);

  if position($old$      cc.grade_conversion_mode,
      (
$old$ in v_src) = 0 then
    raise exception 'Ancla classified no encontrada';
  end if;
  v_src := replace(v_src, $old$      cc.grade_conversion_mode,
      (
$old$, $new$      cc.grade_conversion_mode,
      cc.es_online,
      (evidence.result ->> 'fileCount')::integer as submission_file_count,
      (evidence.result ->> 'logicalFileCount')::integer as submission_logical_file_count,
      nullif(evidence.result -> 'fileTypeCounts', 'null'::jsonb) as submission_file_types,
      evidence.result ->> 'attendanceEvidence' as attendance_evidence,
      (evidence.result ->> 'attendanceConfidence')::numeric as attendance_confidence,
      evidence.result -> 'reasons' as attendance_evidence_reasons,
      evidence.result ->> 'classifierVersion' as submission_classifier_version,
      (
$new$);

  if position($old$    left join candidate_counts cc
      on cc.cmid = n.cmid
     and cc.student_dni = n.student_dni
  ), inserted as (
$old$ in v_src) = 0 then
    raise exception 'Ancla lateral classifier no encontrada';
  end if;
  v_src := replace(v_src, $old$    left join candidate_counts cc
      on cc.cmid = n.cmid
     and cc.student_dni = n.student_dni
  ), inserted as (
$old$, $new$    left join candidate_counts cc
      on cc.cmid = n.cmid
     and cc.student_dni = n.student_dni
    cross join lateral (
      select private.classify_moodle_submission_files_v1(
        n.submission_files,
        coalesce(cc.es_online, false)
      ) as result
    ) evidence
  ), inserted as (
$new$);

  if position($old$      parser_version,
      confidence,
      payload_hash
$old$ in v_src) = 0 then
    raise exception 'Ancla columnas observation no encontrada';
  end if;
  v_src := replace(v_src, $old$      parser_version,
      confidence,
      payload_hash
$old$, $new$      parser_version,
      confidence,
      submission_file_count,
      submission_logical_file_count,
      submission_file_types,
      attendance_evidence,
      attendance_confidence,
      attendance_evidence_reasons,
      submission_classifier_version,
      payload_hash
$new$);

  if position($old$      'moodle_session_observed',
      encode(
$old$ in v_src) = 0 then
    raise exception 'Ancla valores observation no encontrada';
  end if;
  v_src := replace(v_src, $old$      'moodle_session_observed',
      encode(
$old$, $new$      'moodle_session_observed',
      c.submission_file_count,
      c.submission_logical_file_count,
      c.submission_file_types,
      c.attendance_evidence,
      c.attendance_confidence,
      c.attendance_evidence_reasons,
      c.submission_classifier_version,
      encode(
$new$);

  if position($old$              'gradeMax', coalesce(c.grade_max, c.configured_grade_max)
$old$ in v_src) = 0 then
    raise exception 'Ancla hash no encontrada';
  end if;
  v_src := replace(v_src, $old$              'gradeMax', coalesce(c.grade_max, c.configured_grade_max)
$old$, $new$              'gradeMax', coalesce(c.grade_max, c.configured_grade_max),
              'submissionFileCount', c.submission_file_count,
              'attendanceEvidence', c.attendance_evidence,
              'attendanceConfidence', c.attendance_confidence
$new$);

  if position($old$      observed_at,
      received_at,
      confidence
    )
$old$ in v_src) = 0 then
    raise exception 'Ancla columnas snapshot no encontrada';
  end if;
  v_src := replace(v_src, $old$      observed_at,
      received_at,
      confidence
    )
$old$, $new$      observed_at,
      received_at,
      confidence,
      submission_file_count,
      submission_logical_file_count,
      submission_file_types,
      attendance_evidence,
      attendance_confidence,
      attendance_evidence_reasons,
      submission_classifier_version
    )
$new$);

  if position($old$      i.observed_at,
      i.received_at,
      i.confidence
    from inserted i
$old$ in v_src) = 0 then
    raise exception 'Ancla valores snapshot no encontrada';
  end if;
  v_src := replace(v_src, $old$      i.observed_at,
      i.received_at,
      i.confidence
    from inserted i
$old$, $new$      i.observed_at,
      i.received_at,
      i.confidence,
      i.submission_file_count,
      i.submission_logical_file_count,
      i.submission_file_types,
      i.attendance_evidence,
      i.attendance_confidence,
      i.attendance_evidence_reasons,
      i.submission_classifier_version
    from inserted i
$new$);

  if position($old$      received_at = excluded.received_at,
      confidence = excluded.confidence
$old$ in v_src) = 0 then
    raise exception 'Ancla upsert snapshot no encontrada';
  end if;
  v_src := replace(v_src, $old$      received_at = excluded.received_at,
      confidence = excluded.confidence
$old$, $new$      received_at = excluded.received_at,
      confidence = excluded.confidence,
      submission_file_count = excluded.submission_file_count,
      submission_logical_file_count = excluded.submission_logical_file_count,
      submission_file_types = excluded.submission_file_types,
      attendance_evidence = excluded.attendance_evidence,
      attendance_confidence = excluded.attendance_confidence,
      attendance_evidence_reasons = excluded.attendance_evidence_reasons,
      submission_classifier_version = excluded.submission_classifier_version
$new$);

  v_src := replace(
    v_src,
    '''assignment-grading-table/v1''',
    '''assignment-grading-table/v2'''
  );

  execute v_src;
end;
$patch$;

commit;
