begin;

select plan(11);

select ok(
  to_regprocedure('private.evaluate_student_accreditation_transition_v1(uuid,uuid)') is not null,
  'the private accreditation evaluator exists'
);

select ok(
  position(
    'coalesce(bool_and(coalesce(p.informe_estado = ''calificado'', false)), false)'
    in pg_get_functiondef(
      'private.evaluate_student_accreditation_transition_v1(uuid,uuid)'::regprocedure
    )
  ) > 0,
  'the evaluator treats a null report state as pending'
);

select ok(
  position(
    'coalesce(bool_and(p.informe_estado = ''calificado''), false)'
    in pg_get_functiondef(
      'private.evaluate_student_accreditation_transition_v1(uuid,uuid)'::regprocedure
    )
  ) = 0,
  'the evaluator no longer uses the null-skipping report aggregation'
);

select is(
  (
    select coalesce(bool_and(coalesce(report_state = 'calificado', false)), false)
    from (values ('calificado'::text), (null::text)) reports(report_state)
  ),
  false,
  'one null report keeps the aggregate pending even when another is graded'
);

select is(
  (
    select coalesce(bool_and(coalesce(report_state = 'calificado', false)), false)
    from (values ('calificado'::text), ('entregado'::text)) reports(report_state)
  ),
  false,
  'a submitted but ungraded report keeps the aggregate pending'
);

select is(
  (
    select coalesce(bool_and(coalesce(report_state = 'calificado', false)), false)
    from (values ('calificado'::text), ('calificado'::text)) reports(report_state)
  ),
  true,
  'only an all-graded report set passes the aggregate'
);

select is(
  private.classify_moodle_submission_files_v1(
    array['Informe final.pdf', 'Informe final (1).pdf'],
    false
  ) ->> 'attendanceEvidence',
  'duplicate_only',
  'obvious browser copies do not count as attendance evidence'
);

select is(
  private.classify_moodle_submission_files_v1(
    array['Informe final.pdf', 'Planilla firmada.jpg'],
    false
  ) ->> 'attendanceEvidence',
  'detected',
  'a distinct attendance-named attachment is detected conservatively'
);

select is(
  private.classify_moodle_submission_files_v1(
    array['Informe Adultos.pdf', 'Informe Ninos.docx'],
    false
  ) ->> 'attendanceEvidence',
  'needs_review',
  'two report-looking files do not become automatic attendance evidence'
);

select ok(
  position(
    'submission_file_count'
    in pg_get_functiondef(
      'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
    )
  ) > 0
  and position(
    'assignment-grading-table/v2'
    in pg_get_functiondef(
      'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
    )
  ) > 0,
  'the annual Moodle scan persists only derived v2 submission evidence'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.classify_moodle_submission_files_v1(text[],boolean)',
    'execute'
  ),
  'the private filename classifier is not callable directly by clients'
);

select * from finish();
rollback;
