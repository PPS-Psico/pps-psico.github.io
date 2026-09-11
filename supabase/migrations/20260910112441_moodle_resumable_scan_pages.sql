begin;

create table private.moodle_scan_pages (
  course_id bigint not null,
  cmid bigint not null,
  scope_key text not null,
  cycle_id uuid not null default gen_random_uuid(),
  next_page integer not null default 0 check(next_page between 0 and 24),
  seen_users bigint[] not null default '{}',
  complete boolean not null default false,
  next_attempt_at timestamptz not null default now(),
  failures integer not null default 0,
  last_error text,
  cycle_started_at timestamptz not null default now(),
  lease_id uuid,
  lease_actor uuid references auth.users(id),
  lease_until timestamptz,
  last_lease uuid,
  last_request uuid,
  last_hash text,
  last_receipt jsonb,
  primary key(course_id,cmid,scope_key)
);
alter table private.moodle_scan_pages enable row level security;
revoke all on private.moodle_scan_pages from public,anon,authenticated;

create function private.moodle_scan_areas_v2(p_preview uuid) returns text[]
language plpgsql stable security definer set search_path='' as $$
declare areas text[];
begin
  if p_preview is null then areas:=private.require_jefe_areas_v1();
  else
    perform private.require_jefe_preview_access_v1();
    select array_agg(distinct area_key order by area_key) into areas from private.jefe_area_assignments where preview_key=p_preview;
  end if;
  if auth.uid() is null or coalesce(cardinality(areas),0)=0 then raise exception 'Jefe scope required' using errcode='42501'; end if;
  return array(select distinct a from unnest(areas) a order by a);
end $$;

