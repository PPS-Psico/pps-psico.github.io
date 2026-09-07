begin;
do $$
declare staff uuid:=auth.uid(); student uuid:=gen_random_uuid(); student_user uuid:=gen_random_uuid();
  practice uuid:=gen_random_uuid(); c uuid; v uuid; d uuid; rev integer; app uuid;
  baseline jsonb; current_academic jsonb; snapshot jsonb; outcome text;
begin
  insert into auth.users(id) values(student_user);
  insert into public.estudiantes(id,user_id,role,nombre) values(student,student_user,'Alumno','[TEST] Qualitative');
  insert into public.practicas(id,estudiante_id,nombre_institucion,tipo_actividad,especialidad,nota,informe_estado)
    values(practice,student,'[TEST] Historical PPS','pps','Clínica',null,null);
  insert into public.aula_entregas(id,course_id,moodle_id,academic_year,moodle_name)
    values(999994,3615,'999994',2024,'[TEST] 2024');
  c:=private.capture_moodle_evidence_v1(gen_random_uuid(),'jefe',staff,3615,999994,123,student,now(),
    '{"status":"graded","submitted":true,"gradeValue":0,"gradeMax":100,"gradeDisplay":"0/100","feedbackComment":"Informe APROBADO"}');
  select id into v from private.moodle_evidence_versions where case_id=c;
  select revision into rev from private.moodle_evidence_cases where id=c;
  select private.moodle_academic_fields_v1(p) into baseline from public.practicas p where id=practice;
  begin
    perform public.decide_moodle_evidence_v1(c,v,practice,rev,'allocate','[TEST] No numeric equivalence',7);
    raise exception 'Numeric 2024 grade accepted' using errcode='P0002';
  exception when raise_exception then null; end;
  begin
    perform public.decide_moodle_evidence_v2(c,v,practice,rev,'allocate','[TEST] Reject mixed grades',7,'Aprobado');
    raise exception 'Mixed grade accepted' using errcode='P0002';
  exception when raise_exception then null; end;
  update public.aula_entregas set academic_year=2025 where id=999994;
  begin
    perform public.decide_moodle_evidence_v2(c,v,practice,rev,'allocate','[TEST] Reject other year',null,'Aprobado');
    raise exception 'Qualitative outside 2024 accepted' using errcode='P0002';
  exception when raise_exception then null; end;
  update public.aula_entregas set academic_year=2024 where id=999994;
  perform set_config('request.jwt.claim.sub',student_user::text,true);
  begin
    perform public.decide_moodle_evidence_v2(c,v,practice,rev,'allocate','[TEST] Student forbidden',null,'Aprobado');
    raise exception 'Student allocated grade' using errcode='P0002';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',staff::text,true);
  foreach outcome in array array['Aprobado','Desaprobado'] loop
    rev:=public.decide_moodle_evidence_v2(c,v,practice,rev,'allocate','[TEST] Explicit academic review',null,outcome);
    select id into d from private.moodle_evidence_decisions where case_id=c and revision=rev;
    if (select nota from public.practicas where id=practice) is not null then raise exception 'Proposal changed grade'; end if;
    select private.moodle_academic_fields_v1(p) into current_academic from public.practicas p where id=practice;
    app:=public.apply_moodle_evidence_decision_v1(d,current_academic,'apply','[TEST] Apply reviewed outcome',app);
    snapshot:=private.moodle_practice_snapshot_v1(practice);
    if snapshot->>'academicGrade' is distinct from outcome or snapshot->>'grade_display' is distinct from outcome
      or snapshot->>'task_status' is distinct from 'graded' or snapshot->>'grade_value' is not null
      or snapshot->>'grade_max' is not null then raise exception 'Qualitative grade converted or lost'; end if;
    if (select nota_moodle from public.practicas where id=practice) is not null then raise exception 'Invented numeric equivalence'; end if;
    if (select grade from private.jefe_report_rows_v1(array['clinica']) where practica_id=practice) is distinct from outcome then
      raise exception 'Jefe grade lost'; end if;
    insert into public.moodle_grade_observations(id,request_id,observed_at,course_id,cmid,moodle_user_id,
      estudiante_id,practica_id,auth_user_id,task_status,submitted,grade_value,grade_max)
      values(gen_random_uuid(),gen_random_uuid(),now(),3615,999994,123,student,practice,staff,'graded',true,100,100);
    if (select nota from public.practicas where id=practice) is distinct from outcome then raise exception 'Reader overwrote qualitative grade'; end if;
    select private.moodle_academic_fields_v1(p) into current_academic from public.practicas p where id=practice;
    app:=public.apply_moodle_evidence_decision_v1(d,current_academic,'revert','[TEST] Restore exact baseline',app);
    if (select private.moodle_academic_fields_v1(p) from public.practicas p where id=practice) is distinct from baseline then
      raise exception 'Qualitative reversal changed baseline'; end if;
    select revision into rev from private.moodle_evidence_cases where id=c;
    select id into v from private.moodle_evidence_versions where case_id=c order by observed_at desc,received_at desc,id desc limit 1;
  end loop;
  if has_function_privilege('anon','public.decide_moodle_evidence_v2(uuid,uuid,uuid,integer,text,text,numeric,text)','execute') then
    raise exception 'Anonymous decision permission'; end if;
end $$;
rollback;
