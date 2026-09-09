begin;

-- Evidence is independent of attribution. This release is deliberately shadow:
-- no trigger below writes practicas, snapshots, links or academic grades.
create table private.moodle_evidence_cases (
  id uuid primary key default gen_random_uuid(),
  course_id bigint not null check (course_id = 3615),
  cmid bigint not null check (cmid > 0),
  identity_key text not null,
  moodle_user_id bigint check (moodle_user_id > 0),
  estudiante_id uuid references public.estudiantes(id),
  identity_conflict boolean not null default false,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, cmid, identity_key)
);
create index moodle_evidence_cases_student_idx on private.moodle_evidence_cases(estudiante_id);
create index moodle_evidence_cases_queue_idx on private.moodle_evidence_cases(updated_at, id);

create table private.moodle_evidence_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.moodle_evidence_cases(id),
  request_id uuid not null,
  source text not null check (source in ('student', 'jefe', 'legacy')),
  actor_id uuid,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_hash text not null,
  legacy_observation_id uuid unique,
  legacy_practica_id uuid
);
create unique index moodle_evidence_versions_retry_idx
  on private.moodle_evidence_versions(case_id, request_id, content_hash)
  where legacy_observation_id is null;
create index moodle_evidence_versions_latest_idx
  on private.moodle_evidence_versions(case_id, observed_at desc, received_at desc, id);
create index moodle_evidence_versions_actor_received_idx
  on private.moodle_evidence_versions(actor_id, received_at desc) where source='student';

-- Each decision pins the exact evidence version reviewed. New evidence does not
-- silently extend an old decision. Reversal is another immutable decision.
create table private.moodle_evidence_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references private.moodle_evidence_cases(id),
  evidence_id uuid not null references private.moodle_evidence_versions(id),
  practica_id uuid not null references public.practicas(id),
  revision integer not null,
  action text not null check (action in ('allocate', 'revoke')),
  grade numeric check (grade between 0 and 10),
  reason text not null check (length(trim(reason)) between 8 and 2000),
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  unique(case_id, revision),
  check (action = 'allocate' or grade is null)
);
create index moodle_evidence_decisions_practice_idx
  on private.moodle_evidence_decisions(practica_id, created_at desc);
create index moodle_evidence_decisions_evidence_idx on private.moodle_evidence_decisions(evidence_id);

create table private.moodle_evidence_coverage (
  course_id bigint not null check (course_id = 3615),
  cmid bigint not null check (cmid > 0),
  scope_key text not null,
  observed_at timestamptz not null,
  status text not null check (status in ('ok','no_access','parse_error')),
  rows_seen integer not null check (rows_seen >= 0),
  failures integer not null default 0,
  next_attempt_at timestamptz not null,
  primary key (course_id, cmid, scope_key)
);

alter table private.moodle_evidence_cases enable row level security;
alter table private.moodle_evidence_versions enable row level security;
alter table private.moodle_evidence_decisions enable row level security;
alter table private.moodle_evidence_coverage enable row level security;
revoke all on private.moodle_evidence_cases, private.moodle_evidence_versions,
  private.moodle_evidence_decisions, private.moodle_evidence_coverage from public, anon, authenticated;

