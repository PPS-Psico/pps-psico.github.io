-- Synthetic fixtures only. Every write, including trigger effects, is rolled back.
begin;
set local statement_timeout='45s';
set local lock_timeout='5s';
do $$
declare student uuid:=gen_random_uuid(); actor uuid;
  launch uuid:=gen_random_uuid(); sibling uuid:=gen_random_uuid(); practice uuid:=gen_random_uuid();
  task bigint:=1999999851; c uuid; r jsonb; preview jsonb; old_note text; count_before integer;
  run uuid:=gen_random_uuid();
begin
  select id into actor from auth.users limit 1;
  if actor is null then actor:=gen_random_uuid(); insert into auth.users(id) values(actor); end if;
  insert into public.estudiantes(id,nombre) values(student,'[TEST] Grade authority');
  insert into public.lanzamientos_pps(id,nombre_pps,moodle_task_policy)
    values(launch,'[TEST] Authority Adultos','legacy_shared'),(sibling,'[TEST] Authority Niños','legacy_shared');
  insert into public.aula_entregas(id,area,institucion,moodle_id,academic_year,grade_conversion_mode)
    overriding system value values(task,'clinica','[TEST] Authority',task::text,2026,'direct_10');
  insert into public.lanzamiento_moodle_tareas(lanzamiento_id,orientacion_key,aula_entrega_id,validation_status,link_source)
    values(launch,'clinica',task,'confirmed','manual');
  insert into public.practicas(id,estudiante_id,lanzamiento_id,especialidad,nota)
    values(practice,student,launch,'Clínica','Sin calificar');

  -- An old client posting only an observation cannot manufacture academic provenance.
  insert into public.moodle_grade_observations(observed_at,auth_user_id,estudiante_id,practica_id,
    lanzamiento_id,aula_entrega_id,course_id,cmid,task_status,submitted,grade_value,grade_max,
    request_id,bridge_version,parser_version,payload_hash,moodle_user_id)
    values(now(),actor,student,practice,launch,task,3615,task,'graded',true,9,10,
      gen_random_uuid(),'test','test',repeat('a',64),1999999851);
  assert (select nota='Sin calificar' from public.practicas where id=practice),'legacy-only observation must not write a grade';
  c:=private.capture_moodle_evidence_v1(gen_random_uuid(),'student',actor,3615,task,1999999851,student,
    now()+interval '1 second',jsonb_build_object('status','graded','submitted',true,'gradeValue',80,'gradeMax',100));
  select count(*) into count_before from private.moodle_evidence_applications;
  r:=private.preview_moodle_case_v1(c);
  assert r->'plan'->>'reason'='invalid_grade','direct_10 rejects 80';
  assert (select count(*) from private.moodle_evidence_applications)=count_before,'preview must not apply';
  -- Scale changes use the same attribution, with a full before/after application.
  update public.aula_entregas set grade_conversion_mode='percentage' where id=task;
  assert (select nota='8' from public.practicas where id=practice),'valid unique attribution applies 8 after scale change';
  assert exists(select 1 from private.moodle_evidence_projection where practica_id=practice and active),'scale applies through projection';
  assert (private.moodle_practice_snapshot_v1(practice)->>'grade_value')::numeric=8,'canonical confirmed grade';
  select count(*) into count_before from private.moodle_evidence_applications;
  perform private.reconcile_moodle_case_v1(c);
  assert (select count(*) from private.moodle_evidence_applications)=count_before,'repetition is idempotent';

  -- Shared ambiguity protects both an already projected grade and an old unprojected one.
  insert into public.lanzamiento_moodle_tareas(lanzamiento_id,orientacion_key,aula_entrega_id,validation_status,link_source)
    values(sibling,'clinica',task,'confirmed','manual');
  update public.aula_entregas set grade_conversion_mode='direct_10' where id=task;
  assert (select nota='8' from public.practicas where id=practice),'shared scale cannot overwrite a projection';
  assert private.plan_moodle_case_v1(c)->>'reason'='report_allocation_required','sharing across launches requires allocation';
  -- Remove the synthetic projection to exercise the previously unguarded branch.
  delete from private.moodle_evidence_projection where practica_id=practice;
  update public.practicas set nota='7',nota_moodle=7,nota_fuente='moodle_session_observed' where id=practice;
  insert into public.moodle_grade_observations(observed_at,auth_user_id,estudiante_id,practica_id,
    lanzamiento_id,aula_entrega_id,course_id,cmid,task_status,submitted,grade_value,grade_max,
    request_id,bridge_version,parser_version,payload_hash,moodle_user_id)
    values(now()+interval '2 seconds',actor,student,practice,launch,task,3615,task,'graded',true,9,10,
      gen_random_uuid(),'test','test',repeat('a',64),1999999851);
  assert (select nota='7' from public.practicas where id=practice),'rejected unprojected observation must not overwrite';
  update public.aula_entregas set grade_conversion_mode='percentage' where id=task;
  assert (select nota='7' from public.practicas where id=practice),'rejected unprojected scale must not overwrite';
  r:=private.moodle_practice_snapshot_v1(practice);
  assert r->>'grade_value' is null and r->>'task_status'='submitted','unattributed task number is not a practice grade';
  assert r->>'academicGrade'='7','staff retain the previous academic record';

  -- Grading-table previews must not be interpreted as complete report corrections.
  perform private.capture_moodle_evidence_v1(gen_random_uuid(),'student',actor,3615,task,1999999851,student,
    now()+interval '3 seconds',jsonb_build_object('status','graded','submitted',true,'gradeValue',80,'gradeMax',100,
      'feedbackComment','Informe Adultos: 8 (Ocho). Falta revisar ...'));
  assert private.plan_moodle_case_v1(c)->>'reason'='incomplete_allocation_feedback','abbreviated feedback requires review';
  assert (select nota='7' from public.practicas where id=practice),'truncated feedback does not write a grade';

  -- Reject stale historical previews and preserve edits made after the preview.
  preview:=private.preview_moodle_case_v1(c);
  update public.practicas set nota='6',nota_fuente='admin' where id=practice;
  r:=private.apply_moodle_history_batch_v1(run,jsonb_build_array(preview));
  assert r->0->'outcome'->>'reason'='stale_preview','historical batch refuses stale baseline';
  assert (select nota='6' from public.practicas where id=practice),'manual edit survives history batch';
  r:=private.apply_moodle_history_batch_v1(run,jsonb_build_array(preview));
  assert (r->0->>'replayed')::boolean,'batch retry is idempotent';

  -- Ready previews neither write nor hide the before/after of later application.
  delete from public.lanzamiento_moodle_tareas where lanzamiento_id=sibling;
  perform private.capture_moodle_evidence_v1(gen_random_uuid(),'student',actor,3615,task,1999999851,student,
    now()+interval '4 seconds',jsonb_build_object('status','graded','submitted',true,'gradeValue',80,'gradeMax',100));
  assert (select nota='6' from public.practicas where id=practice),'capture preserves manual grade';
  update public.practicas set nota_fuente='moodle_session_observed' where id=practice;
  preview:=private.preview_moodle_case_v1(c);
  assert preview->'plan'->'results'->0->>'status'='ready','ready historical plan';
  assert (select nota='6' from public.practicas where id=practice),'ready preview is non-writing';
  r:=private.apply_moodle_history_batch_v1(gen_random_uuid(),jsonb_build_array(preview));
  assert r->0->'outcome'->'results'->0->>'status'='applied','matching preview applies';
  assert (select nota='8' from public.practicas where id=practice),'historical correction applied';
  assert exists(select 1 from private.moodle_evidence_applications where practica_id=practice
    and previous_academic->>'nota'='6' and applied_academic->>'nota'='8'),'historical before/after retained';

  assert (select provolatile='s' from pg_proc where oid='private.plan_moodle_case_v1(uuid)'::regprocedure),'planner is database-enforced read-only';
  assert not has_function_privilege('authenticated','private.apply_moodle_history_batch_v1(uuid,jsonb)','execute'),'student cannot invoke historical writer';
  assert not has_function_privilege('anon','private.preview_moodle_history_v1(uuid,integer)','execute'),'anonymous cannot read history';
end $$;
rollback;
