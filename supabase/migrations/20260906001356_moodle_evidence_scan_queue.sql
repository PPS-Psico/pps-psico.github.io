begin;
-- Stable authorization catalog is separate from the changing work queue.
-- Reading a task must not revoke its authorization before its rows are saved.
create function private.moodle_evidence_allowed_tasks_v1(p_areas text[])
returns table(academic_year integer,course_id bigint,cmid bigint,task_name text,area_keys text[])
language sql stable security definer set search_path='' as $$
  with tasks as (
    select x.course_id,x.cmid,x.task_name,unnest(x.area_keys) as area
    from private.get_jefe_moodle_sync_tasks_for_areas_v1(p_areas) x
    union all
    select a.course_id,a.moodle_id::bigint,coalesce(a.moodle_name,a.institucion),private.jefe_orientation_key(a.area)
    from public.aula_entregas a
    where a.course_id=3615 and a.moodle_id ~ '^[0-9]+$'
      and a.academic_year between 2024 and extract(year from now() at time zone 'America/Argentina/Buenos_Aires')::integer
      and private.jefe_orientation_key(a.area)=any(p_areas)
  )
  select extract(year from now() at time zone 'America/Argentina/Buenos_Aires')::integer,
    t.course_id,t.cmid,min(t.task_name),array_agg(distinct t.area order by t.area)
  from tasks t group by t.course_id,t.cmid;
$$;
revoke all on function private.moodle_evidence_allowed_tasks_v1 from public,anon,authenticated;

create function private.moodle_evidence_scan_queue_v1(p_preview_key uuid default null)
returns table(academic_year integer,course_id bigint,cmid bigint,task_name text,area_keys text[])
language plpgsql stable security definer set search_path='' as $$
declare v_areas text[]; v_scope text;
begin
  if p_preview_key is null then v_areas:=private.require_jefe_areas_v1();
  else
    perform private.require_jefe_preview_access_v1();
    select array_agg(distinct area_key order by area_key) into v_areas
      from private.jefe_area_assignments where preview_key=p_preview_key;
    if coalesce(cardinality(v_areas),0)=0 then raise exception 'Unknown preview scope' using errcode='42501'; end if;
  end if;
  select array_agg(a order by a) into v_areas from unnest(v_areas) a;
  v_scope:=array_to_string(v_areas,',');
  return query select t.* from private.moodle_evidence_allowed_tasks_v1(v_areas) t
    left join private.moodle_evidence_coverage c on c.course_id=t.course_id and c.cmid=t.cmid and c.scope_key=v_scope
    where c.next_attempt_at is null or c.next_attempt_at<=now()
    order by c.observed_at nulls first,t.cmid
    limit 40;
end $$;
create function public.moodle_evidence_scan_queue_v1(p_preview_key uuid default null)
returns table(academic_year integer,course_id bigint,cmid bigint,task_name text,area_keys text[])
language sql stable security invoker set search_path='' as $$
  select * from private.moodle_evidence_scan_queue_v1(p_preview_key);
$$;
revoke all on function private.moodle_evidence_scan_queue_v1,public.moodle_evidence_scan_queue_v1 from public,anon;
grant execute on function private.moodle_evidence_scan_queue_v1,public.moodle_evidence_scan_queue_v1 to authenticated;

do $patch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('private.capture_jefe_moodle_evidence_v1(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure) into v_def;
  v_new:=replace(v_def,'private.get_jefe_moodle_sync_tasks_for_areas_v1(v_areas) allowed',
    'private.moodle_evidence_allowed_tasks_v1(v_areas) allowed');
  if v_new=v_def then raise exception 'Capture scope anchor missing'; end if;
  v_new:=replace(v_new,'  for v_task in select * from jsonb_array_elements(p_tasks) loop',
    '  select array_agg(a order by a) into v_areas from unnest(v_areas) a;'||chr(10)||
    '  for v_task in select * from jsonb_array_elements(p_tasks) loop');
  execute v_new;
end $patch$;
commit;
