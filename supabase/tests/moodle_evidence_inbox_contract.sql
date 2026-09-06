begin;
set local statement_timeout='30s';
do $$
declare
  v_staff uuid:=auth.uid(); v_user uuid:=gen_random_uuid(); v_student uuid:=gen_random_uuid();
  v_other uuid:=gen_random_uuid(); v_p1 uuid:=gen_random_uuid(); v_p2 uuid:=gen_random_uuid();
  v_p3 uuid:=gen_random_uuid(); v_request uuid:=gen_random_uuid(); v_case uuid; v_version uuid;
  v_revision integer; v_count integer; v_result jsonb;
  v_row jsonb:='{"cmid":9999991,"status":"graded","submitted":true,"gradeValue":80,"gradeMax":100,"gradeDisplay":"80/100","feedbackComment":"PPS A: 7; PPS B: 9","submissionFiles":["informe.pdf","asistencia.jpg"]}';
begin
  if not private.moodle_v2_is_coordinator() then raise exception 'Contract requires synthetic coordinator'; end if;
  insert into auth.users(id) values(v_user);
  insert into public.estudiantes(id,user_id,legajo,nombre,dni,role) values
    (v_student,v_user,'TEST-EVIDENCE','[TEST] Evidence',99999991,'Alumno'),
    (v_other,null,'TEST-EVIDENCE-OTHER','[TEST] Other',99999992,'Alumno');
  insert into public.practicas(id,estudiante_id,nombre_institucion,tipo_actividad) values
    (v_p1,v_student,'[TEST] A','pps'),(v_p2,v_student,'[TEST] B','pps'),(v_p3,v_other,'[TEST] C','pps');
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  v_result:=public.ingest_student_moodle_evidence_v1(v_request,3615,now(),99999991,'99999991',jsonb_build_array(v_row));
  if v_result->>'accepted'<>'1' then raise exception 'Unlinked observation lost'; end if;
  perform public.ingest_student_moodle_evidence_v1(v_request,3615,now(),99999991,'99999991',jsonb_build_array(v_row));
  select c.id,c.revision into v_case,v_revision from private.moodle_evidence_cases c where c.moodle_user_id=99999991;
  select count(*) into v_count from private.moodle_evidence_versions where case_id=v_case;
  if v_count<>1 or v_revision<>1 then raise exception 'Retry not idempotent'; end if;
  select id into v_version from private.moodle_evidence_versions where case_id=v_case;
  if exists(select 1 from private.moodle_evidence_versions where case_id=v_case and content::text like '%informe.pdf%') then raise exception 'Raw filename leaked'; end if;
  begin
    perform public.moodle_evidence_inbox_v1();
    raise exception 'Student read coordinator inbox';
  exception when insufficient_privilege then null; end;
  begin
    perform public.ingest_student_moodle_evidence_v1(gen_random_uuid(),3615,now(),99999992,'99999992',jsonb_build_array(v_row));
    raise exception 'Other student impersonated';
  exception when insufficient_privilege then null; end;
  v_result:=public.ingest_student_moodle_evidence_v1(gen_random_uuid(),3615,now(),99999991,'99999991',
    jsonb_build_array(v_row,jsonb_set(v_row,'{gradeMax}','0')));
  if v_result->>'accepted'<>'1' or v_result->>'rejected'<>'1' then raise exception 'Partial batch lost valid row'; end if;
  perform set_config('request.jwt.claim.sub',v_staff::text,true);
  select revision into v_revision from private.moodle_evidence_cases where id=v_case;
  v_revision:=public.decide_moodle_evidence_v1(v_case,v_version,v_p1,v_revision,'allocate','[TEST] Verified PPS A',7);
  v_revision:=public.decide_moodle_evidence_v1(v_case,v_version,v_p2,v_revision,'allocate','[TEST] Verified PPS B',9);
  if (select count(distinct grade) from private.moodle_evidence_decisions where case_id=v_case)<>2 then raise exception 'Shared grades conflated'; end if;
  if exists(select 1 from public.practicas where id in(v_p1,v_p2) and nota is not null) then raise exception 'Shadow changed academic grade'; end if;
  begin
    perform public.decide_moodle_evidence_v1(v_case,v_version,v_p1,v_revision-1,'allocate','[TEST] Stale decision',8);
    raise exception 'Stale decision accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.decide_moodle_evidence_v1(v_case,v_version,v_p3,v_revision,'allocate','[TEST] Wrong student',8);
    raise exception 'Cross-student allocation accepted';
  exception when insufficient_privilege then null; end;
  v_revision:=public.decide_moodle_evidence_v1(v_case,v_version,v_p1,v_revision,'revoke','[TEST] Reversed after review',null);
  if (select count(*) from private.moodle_evidence_decisions where case_id=v_case)<>3 then raise exception 'Reversal erased history'; end if;
  -- Identical historical content from different original practices retains both lineages.
  perform private.capture_moodle_evidence_v1(v_request,'legacy',v_staff,3615,9999991,99999991,v_student,now(),v_row,gen_random_uuid(),v_p1);
  perform private.capture_moodle_evidence_v1(v_request,'legacy',v_staff,3615,9999991,99999991,v_student,now(),v_row,gen_random_uuid(),v_p2);
  if (select count(*) from private.moodle_evidence_versions where case_id=v_case and legacy_observation_id is not null)<>2 then raise exception 'Backfill lineage lost'; end if;
  v_result:=public.moodle_evidence_inbox_v1(0,30);
  if v_result->>'mode'<>'shadow' or jsonb_array_length(v_result->'cases')=0 then raise exception 'Inbox unavailable'; end if;
  -- A negative row is evidence about this task, never a revocation of a grade.
  update public.practicas set nota='7' where id=v_p2;
  perform private.capture_moodle_evidence_v1(gen_random_uuid(),'jefe',v_staff,3615,9999991,99999991,v_student,now(),
    private.moodle_evidence_content_v1('{"status":"not_submitted","submitted":false,"gradeValue":null,"gradeMax":null,"submittedAt":null}'::jsonb));
  if not exists(select 1 from private.moodle_evidence_versions where case_id=v_case and content->>'status'='not_submitted') then raise exception 'Negative observation lost'; end if;
  if (select nota from public.practicas where id=v_p2) is distinct from '7' then raise exception 'Negative observation changed grade'; end if;
  if has_table_privilege('authenticated','private.moodle_evidence_versions','UPDATE')
    or has_function_privilege('anon','public.moodle_evidence_inbox_v1(integer,integer)','EXECUTE')
    or has_function_privilege('authenticated','private.capture_moodle_evidence_v1(uuid,text,uuid,bigint,bigint,bigint,uuid,timestamptz,jsonb,uuid,uuid)','EXECUTE') then
    raise exception 'Evidence privilege leak';
  end if;
end $$;
rollback;