create function private.capture_moodle_evidence_v1(
  p_request uuid, p_source text, p_actor uuid, p_course bigint, p_cmid bigint,
  p_moodle_user bigint, p_student uuid, p_observed timestamptz, p_content jsonb,
  p_legacy_observation uuid default null, p_legacy_practice uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_case uuid;
  v_id uuid;
  v_content jsonb;
  v_existing_student uuid;
  v_key text := coalesce('moodle:' || p_moodle_user::text, 'legacy:' || p_student::text);
begin
  if p_request is null or p_observed is null or v_key is null
     or p_source not in ('student','jefe','legacy')
     or jsonb_typeof(p_content) is distinct from 'object'
     or coalesce(p_content->>'status','') not in
       ('submitted','graded','not_submitted','no_access','parse_error') then
    raise exception 'Invalid evidence';
  end if;
  -- Explicit allowlist: no raw filenames, HTML, email or documents reach storage.
  select coalesce(jsonb_object_agg(key,value), '{}'::jsonb) into v_content
  from jsonb_each(p_content)
  where key = any(array['status','submitted','gradeValue','gradeMax','gradeDisplay',
    'gradedAtDisplay','feedbackComment','submittedAt','submittedAtDisplay',
    'fileCount','logicalFileCount','fileTypeCounts','classifierVersion',
    'attendanceEvidence','attendanceConfidence','reasons']);
  if octet_length(v_content::text) > 10000 then raise exception 'Evidence too large'; end if;
  insert into private.moodle_evidence_cases(course_id,cmid,identity_key,moodle_user_id,estudiante_id)
  values(p_course,p_cmid,v_key,p_moodle_user,p_student)
  on conflict(course_id,cmid,identity_key) do nothing;
  select id,estudiante_id into v_case,v_existing_student from private.moodle_evidence_cases
  where course_id=p_course and cmid=p_cmid and identity_key=v_key for update;
  if v_existing_student is not null and p_student is not null and v_existing_student <> p_student then
    update private.moodle_evidence_cases set estudiante_id=null,identity_conflict=true where id=v_case;
  end if;
  insert into private.moodle_evidence_versions(case_id,request_id,source,actor_id,observed_at,
    content,content_hash,legacy_observation_id,legacy_practica_id)
  values(v_case,p_request,p_source,p_actor,p_observed,v_content,md5(v_content::text),
    p_legacy_observation,p_legacy_practice)
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    update private.moodle_evidence_cases set updated_at=clock_timestamp(),
      estudiante_id=case when identity_conflict then null else coalesce(estudiante_id,p_student) end,
      revision=revision+1 where id=v_case;
  end if;
  return v_case;
end $$;
revoke all on function private.capture_moodle_evidence_v1 from public,anon,authenticated;

create function private.mirror_moodle_legacy_evidence_v1() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.capture_moodle_evidence_v1(new.request_id,'legacy',new.auth_user_id,
    new.course_id,new.cmid,new.moodle_user_id,new.estudiante_id,new.observed_at,
    jsonb_build_object('status',new.task_status,'submitted',new.submitted,
      'gradeValue',new.grade_value,'gradeMax',new.grade_max,'gradeDisplay',new.grade_display,
      'gradedAtDisplay',new.graded_at_display,'feedbackComment',new.feedback_comment,
      'submittedAt',new.submitted_at,'submittedAtDisplay',new.submitted_at_display,
      'fileCount',new.submission_file_count,'logicalFileCount',new.submission_logical_file_count,
      'fileTypeCounts',new.submission_file_types,'classifierVersion',new.submission_classifier_version,
      'attendanceEvidence',new.attendance_evidence,'attendanceConfidence',new.attendance_confidence,
      'reasons',new.attendance_evidence_reasons),new.id,new.practica_id);
  return new;
end $$;
revoke all on function private.mirror_moodle_legacy_evidence_v1 from public,anon,authenticated;
create trigger mirror_moodle_legacy_evidence after insert on public.moodle_grade_observations
  for each row execute function private.mirror_moodle_legacy_evidence_v1();

-- Preserve every original version and its practice lineage, even conflicting
-- grades from the same request. Missing Moodle IDs remain explicitly legacy.
do $$ declare o public.moodle_grade_observations; begin
for o in select * from public.moodle_grade_observations order by observed_at,received_at,id loop
perform private.capture_moodle_evidence_v1(o.request_id,'legacy',o.auth_user_id,
  o.course_id,o.cmid,o.moodle_user_id,o.estudiante_id,o.observed_at,
  jsonb_build_object('status',o.task_status,'submitted',o.submitted,
    'gradeValue',o.grade_value,'gradeMax',o.grade_max,'gradeDisplay',o.grade_display,
    'gradedAtDisplay',o.graded_at_display,'feedbackComment',o.feedback_comment,
    'submittedAt',o.submitted_at,'submittedAtDisplay',o.submitted_at_display,
    'fileCount',o.submission_file_count,'logicalFileCount',o.submission_logical_file_count,
    'fileTypeCounts',o.submission_file_types,'classifierVersion',o.submission_classifier_version,
    'attendanceEvidence',o.attendance_evidence,'attendanceConfidence',o.attendance_confidence,
    'reasons',o.attendance_evidence_reasons),o.id,o.practica_id);
end loop; end $$;

create function private.moodle_evidence_inbox_v1(p_offset integer default 0, p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not private.moodle_v2_is_coordinator() then raise exception 'Coordinator required' using errcode='42501'; end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid page';
  end if;
  select jsonb_build_object('total',(select count(*) from private.moodle_evidence_cases),
    'mode','shadow','cases',coalesce(jsonb_agg(q.row),'[]'::jsonb)) into v_result
  from (
    select jsonb_build_object('id',c.id,'revision',c.revision,'cmid',c.cmid,
      'studentId',c.estudiante_id,'studentName',s.nombre,'taskName',ae.moodle_name,
      'evidenceId',v.id,'observedAt',v.observed_at,'source',v.source,'content',v.content,
      'versionCount',(select count(*) from private.moodle_evidence_versions x where x.case_id=c.id),
      'history',coalesce((select jsonb_agg(to_jsonb(x)) from (
        select id,observed_at,source,content,legacy_practica_id from private.moodle_evidence_versions
        where case_id=c.id order by observed_at desc,received_at desc,id desc limit 20
      ) x),'[]'::jsonb),
      'decisions',coalesce((select jsonb_agg(to_jsonb(d) order by d.revision desc)
        from private.moodle_evidence_decisions d where d.case_id=c.id),'[]'::jsonb),
      'practices',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,
        'name',p.nombre_institucion,'area',p.especialidad,'grade',p.nota,
        'start',p.fecha_inicio,'state',p.estado,'exactLink',
        exists(select 1 from public.practica_moodle_tareas l where l.practica_id=p.id
          and l.aula_entrega_id=ae.id and l.validation_status='confirmed')
        or (not exists(select 1 from public.practica_moodle_tareas l where l.practica_id=p.id and l.validation_status='confirmed')
          and exists(select 1 from public.lanzamiento_moodle_tareas l where l.lanzamiento_id=p.lanzamiento_id
            and l.aula_entrega_id=ae.id and l.validation_status='confirmed'
            and private.jefe_text_has_area(coalesce(p.especialidad,''),l.orientacion_key))))
        order by p.fecha_inicio desc nulls last,p.id)
        from public.practicas p where p.estudiante_id=c.estudiante_id),'[]'::jsonb)) as row
    from private.moodle_evidence_cases c
    left join public.estudiantes s on s.id=c.estudiante_id
    left join public.aula_entregas ae on ae.course_id=c.course_id and ae.moodle_id=c.cmid::text
    join lateral(select * from private.moodle_evidence_versions v where v.case_id=c.id
      order by v.observed_at desc,v.received_at desc,v.id desc limit 1) v on true
    order by c.updated_at desc,c.id offset p_offset limit p_limit
  ) q;
  return v_result;
