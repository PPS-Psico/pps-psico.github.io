begin;

select plan(6);

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

select * from finish();
rollback;
