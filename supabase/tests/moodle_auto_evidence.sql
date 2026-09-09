begin;
do $$ declare n integer; begin
  assert private.moodle_grade_is_pending_v1(null), 'null grade is pending';
  assert private.moodle_grade_is_pending_v1('Sin calificar'), 'legacy placeholder is pending';
  assert not private.moodle_grade_is_pending_v1('9'), 'numeric grade protected';
  assert not private.moodle_grade_is_pending_v1('Aprobado'), 'qualitative grade protected';
  select count(*) into n from private.moodle_report_grades_v1(
    'Informe Clínica de Niños y Adolescente: 9 (Nueve)Informe Clínica de Adultos: 8 (Ocho)');
  assert n=2,'separate report grades';
  select count(*) into n from private.moodle_report_grades_v1('Informe Adultos: 9 (Ocho)');
  assert n=0,'disagreeing written grade rejected';
  select count(*) into n from private.moodle_report_grades_v1('Informe Adultos: 90 (Nueve)');
  assert n=0,'out of scale report grade rejected';
  assert private.moodle_report_words_v1('Clínica de Niños y Adolescente') <@
    private.moodle_report_words_v1('Institución Fernando Ulloa - Niños y Adolescentes'), 'launch label matching';
  assert not (private.moodle_report_words_v1('Adultos') <@
    private.moodle_report_words_v1('Institución Fernando Ulloa - Niños y Adolescentes')), 'distinct reports';
  assert not has_function_privilege('authenticated','private.reconcile_moodle_case_v1(uuid)','execute'), 'private writer';
  assert not has_function_privilege('anon','public.reconcile_student_moodle_evidence_v1(uuid)','execute'), 'anonymous denied';
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.reconcile_student_moodle_evidence_v1(gen_random_uuid());
    raise exception 'Anonymous reconciliation succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin
    perform public.reconcile_student_moodle_evidence_v1(gen_random_uuid());
    raise exception 'Cross-student reconciliation succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