end $$;
create function public.moodle_evidence_inbox_v1(p_offset integer default 0, p_limit integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.moodle_evidence_inbox_v1(p_offset,p_limit);
$$;

create function private.decide_moodle_evidence_v1(p_case uuid,p_evidence uuid,p_practice uuid,
  p_revision integer,p_action text,p_reason text,p_grade numeric default null)
returns integer language plpgsql security definer set search_path='' as $$
declare v_case private.moodle_evidence_cases; v_revision integer;
begin
  if not private.moodle_v2_is_coordinator() or auth.uid() is null then
    raise exception 'Coordinator required' using errcode='42501';
  end if;
  select * into v_case from private.moodle_evidence_cases where id=p_case for update;
  if not found or v_case.revision is distinct from p_revision then
    raise exception 'Evidence changed; reload before deciding' using errcode='40001';
  end if;
  if not exists(select 1 from private.moodle_evidence_versions where id=p_evidence and case_id=p_case)
    or not exists(select 1 from public.practicas where id=p_practice and estudiante_id=v_case.estudiante_id) then
    raise exception 'Evidence and practice must belong to the same student' using errcode='42501';
  end if;
  v_revision := v_case.revision+1;
  insert into private.moodle_evidence_decisions(case_id,evidence_id,practica_id,revision,action,grade,reason,actor_id)
  values(p_case,p_evidence,p_practice,v_revision,p_action,p_grade,trim(p_reason),auth.uid());
  update private.moodle_evidence_cases set revision=v_revision,updated_at=clock_timestamp() where id=p_case;
  return v_revision;
end $$;
create function public.decide_moodle_evidence_v1(p_case uuid,p_evidence uuid,p_practice uuid,
  p_revision integer,p_action text,p_reason text,p_grade numeric default null)
returns integer language sql security invoker set search_path='' as $$
  select private.decide_moodle_evidence_v1(p_case,p_evidence,p_practice,p_revision,p_action,p_reason,p_grade);
$$;

revoke all on function private.moodle_evidence_inbox_v1,public.moodle_evidence_inbox_v1,
  private.decide_moodle_evidence_v1,public.decide_moodle_evidence_v1 from public,anon;
grant execute on function private.moodle_evidence_inbox_v1,public.moodle_evidence_inbox_v1,
  private.decide_moodle_evidence_v1,public.decide_moodle_evidence_v1 to authenticated;

-- Validate and normalize browser content at the trust boundary. Identity and
-- authorization are handled by the two entry points below, never by this input.
create function private.moodle_evidence_content_v1(p_row jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_files text[]; v_grade numeric; v_max numeric; v_content jsonb;
begin
  if jsonb_typeof(p_row) is distinct from 'object'
    or coalesce(p_row->>'status','') not in ('submitted','graded','not_submitted','no_access','parse_error')
    or jsonb_typeof(p_row->'submitted') is distinct from 'boolean'
    or length(coalesce(p_row->>'feedbackComment','')) > 2000
    or length(coalesce(p_row->>'gradeDisplay','')) > 160
    or length(coalesce(p_row->>'gradedAtDisplay','')) > 200
    or length(coalesce(p_row->>'submittedAtDisplay','')) > 200 then
    raise exception 'Invalid evidence content';
  end if;
  v_grade := (p_row->>'gradeValue')::numeric;
  v_max := (p_row->>'gradeMax')::numeric;
  if (p_row->>'status'='graded' and (v_grade is null or v_max is null))
    or v_grade < 0 or v_max <= 0 or v_grade > v_max
    or v_grade::text in ('NaN','Infinity','-Infinity')
    or v_max::text in ('NaN','Infinity','-Infinity')
    or (p_row->>'submitted')::boolean is distinct from (p_row->>'status' in ('submitted','graded')) then
    raise exception 'Invalid evidence grade or submission';
  end if;
  if p_row->>'submittedAt' is not null then
    if not (p_row->>'submitted')::boolean or (p_row->>'submittedAt')::timestamptz is null then
      raise exception 'Invalid submission date';
    end if;
  end if;
  if p_row->'submissionFiles' is not null and p_row->'submissionFiles' <> 'null'::jsonb then
    if jsonb_typeof(p_row->'submissionFiles') <> 'array' or jsonb_array_length(p_row->'submissionFiles') > 20 then
      raise exception 'Invalid file list';
    end if;
    if exists(select 1 from jsonb_array_elements(p_row->'submissionFiles') f
      where jsonb_typeof(f) <> 'string' or length(f#>>'{}') not between 1 and 180) then
      raise exception 'Invalid filename';
    end if;
    select coalesce(array_agg(f),'{}'::text[]) into v_files from jsonb_array_elements_text(p_row->'submissionFiles') f;
    if cardinality(v_files)>0 and not (p_row->>'submitted')::boolean then raise exception 'Unexpected files'; end if;
  end if;
  select jsonb_object_agg(key,value) into v_content from jsonb_each(p_row)
    where key=any(array['status','submitted','gradeValue','gradeMax','gradeDisplay',
      'gradedAtDisplay','feedbackComment','submittedAt','submittedAtDisplay']);
  -- Attendance is practice-specific, so raw observation never certifies it.
  return v_content || private.classify_moodle_submission_files_v1(v_files,false)
    || jsonb_build_object('attendanceEvidence','needs_review','attendanceConfidence',0,
      'reasons',jsonb_build_array('practice_allocation_required'));
end $$;
revoke all on function private.moodle_evidence_content_v1 from public,anon,authenticated;

create function private.ingest_student_moodle_evidence_v1(p_request uuid,p_course bigint,
  p_observed timestamptz,p_moodle_user bigint,p_username text,p_tasks jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_student uuid; v_row jsonb; v_accepted integer:=0; v_rejected integer:=0; v_content jsonb;
begin
  select id into v_student from public.estudiantes where user_id=auth.uid()
    and coalesce(role,'Alumno')='Alumno' and regexp_replace(dni::text,'\D','','g')=p_username;
  if v_student is null then raise exception 'Student identity mismatch' using errcode='42501'; end if;
  if p_request is null or p_course is distinct from 3615 or p_moodle_user is null or p_moodle_user<=0
    or p_username !~ '^\d{6,12}$' or p_observed is null or p_observed < now()-interval '15 minutes'
    or p_observed>now()+interval '5 minutes' or jsonb_typeof(p_tasks) is distinct from 'array'
    or jsonb_array_length(p_tasks) not between 1 and 20 then raise exception 'Invalid student evidence'; end if;
  perform pg_advisory_xact_lock(hashtextextended('moodle-evidence:'||auth.uid()::text,0));
  if (select count(*) from private.moodle_evidence_versions where actor_id=auth.uid()
      and received_at>now()-interval '1 minute' and source='student') + jsonb_array_length(p_tasks)>180 then
    raise exception 'Evidence rate limit exceeded';
  end if;
  for v_row in select * from jsonb_array_elements(p_tasks) loop
    begin
      if coalesce(v_row->>'cmid','') !~ '^[1-9]\d*$' then raise exception 'Invalid cmid'; end if;
      v_content := private.moodle_evidence_content_v1(v_row);
      if (v_content->>'submittedAt')::timestamptz>p_observed+interval '5 minutes' then raise exception 'Future submission'; end if;
      perform private.capture_moodle_evidence_v1(p_request,'student',auth.uid(),p_course,
        (v_row->>'cmid')::bigint,p_moodle_user,v_student,p_observed,v_content);
      v_accepted:=v_accepted+1;
    exception when data_exception or check_violation or raise_exception then
      v_rejected:=v_rejected+1;
    end;
  end loop;
  return jsonb_build_object('accepted',v_accepted,'rejected',v_rejected);
end $$;
create function public.ingest_student_moodle_evidence_v1(p_request uuid,p_course bigint,
  p_observed timestamptz,p_moodle_user bigint,p_username text,p_tasks jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.ingest_student_moodle_evidence_v1(p_request,p_course,p_observed,p_moodle_user,p_username,p_tasks);
$$;
revoke all on function private.ingest_student_moodle_evidence_v1,public.ingest_student_moodle_evidence_v1 from public,anon;
grant execute on function private.ingest_student_moodle_evidence_v1,public.ingest_student_moodle_evidence_v1 to authenticated;

CREATE OR REPLACE FUNCTION private.capture_jefe_moodle_evidence_v1(p_preview_key uuid, p_request_id uuid, p_course_id bigint, p_academic_year integer, p_observed_at timestamp with time zone, p_actor_moodle_user_id bigint, p_actor_moodle_username text, p_tasks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_task jsonb;
  v_row jsonb;
  v_student uuid;
  v_content jsonb;
  v_auth_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_jefe_dni bigint;
  v_expected_moodle_user_id bigint;
  v_areas text[];
  v_current_year integer := extract(
    year from (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )::integer;
  v_task_count integer;
  v_row_count integer;
  v_accepted integer := 0;
  v_stored integer := 0;
  v_snapshot_updated integer := 0;
  v_ambiguous integer := 0;
  v_unmatched integer := 0;
  v_invalid integer := 0;
  v_result jsonb;
  v_existing_auth_user_id uuid;
  v_existing_details jsonb;
  v_unmatched_external integer := 0;
  v_unmatched_reasons jsonb := '{}'::jsonb;
  v_deduplicated integer := 0;
  v_scope text;
  v_preview_dni_count integer;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_preview_key is null then
    v_scope := 'jefe_area_year';
    v_areas := private.require_jefe_areas_v1();

    select e.id, e.dni::bigint, identity.moodle_user_id
    into v_profile_id, v_jefe_dni, v_expected_moodle_user_id
    from public.estudiantes e
    join private.jefe_moodle_identities identity on identity.dni = e.dni::bigint
    where e.user_id = v_auth_user_id
      and e.role = 'Jefe'
    order by e.created_at desc nulls last
    limit 1;

    if v_profile_id is null or v_expected_moodle_user_id is null then
      raise exception 'Jefe Moodle identity not configured' using errcode = '42501';
    end if;

    if p_actor_moodle_user_id is distinct from v_expected_moodle_user_id
       or regexp_replace(coalesce(p_actor_moodle_username, ''), '\D', '', 'g')
          is distinct from v_jefe_dni::text then
      raise exception 'Moodle identity mismatch' using errcode = '42501';
    end if;
  else
    v_scope := 'jefe_area_year_preview';
    perform private.require_jefe_preview_access_v1();

    select e.id
    into v_profile_id
    from public.estudiantes e
    where e.user_id = v_auth_user_id
      and e.role in ('SuperUser', 'AdminTester')
    order by e.created_at desc nulls last
    limit 1;

    select
      count(distinct a.dni)::integer,
      array_agg(distinct a.area_key order by a.area_key)
    into v_preview_dni_count, v_areas
    from private.jefe_area_assignments a
    where a.preview_key = p_preview_key;

    if v_profile_id is null
       or v_preview_dni_count <> 1
       or coalesce(cardinality(v_areas), 0) = 0 then
      raise exception 'Unknown jefe preview identity' using errcode = '22023';
    end if;

    -- En la simulacion el actor Moodle es el administrador que esta leyendo
    -- Campus, no la jefatura previsualizada. El permiso y el alcance se
    -- resuelven por auth.uid() + preview_key; estos datos se conservan para
    -- auditoria, pero nunca amplian las areas autorizadas.
    if coalesce(p_actor_moodle_user_id, 0) <= 0
       or regexp_replace(coalesce(p_actor_moodle_username, ''), '\D', '', 'g')
          !~ '^\d{1,12}$' then
      raise exception 'Invalid Moodle preview actor' using errcode = '42501';
    end if;
  end if;

  if p_course_id <> 3615 then
    raise exception 'Invalid Moodle course';
  end if;
  if p_academic_year <> v_current_year then
    raise exception 'Only the current academic year can be synchronized';
  end if;
  if p_observed_at < now() - interval '15 minutes'
     or p_observed_at > now() + interval '5 minutes' then
    raise exception 'Stale Moodle observation';
  end if;
  if jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Invalid Moodle task payload';
  end if;

  v_task_count := jsonb_array_length(p_tasks);
  if v_task_count < 1 or v_task_count > 20 then
    raise exception 'Invalid Moodle task count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_tasks) task
    where jsonb_typeof(task) <> 'object'
       or coalesce(task ->> 'cmid', '') !~ '^\d+$'
       or jsonb_typeof(task -> 'rows') <> 'array'
  ) then
    raise exception 'Invalid Moodle task payload';
  end if;

  -- El navegador no puede ampliar el alcance: todos los cmid deben estar en el
  -- catalogo confirmado del anio y de las orientaciones del jefe autenticado.
  if exists (
    select 1
    from jsonb_array_elements(p_tasks) task
    left join private.get_jefe_moodle_sync_tasks_for_areas_v1(v_areas) allowed
      on allowed.cmid = (task ->> 'cmid')::bigint
     and allowed.course_id = p_course_id
     and allowed.academic_year = p_academic_year
    where allowed.cmid is null
  ) then
    raise exception 'Moodle task outside assigned areas' using errcode = '42501';
  end if;

  select coalesce(sum(jsonb_array_length(task -> 'rows')), 0)::integer
  into v_row_count
  from jsonb_array_elements(p_tasks) task;

  if v_row_count > 1000 then
    raise exception 'Too many Moodle submission rows';
  end if;


  if p_request_id is null or p_course_id is null or p_academic_year is null or p_observed_at is null
     or p_tasks is null then raise exception 'Missing evidence scope'; end if;
  for v_task in select * from jsonb_array_elements(p_tasks) loop
    if coalesce(v_task->>'status','') not in ('ok','no_access','parse_error')
      or jsonb_array_length(v_task->'rows')>500
      or (v_task->>'status'<>'ok' and jsonb_array_length(v_task->'rows')>0) then
      raise exception 'Invalid task coverage';
    end if;
    for v_row in select * from jsonb_array_elements(v_task->'rows') loop
      begin
        if coalesce(v_row->>'moodleUserId','') !~ '^[1-9]\d*$'
          or coalesce(v_row->>'moodleUsername','') !~ '^\d{6,12}$' then
          raise exception 'Invalid Moodle row identity';
        end if;
        v_student := null;
        -- Duplicate DNI is an identity conflict, never LIMIT 1.
        select case when count(*)=1 then (array_agg(id))[1] end into v_student
          from public.estudiantes where regexp_replace(dni::text,'\D','','g')=v_row->>'moodleUsername';
        v_content := private.moodle_evidence_content_v1(v_row);
        if (v_content->>'submittedAt')::timestamptz>p_observed_at+interval '5 minutes' then
          raise exception 'Future submission';
        end if;
        perform private.capture_moodle_evidence_v1(p_request_id,'jefe',v_auth_user_id,p_course_id,
          (v_task->>'cmid')::bigint,(v_row->>'moodleUserId')::bigint,v_student,p_observed_at,v_content);
        v_accepted := v_accepted+1;
      exception when data_exception or check_violation or raise_exception then
        v_invalid := v_invalid+1;
      end;
    end loop;
    insert into private.moodle_evidence_coverage(course_id,cmid,scope_key,observed_at,status,rows_seen,failures,next_attempt_at)
    values(p_course_id,(v_task->>'cmid')::bigint,array_to_string(v_areas,','),p_observed_at,
      v_task->>'status',jsonb_array_length(v_task->'rows'),
      case when v_task->>'status'='ok' then 0 else 1 end,
      now()+case when v_task->>'status'='ok' then interval '1 day' else interval '5 minutes' end)
    on conflict(course_id,cmid,scope_key) do update set
      observed_at=excluded.observed_at,status=excluded.status,rows_seen=excluded.rows_seen,
      failures=case when excluded.status='ok' then 0 else moodle_evidence_coverage.failures+1 end,
      next_attempt_at=now()+case when excluded.status='ok' then interval '1 day'
        else interval '5 minutes'*least(12,moodle_evidence_coverage.failures+1) end
    where moodle_evidence_coverage.observed_at<excluded.observed_at;
  end loop;
  return jsonb_build_object('accepted',v_accepted,'rejected',v_invalid);
end;
$function$;
create function public.capture_jefe_moodle_evidence_v1(p_request_id uuid,
  p_course_id bigint,p_academic_year integer,p_observed_at timestamptz,
  p_actor_moodle_user_id bigint,p_actor_moodle_username text,p_tasks jsonb,p_preview_key uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.capture_jefe_moodle_evidence_v1(p_preview_key,p_request_id,p_course_id,
    p_academic_year,p_observed_at,p_actor_moodle_user_id,p_actor_moodle_username,p_tasks);
$$;
revoke all on function private.capture_jefe_moodle_evidence_v1,public.capture_jefe_moodle_evidence_v1 from public,anon;
grant execute on function private.capture_jefe_moodle_evidence_v1,public.capture_jefe_moodle_evidence_v1 to authenticated;

commit;