create function private.moodle_scan_queue_v2(p_preview uuid,p_history boolean,p_manual boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare areas text[]:=private.moodle_scan_areas_v2(p_preview); scope text; result jsonb;
begin
  scope:=array_to_string(areas,',');
  with allowed as materialized (
    select t.*,ae.academic_year task_year,
      exists(select 1 from private.moodle_evidence_cases ec
        cross join lateral private.moodle_effective_evidence_v1(ec.id) ev
        where ec.cmid=t.cmid and ec.course_id=t.course_id and not ec.identity_conflict
          and ev.content->>'status'='submitted') awaiting_correction
    from private.moodle_evidence_allowed_tasks_v1(areas) t
    join public.aula_entregas ae on ae.course_id=t.course_id and ae.moodle_id=t.cmid::text
  ), eligible as (
    select a.*,coalesce(j.next_page,0) next_page,coalesce(j.failures,0) failures,
      j.next_attempt_at,j.lease_until,
      case when a.awaiting_correction then 0 when a.task_year=a.academic_year then 1 else 2 end priority
    from allowed a left join private.moodle_scan_pages j
      on j.course_id=a.course_id and j.cmid=a.cmid and j.scope_key=scope
    where (j.next_attempt_at is null or j.next_attempt_at<=now() or j.failures>0)
      and case when p_history then a.task_year<a.academic_year and not a.awaiting_correction
        else a.task_year=a.academic_year or a.awaiting_correction end
  ) select jsonb_build_object('pending',count(*),'paused',count(*) filter(where failures>0),
    'tasks',coalesce((select jsonb_agg(to_jsonb(q)) from (
      select * from eligible where (failures=0 or p_manual) and (lease_until is null or lease_until<=now())
      order by priority,(next_page>0) desc,next_attempt_at nulls first,cmid limit 4
    ) q),'[]'::jsonb)) into result from eligible;
  return result;
end $$;

create function private.claim_moodle_scan_page_v2(p_cmid bigint,p_preview uuid,p_manual boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare areas text[]:=private.moodle_scan_areas_v2(p_preview); scope text;
  job private.moodle_scan_pages;
begin
  scope:=array_to_string(areas,',');
  if not exists(select 1 from private.moodle_evidence_allowed_tasks_v1(areas) where cmid=p_cmid and course_id=3615) then
    raise exception 'Task outside assigned scope' using errcode='42501'; end if;
  insert into private.moodle_scan_pages(course_id,cmid,scope_key) values(3615,p_cmid,scope) on conflict do nothing;
  select * into job from private.moodle_scan_pages where course_id=3615 and cmid=p_cmid and scope_key=scope for update;
  if job.lease_until>now() then return jsonb_build_object('status','busy'); end if;
  if job.failures>0 and not p_manual then return jsonb_build_object('status','paused'); end if;
  if job.next_attempt_at>now() and not (p_manual and job.failures>0) then return jsonb_build_object('status','fresh'); end if;
  if job.complete or job.cycle_started_at<now()-interval '2 hours'
    or (p_manual and job.last_error='pagination_changed') then
    job.cycle_id:=gen_random_uuid();job.next_page:=0;job.seen_users:='{}';job.cycle_started_at:=now();
  end if;
  update private.moodle_scan_pages set cycle_id=job.cycle_id,next_page=job.next_page,
    seen_users=job.seen_users,cycle_started_at=job.cycle_started_at,complete=false,
    failures=case when p_manual then 0 else failures end,
    lease_id=gen_random_uuid(),lease_actor=auth.uid(),lease_until=now()+interval '90 seconds'
    where course_id=3615 and cmid=p_cmid and scope_key=scope returning * into job;
  return jsonb_build_object('status','claimed','lease',job.lease_id,'cycle',job.cycle_id,
    'page',job.next_page,'cmid',job.cmid,'rowsSeen',cardinality(job.seen_users));
end $$;

create function private.commit_moodle_scan_page_v2(p_lease uuid,p_payload jsonb,p_preview uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare areas text[]:=private.moodle_scan_areas_v2(p_preview); scope text;
  job private.moodle_scan_pages; task jsonb; rows jsonb; receipt jsonb;
  ids bigint[]; row_count integer; page_no integer; error_code text; finished boolean;
  request uuid; observed timestamptz; digest text:=md5(p_payload::text);
  refresh_after interval := interval '2 hours';
begin
  scope:=array_to_string(areas,',');
  request:=(p_payload->>'requestId')::uuid;
  select * into job from private.moodle_scan_pages where scope_key=scope
    and (lease_id=p_lease or last_lease=p_lease) and lease_actor=auth.uid() for update;
  if not found then raise exception 'Unknown lease' using errcode='42501'; end if;
  if not exists(select 1 from private.moodle_evidence_allowed_tasks_v1(areas)
    where cmid=job.cmid and course_id=job.course_id) then
    raise exception 'Task outside assigned scope' using errcode='42501'; end if;
  if job.last_lease=p_lease and job.last_request=request and job.last_hash=digest then return job.last_receipt; end if;
  if job.lease_id is distinct from p_lease or job.lease_until<now() then raise exception 'Expired lease' using errcode='40001'; end if;
  task:=p_payload->'task';page_no:=(p_payload->>'page')::integer;
  observed:=(p_payload->>'observedAt')::timestamptz;
  if request is null or page_no is distinct from job.next_page or (task->>'cmid')::bigint is distinct from job.cmid
    or (p_payload->>'courseId')::bigint is distinct from job.course_id or observed is null then raise exception 'Invalid page scope'; end if;
  rows:=coalesce(task->'rows','[]')||coalesce(task->'negativeRows','[]');
  row_count:=coalesce((task->>'pageRowCount')::integer,0);
  if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>100 or row_count not between 0 and 100 then
    raise exception 'Invalid page size'; end if;
  error_code:=nullif(task->>'errorCode','');
  if task->>'status' is distinct from 'ok' then error_code:=coalesce(error_code,'page_unavailable'); end if;
  select coalesce(array_agg((r->>'moodleUserId')::bigint),'{}') into ids from jsonb_array_elements(rows) r;
  if cardinality(ids)<>row_count and error_code is null then error_code:='incomplete_page_identity'; end if;
  if cardinality(ids)<>(select count(distinct i) from unnest(ids) i) or ids && job.seen_users then error_code:='pagination_changed'; end if;
  if job.next_page>=23 and row_count=100 then error_code:='page_limit'; end if;

  -- Identity, assigned areas and evidence content remain validated by the original
  -- authenticated capture entry point. No filenames are persisted by the cursor.
  receipt:=private.capture_jefe_moodle_evidence_v1(p_preview,request,job.course_id,
    extract(year from now() at time zone 'America/Argentina/Buenos_Aires')::integer,observed,
    (p_payload->>'moodleUserId')::bigint,p_payload->>'moodleUsername',
    jsonb_build_array(jsonb_build_object('cmid',job.cmid,'status','ok','rows',rows)));
  if coalesce((receipt->>'rejected')::integer,0)>0 then error_code:='invalid_evidence_rows'; end if;
  finished:=error_code is null and row_count<100;
  if finished then
    if exists(select 1 from private.moodle_evidence_cases ec
      cross join lateral private.moodle_effective_evidence_v1(ec.id) ev
      where ec.course_id=job.course_id and ec.cmid=job.cmid and not ec.identity_conflict
        and ev.content->>'status'='submitted') then refresh_after:=interval '30 minutes';
    elsif exists(select 1 from public.aula_entregas a where a.course_id=job.course_id
      and a.moodle_id=job.cmid::text and a.academic_year<extract(year from now())) then
      refresh_after:=interval '7 days';
    end if;
  end if;
  if error_code is null then
    job.next_page:=job.next_page+1;job.seen_users:=job.seen_users||ids;job.failures:=0;
  else job.failures:=job.failures+1; end if;
  receipt:=jsonb_build_object('status',case when error_code is not null then 'paused' when finished then 'complete' else 'progress' end,
    'nextPage',job.next_page,'rowsSeen',cardinality(job.seen_users),'accepted',(receipt->>'accepted')::integer,
    'error',error_code,'observedAt',observed);
  update private.moodle_scan_pages set next_page=job.next_page,seen_users=job.seen_users,complete=finished,
    failures=job.failures,last_error=error_code,
    next_attempt_at=case when error_code is not null then now()+interval '5 minutes'
      when finished then now()+refresh_after else now() end,
    lease_id=null,lease_until=null,last_lease=p_lease,last_request=request,last_hash=digest,last_receipt=receipt
    where course_id=job.course_id and cmid=job.cmid and scope_key=scope;
  update private.moodle_evidence_coverage set rows_seen=cardinality(job.seen_users),
    status=case when error_code is not null then 'parse_error' else 'ok' end,
    failures=job.failures,next_attempt_at=case when finished then now()+refresh_after else now()+interval '5 minutes' end
    where course_id=job.course_id and cmid=job.cmid and scope_key=scope;
  return receipt;
end $$;

create function private.fail_moodle_scan_page_v2(p_lease uuid,p_preview uuid) returns void
language plpgsql security definer set search_path='' as $$
declare areas text[]:=private.moodle_scan_areas_v2(p_preview);
begin
  update private.moodle_scan_pages set failures=failures+1,last_error='transport_failure',
    next_attempt_at=now()+interval '5 minutes',lease_id=null,lease_until=null
    where lease_id=p_lease and lease_actor=auth.uid() and scope_key=array_to_string(areas,',');
end $$;

create function public.moodle_scan_queue_v2(p_preview uuid default null,p_history boolean default false,p_manual boolean default false) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.moodle_scan_queue_v2(p_preview,p_history,p_manual); $$;
create function public.claim_moodle_scan_page_v2(p_cmid bigint,p_preview uuid default null,p_manual boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select private.claim_moodle_scan_page_v2(p_cmid,p_preview,p_manual); $$;
create function public.commit_moodle_scan_page_v2(p_lease uuid,p_payload jsonb,p_preview uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.commit_moodle_scan_page_v2(p_lease,p_payload,p_preview); $$;
create function public.fail_moodle_scan_page_v2(p_lease uuid,p_preview uuid default null) returns void
language sql security invoker set search_path='' as $$ select private.fail_moodle_scan_page_v2(p_lease,p_preview); $$;
revoke all on function private.moodle_scan_areas_v2 from public,anon,authenticated;
revoke all on function private.moodle_scan_queue_v2,private.claim_moodle_scan_page_v2,private.commit_moodle_scan_page_v2,private.fail_moodle_scan_page_v2,
  public.moodle_scan_queue_v2,public.claim_moodle_scan_page_v2,public.commit_moodle_scan_page_v2,public.fail_moodle_scan_page_v2 from public,anon;
grant execute on function private.moodle_scan_queue_v2,private.claim_moodle_scan_page_v2,private.commit_moodle_scan_page_v2,private.fail_moodle_scan_page_v2,
  public.moodle_scan_queue_v2,public.claim_moodle_scan_page_v2,public.commit_moodle_scan_page_v2,public.fail_moodle_scan_page_v2 to authenticated;

commit;
