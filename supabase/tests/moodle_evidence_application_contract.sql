begin;
do $$
declare staff uuid:=auth.uid(); student_user uuid:=gen_random_uuid(); student uuid:=gen_random_uuid();
  other_student uuid:=gen_random_uuid(); p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid();
  c uuid; v uuid; d1 uuid; d2 uuid; rev integer; app1 uuid; app2 uuid; academic jsonb; before_value jsonb;
  result jsonb; note1 text; note2 text;
  content jsonb:='{"status":"graded","submitted":true,"gradeValue":80,"gradeMax":100,"gradeDisplay":"80/100","feedbackComment":"A: 7; B: 9","submittedAt":"2026-08-01T12:00:00Z"}';
begin
  insert into auth.users(id) values(student_user);
  insert into public.estudiantes(id,user_id,role,dni,nombre) values
    (student,student_user,'Alumno',99999991,'[TEST] Applied'),(other_student,null,'Alumno',99999992,'[TEST] Other');
  insert into public.practicas(id,estudiante_id,nombre_institucion,tipo_actividad,especialidad,nota,informe_estado,nota_fuente)
    values(p1,student,'[TEST] A','pps','Clínica','6','calificado','admin'),
      (p2,student,'[TEST] B','pps','Clínica',null,null,null),
      (p3,student,'[TEST] C','pps','Clínica',null,null,null);
  c:=private.capture_moodle_evidence_v1(gen_random_uuid(),'jefe',staff,3615,999991,123,student,now(),content);
  select id into v from private.moodle_evidence_versions where case_id=c;
  select revision into rev from private.moodle_evidence_cases where id=c;
  rev:=public.decide_moodle_evidence_v1(c,v,p1,rev,'allocate','[TEST] Reviewed A',7);
  rev:=public.decide_moodle_evidence_v1(c,v,p2,rev,'allocate','[TEST] Reviewed B',9);
  select id into d1 from private.moodle_evidence_decisions where practica_id=p1;
  select id into d2 from private.moodle_evidence_decisions where practica_id=p2;
  select private.moodle_academic_fields_v1(p) into before_value from public.practicas p where id=p1;
  app1:=public.apply_moodle_evidence_decision_v1(d1,before_value,'apply','[TEST] Confirm A');
  select private.moodle_academic_fields_v1(p) into academic from public.practicas p where id=p2;
  app2:=public.apply_moodle_evidence_decision_v1(d2,academic,'apply','[TEST] Confirm B');
  select nota into note1 from public.practicas where id=p1;
  select nota into note2 from public.practicas where id=p2;
  if note1<>'7' or note2<>'9' then raise exception 'Shared grades conflated'; end if;
  if (private.moodle_practice_snapshot_v1(p1)->>'grade_value')::numeric<>7
    or (private.moodle_practice_snapshot_v1(p2)->>'grade_value')::numeric<>9 then
    raise exception 'Canonical read differs from application'; end if;
  if private.moodle_practice_snapshot_v1(p3) is not null then raise exception 'Unassigned PPS inherited delivery'; end if;
  -- Jefatura and student RPC use the same per-practice selection.
  if (select grade from private.jefe_report_rows_v1(array['clinica']) where practica_id=p1)<>'7'
    or (select submitted_at from private.jefe_report_rows_v1(array['clinica']) where practica_id=p2)
       is distinct from '2026-08-01T12:00:00Z'::timestamptz then raise exception 'Jefe read differs'; end if;
  perform set_config('request.jwt.claim.sub',student_user::text,true);
  result:=public.read_moodle_practice_snapshots_v1(student);
  if jsonb_array_length(result)<>2 then raise exception 'Student canonical read differs'; end if;
  begin
    perform public.read_moodle_practice_snapshots_v1(other_student);
    raise exception 'Student read another student';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_moodle_evidence_decision_v1(d1,before_value,'apply','[TEST] Impersonation');
    raise exception 'Student applied a grade';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',staff::text,true);
  begin
    perform public.apply_moodle_evidence_decision_v1(d1,before_value,'apply','[TEST] Stale request');
    raise exception 'Stale application accepted';
  exception when serialization_failure then null; end;
  -- Same content on a new read must not turn a reviewed allocation stale.
  perform private.capture_moodle_evidence_v1(gen_random_uuid(),'jefe',staff,3615,999991,123,student,now()+interval '1 second',content);
  if (private.moodle_practice_snapshot_v1(p1)->>'reviewRequired')::boolean then raise exception 'Identical read invalidated decision'; end if;
  -- Automatic readers keep raw evidence but cannot replace either academic value.
  insert into public.moodle_grade_observations(id,request_id,observed_at,course_id,cmid,moodle_user_id,
    estudiante_id,practica_id,auth_user_id,task_status,submitted,grade_value,grade_max)
    values(gen_random_uuid(),gen_random_uuid(),now(),3615,999991,123,student,p1,staff,'graded',true,100,100);
  if (select nota from public.practicas where id=p1)<>'7' then raise exception 'Automatic reader overwrote grade'; end if;
  -- New correction stays visible as review required, preserving the prior decision.
  perform private.capture_moodle_evidence_v1(gen_random_uuid(),'jefe',staff,3615,999991,123,student,
    now()+interval '2 seconds',content||'{"feedbackComment":"A: 8; B: 9"}'::jsonb);
  if not (private.moodle_practice_snapshot_v1(p1)->>'reviewRequired')::boolean then raise exception 'Correction was hidden'; end if;
  select private.moodle_academic_fields_v1(p) into academic from public.practicas p where id=p1;
  begin
    perform public.apply_moodle_evidence_decision_v1(d1,academic,'apply','[TEST] Old evidence',app1);
    raise exception 'Old evidence reapplied';
  exception when serialization_failure then null; end;
  -- Reversal restores exact original fields, and never the other PPS grade.
  perform public.apply_moodle_evidence_decision_v1(d1,academic,'revert','[TEST] Undo attribution',app1);
  if (select private.moodle_academic_fields_v1(p) from public.practicas p where id=p1) is distinct from before_value
    or (select nota from public.practicas where id=p2)<>'9' then raise exception 'Incorrect reversal'; end if;
  if private.moodle_practice_snapshot_v1(p1) is not null then raise exception 'Revoked evidence returned as legacy'; end if;
  -- A concurrent manual grade prevents reversal from erasing that edit.
  update public.practicas set nota='10' where id=p2;
  select private.moodle_academic_fields_v1(p) into academic from public.practicas p where id=p2;
  begin
    perform public.apply_moodle_evidence_decision_v1(d2,academic,'revert','[TEST] Protect later edit',app2);
    raise exception 'Manual edit erased by reversal';
  exception when serialization_failure then null; end;
  if (select count(*) from private.moodle_evidence_applications)<>3 then raise exception 'Audit events missing'; end if;
  if public.moodle_evidence_inbox_v2()->>'mode'<>'review_and_apply' then raise exception 'Application inbox unavailable'; end if;
  if has_function_privilege('anon','public.apply_moodle_evidence_decision_v1(uuid,jsonb,text,text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','private.moodle_practice_snapshot_v1(uuid)','EXECUTE')
    or has_table_privilege('authenticated','private.moodle_evidence_projection','UPDATE') then raise exception 'Privilege leak'; end if;
end $$;
rollback;
