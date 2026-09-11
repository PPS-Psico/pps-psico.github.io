-- Run after the migration in the SAME transaction, then ROLLBACK.
-- Uses synthetic rows that cannot update a known student's grade.
do $$
declare
  actor uuid; preview uuid; q jsonb; c jsonb; result jsonb; payload jsonb; page_rows jsonb;
  task_id bigint; token uuid;
begin
  select user_id into actor from public.estudiantes where role='SuperUser' and user_id is not null limit 1;
  select preview_key into preview from private.jefe_area_assignments where area_key='clinica' limit 1;
  if actor is null or preview is null then raise exception 'Fixture requires admin and clinical preview'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  q:=public.moodle_scan_queue_v2(preview,false,false);
  if jsonb_array_length(q->'tasks')=0 then raise exception 'Fixture requires current task'; end if;
  task_id:=(q->'tasks'->0->>'cmid')::bigint;
  c:=public.claim_moodle_scan_page_v2(task_id,preview,false);
  if c->>'status'<>'claimed' or c->>'page'<>'0' then raise exception 'Expected initial claim'; end if;
  token:=(c->>'lease')::uuid;
  if public.claim_moodle_scan_page_v2(task_id,preview,false)->>'status'<>'busy' then raise exception 'Concurrent claim not blocked'; end if;
  select jsonb_agg(jsonb_build_object('moodleUserId',900000000+i,'moodleUsername',(990000000+i)::text,
    'email',null,'status','not_submitted','submitted',false,'gradeValue',null,'gradeMax',null,
    'gradeDisplay',null,'gradedAtDisplay',null,'submittedAt',null,'submittedAtDisplay',null)) into page_rows
    from generate_series(1,100) i;
  payload:=jsonb_build_object('requestId',gen_random_uuid(),'courseId',3615,'page',0,'observedAt',clock_timestamp(),
    'moodleUserId',4227,'moodleUsername','12345678',
    'task',jsonb_build_object('cmid',task_id,'status','ok','errorCode',null,'pageRowCount',100,'rows','[]'::jsonb,'negativeRows',page_rows));
  result:=public.commit_moodle_scan_page_v2(token,payload,preview);
  if result->>'status'<>'progress' or result->>'nextPage'<>'1' then raise exception 'Checkpoint failed: %',result; end if;
  if public.commit_moodle_scan_page_v2(token,payload,preview)<>result then raise exception 'Receipt not idempotent'; end if;
  c:=public.claim_moodle_scan_page_v2(task_id,preview,false);
  if c->>'page'<>'1' then raise exception 'Did not resume page 1'; end if;
  token:=(c->>'lease')::uuid;
  payload:=jsonb_set(jsonb_set(payload,'{page}','1'),'{requestId}',to_jsonb(gen_random_uuid()));
  result:=public.commit_moodle_scan_page_v2(token,payload,preview);
  if result->>'error'<>'pagination_changed' or result->>'nextPage'<>'1' then raise exception 'Repeated page advanced'; end if;
  c:=public.claim_moodle_scan_page_v2(task_id,preview,true);
  if c->>'page'<>'0' then raise exception 'Explicit retry must restart unstable pagination'; end if;
  token:=(c->>'lease')::uuid;
  perform public.fail_moodle_scan_page_v2(token,preview);
  c:=public.claim_moodle_scan_page_v2(task_id,preview,true);
  token:=(c->>'lease')::uuid;
  payload:=jsonb_set(jsonb_set(payload,'{page}','0'),'{requestId}',to_jsonb(gen_random_uuid()));
  payload:=jsonb_set(payload,'{task,negativeRows}','[]');
  payload:=jsonb_set(payload,'{task,pageRowCount}','0');
  result:=public.commit_moodle_scan_page_v2(token,payload,preview);
  if result->>'status'<>'complete' then raise exception 'Final page did not complete'; end if;
  if public.claim_moodle_scan_page_v2(task_id,preview,false)->>'status'<>'fresh' then raise exception 'Completed task scanned again'; end if;
  begin
    perform public.claim_moodle_scan_page_v2(1,preview,false);
    raise exception 'Scope check missing';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.moodle_scan_queue_v2(preview,false,false);
    raise exception 'Anonymous access allowed';
  exception when insufficient_privilege then null; end;
end $$;
