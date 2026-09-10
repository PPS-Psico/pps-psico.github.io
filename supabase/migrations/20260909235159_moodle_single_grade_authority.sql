begin;

-- One read-only attribution plan shared by live sync, scale changes and historical review.
create function private.plan_moodle_case_v1(p_case uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c private.moodle_evidence_cases; v private.moodle_evidence_versions;
  p public.practicas; ae public.aula_entregas; projection private.moodle_evidence_projection;
  previous private.moodle_evidence_applications; decision private.moodle_evidence_decisions;
  candidate_ids uuid[]; planned jsonb:='[]'; item jsonb; result jsonb:='[]';
  candidate_grade numeric; labels integer; report_mentions integer; matches integer; sharing integer;
  before_value jsonb; target jsonb; baseline jsonb; did uuid; aid uuid; why text;
begin
  select * into c from private.moodle_evidence_cases where id=p_case;
  if c.estudiante_id is null or c.identity_conflict or c.course_id<>3615 then
    return jsonb_build_object('reason','identity_requires_review'); end if;
  select * into v from private.moodle_effective_evidence_v1(c.id);
  if v.id is null or v.content->>'status'<>'graded' then
    return jsonb_build_object('reason','no_complete_correction'); end if;
  -- Use original, identity-checked captures, never a legacy grade copied between PPS.
  if v.source not in ('student','jefe') or v.actor_id is null then
    return jsonb_build_object('reason','original_capture_required'); end if;
  select * into ae from public.aula_entregas where course_id=c.course_id
    and moodle_id=c.cmid::text;
  if ae.id is null or ae.academic_year is null or ae.academic_year<=2024 then
    return jsonb_build_object('reason','catalogue_or_qualitative_review'); end if;
  select array_agg(id order by id) into candidate_ids from public.practicas
    where estudiante_id=c.estudiante_id and private.moodle_exact_practice_task_v1(id)=c.cmid;
  if coalesce(cardinality(candidate_ids),0)=0 then return jsonb_build_object('reason','exact_link_required'); end if;
  select count(*) into labels from private.moodle_report_grades_v1(v.content->>'feedbackComment');
  select count(*) into report_mentions from regexp_matches(coalesce(v.content->>'feedbackComment',''),
    'informe[[:space:]]+[^:;\n]{3,100}:','gi');
  if report_mentions<>labels then return jsonb_build_object('reason','unsupported_report_correction'); end if;
  select count(distinct lanzamiento_id) into sharing from public.lanzamiento_moodle_tareas
    where aula_entrega_id=ae.id and validation_status='confirmed';
  foreach did in array candidate_ids loop
    select * into p from public.practicas where id=did;
    candidate_grade:=null;
    if labels>0 then
      select count(*),min(g.grade) into matches,candidate_grade
      from private.moodle_report_grades_v1(v.content->>'feedbackComment') g
      join public.lanzamientos_pps l on l.id=p.lanzamiento_id
      where cardinality(private.moodle_report_words_v1(g.label))>0
        and private.moodle_report_words_v1(g.label) <@ private.moodle_report_words_v1(l.nombre_pps)
        and (select count(*) from public.practicas other
          join public.lanzamientos_pps ol on ol.id=other.lanzamiento_id
          where other.id=any(candidate_ids)
          and private.moodle_report_words_v1(g.label) <@ private.moodle_report_words_v1(ol.nombre_pps))=1;
      if matches<>1 then return jsonb_build_object('reason','report_allocation_ambiguous'); end if;
    elsif cardinality(candidate_ids)=1 and sharing<=1 then
      if coalesce(v.content->>'gradeValue','') !~ '^[0-9]+([.][0-9]+)?$'
        or coalesce(v.content->>'gradeMax','') !~ '^[0-9]+([.][0-9]+)?$' then
        return jsonb_build_object('reason','invalid_grade'); end if;
      candidate_grade:=case ae.grade_conversion_mode
        when 'direct_10' then (v.content->>'gradeValue')::numeric
        when 'percentage' then round((v.content->>'gradeValue')::numeric*10/
          nullif((v.content->>'gradeMax')::numeric,0),2) end;
    else return jsonb_build_object('reason','report_allocation_required'); end if;
    if candidate_grade is null or candidate_grade not between 4 and 10 then
      return jsonb_build_object('reason','invalid_grade'); end if;
    planned:=planned||jsonb_build_array(jsonb_build_object('practice',p.id,'grade',candidate_grade));
  end loop;
  -- Plan the whole shared task first; never apply a partial inferred allocation.
  for item in select * from jsonb_array_elements(planned) loop
    select * into p from public.practicas where id=(item->>'practice')::uuid;
    select * into projection from private.moodle_evidence_projection where practica_id=p.id;
    select * into previous from private.moodle_evidence_applications where id=projection.application_id;
    select * into decision from private.moodle_evidence_decisions where id=projection.decision_id;
    before_value:=private.moodle_academic_fields_v1(p);
    if exists(select 1 from private.moodle_evidence_decisions where practica_id=p.id and origin='manual')
      or (projection.practica_id is not null and (not projection.active or decision.origin<>'automatic/v1'
        or before_value is distinct from previous.applied_academic))
      or (projection.practica_id is null and (not private.moodle_grade_is_pending_v1(p.nota)
        and coalesce(p.nota_fuente,'')<>'moodle_session_observed')) then
      result:=result||jsonb_build_array(jsonb_build_object('practice',p.id,'status','manual_record_preserved','before',before_value,'application',projection.application_id));
      continue;
    end if;
    candidate_grade:=(item->>'grade')::numeric;
    if projection.active and decision.grade=candidate_grade and
      private.moodle_evidence_meaning_v1(v.content)=
      (select private.moodle_evidence_meaning_v1(content) from private.moodle_evidence_versions where id=decision.evidence_id) then
      result:=result||jsonb_build_array(jsonb_build_object('practice',p.id,'status','unchanged','grade',candidate_grade,'before',before_value,'application',projection.application_id));
      continue;
    end if;
    why:=case when labels>0 then 'automatic/v1: explicit report label matched to confirmed launch'
      else 'automatic/v1: unique confirmed practice and catalogue scale' end;
    result:=result||jsonb_build_array(jsonb_build_object('practice',p.id,'status','ready',
      'grade',candidate_grade,'reason',why,'before',before_value,'application',projection.application_id));
  end loop;
  return jsonb_build_object('evidence',v.id,'caseRevision',c.revision,'scale',ae.grade_conversion_mode,'results',result);
end $$;

create or replace function private.reconcile_moodle_case_v1(p_case uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.moodle_evidence_cases; v private.moodle_evidence_versions;
  p public.practicas; projection private.moodle_evidence_projection;
  plan jsonb; item jsonb; result jsonb:='[]';
  candidate_grade numeric; before_value jsonb; target jsonb; baseline jsonb;
  did uuid; aid uuid; why text;
begin
  select * into c from private.moodle_evidence_cases where id=p_case;
  perform 1 from public.practicas where estudiante_id=c.estudiante_id order by id for update;
  select * into c from private.moodle_evidence_cases where id=p_case for update;
  plan:=private.plan_moodle_case_v1(p_case);
  if plan ? 'reason' then return plan; end if;
  select * into v from private.moodle_evidence_versions where id=(plan->>'evidence')::uuid;
  for item in select * from jsonb_array_elements(plan->'results') loop
    if item->>'status'<>'ready' then
      result:=result||jsonb_build_array(item-'before'-'application'); continue;
    end if;
    select * into p from public.practicas where id=(item->>'practice')::uuid;
    select * into projection from private.moodle_evidence_projection where practica_id=p.id;
    before_value:=private.moodle_academic_fields_v1(p);
    candidate_grade:=(item->>'grade')::numeric;
    why:=item->>'reason';
    update private.moodle_evidence_cases set revision=revision+1 where id=c.id returning revision into c.revision;
    insert into private.moodle_evidence_decisions(case_id,evidence_id,practica_id,revision,action,grade,reason,actor_id,origin)
      values(c.id,v.id,p.id,c.revision,'allocate',candidate_grade,why,v.actor_id,'automatic/v1') returning id into did;
    target:=before_value||jsonb_build_object('nota',trim_scale(candidate_grade)::text,
      'informe_estado','calificado','nota_moodle',candidate_grade,'nota_fuente','moodle_session_observed',
      'nota_actualizada_at',now(),'nota_moodle_cmid',c.cmid);
    baseline:=case when projection.active then projection.baseline_academic else before_value end;
    update public.practicas set nota=target->>'nota',informe_estado='calificado',nota_moodle=candidate_grade,
      nota_fuente='moodle_session_observed',nota_actualizada_at=now(),nota_moodle_cmid=c.cmid where id=p.id;
    insert into private.moodle_evidence_applications(decision_id,practica_id,action,previous_academic,applied_academic,reason,actor_id)
      values(did,p.id,'apply',before_value,target,why,v.actor_id) returning id into aid;
    insert into private.moodle_evidence_projection(practica_id,application_id,decision_id,active,baseline_academic)
      values(p.id,aid,did,true,baseline) on conflict(practica_id) do update
      set application_id=excluded.application_id,decision_id=excluded.decision_id,active=true,
        baseline_academic=excluded.baseline_academic;
    result:=result||jsonb_build_array(jsonb_build_object('practice',p.id,'status','applied','grade',candidate_grade));
  end loop;
  return jsonb_build_object('evidence',v.id,'results',result);
end $$;

-- Both legacy entry points now delegate. Neither contains an academic UPDATE.
create or replace function private.apply_moodle_grade_observation() returns trigger
language plpgsql security definer set search_path='' as $$
declare c record; outcome jsonb;
begin
  for c in select id from private.moodle_evidence_cases
    where estudiante_id=new.estudiante_id and course_id=new.course_id and cmid=new.cmid
    order by id loop
    outcome:=private.reconcile_moodle_case_v1(c.id);
    insert into private.moodle_evidence_reconciliation(case_id,evidence_id,outcome)
      values(c.id,(outcome->>'evidence')::uuid,outcome) on conflict(case_id) do update
      set evidence_id=excluded.evidence_id,outcome=excluded.outcome,checked_at=clock_timestamp();
  end loop;
  return new;
end $$;

create or replace function private.recompute_grades_after_scale_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare c record; outcome jsonb;
begin
  if new.grade_conversion_mode is not distinct from old.grade_conversion_mode then return new; end if;
  -- Lock practices deterministically before cases, as in manual and automatic apply.
  perform 1 from public.practicas p where exists(
    select 1 from private.moodle_evidence_cases ec where ec.estudiante_id=p.estudiante_id
      and ec.course_id=new.course_id and ec.cmid::text=new.moodle_id) order by p.id for update;
  for c in select id from private.moodle_evidence_cases
    where course_id=new.course_id and cmid::text=new.moodle_id order by id loop
    outcome:=private.reconcile_moodle_case_v1(c.id);
    insert into private.moodle_evidence_reconciliation(case_id,evidence_id,outcome)
      values(c.id,(outcome->>'evidence')::uuid,outcome) on conflict(case_id) do update
      set evidence_id=excluded.evidence_id,outcome=excluded.outcome,checked_at=clock_timestamp();
  end loop;
  return new;
end $$;

-- Non-writing preview includes the prior record even when attribution is refused.
create function private.preview_moodle_case_v1(p_case uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('case',c.id,'revision',c.revision,'student',c.estudiante_id,
    'cmid',c.cmid,'plan',private.plan_moodle_case_v1(c.id),'practices',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'academic',private.moodle_academic_fields_v1(p),
        'exactTask',private.moodle_exact_practice_task_v1(p.id),'application',ep.application_id,
        'active',ep.active) order by p.id)
      from public.practicas p left join private.moodle_evidence_projection ep on ep.practica_id=p.id
      where p.estudiante_id=c.estudiante_id),'[]'::jsonb))
  from private.moodle_evidence_cases c where c.id=p_case;
$$;

create function private.preview_moodle_history_v1(p_after uuid default null,p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid batch size'; end if;
  select coalesce(jsonb_agg(private.preview_moodle_case_v1(c.id) order by c.id),'[]'::jsonb) into result
  from (select id from private.moodle_evidence_cases where p_after is null or id>p_after order by id limit p_limit) c;
  return result;
end $$;

create table private.moodle_history_reviews (
  run_id uuid not null,
  case_id uuid not null references private.moodle_evidence_cases(id),
  preview jsonb not null,
  outcome jsonb not null,
  reviewed_at timestamptz not null default clock_timestamp(),
  primary key(run_id,case_id)
);
alter table private.moodle_history_reviews enable row level security;
revoke all on private.moodle_history_reviews from public,anon,authenticated;

-- Operator-only bounded application: stale plans are recorded, never forced.
create function private.apply_moodle_history_batch_v1(p_run uuid,p_previews jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; actual jsonb; outcome jsonb; result jsonb:='[]'; c uuid; student uuid;
begin
  if p_run is null or jsonb_typeof(p_previews) is distinct from 'array'
    or jsonb_array_length(p_previews)>100 then raise exception 'Invalid batch'; end if;
  perform 1 from public.practicas p where p.estudiante_id in (
    select ec.estudiante_id from jsonb_array_elements(p_previews) v
      join private.moodle_evidence_cases ec on ec.id=(v->>'case')::uuid)
    order by p.id for update;
  for item in select * from jsonb_array_elements(p_previews) order by value->>'case' loop
    c:=(item->>'case')::uuid;
    select r.outcome into outcome from private.moodle_history_reviews r where r.run_id=p_run and r.case_id=c;
    if found then
      result:=result||jsonb_build_array(jsonb_build_object('case',c,'outcome',outcome,'replayed',true)); continue;
    end if;
    perform 1 from private.moodle_evidence_cases where id=c for update;
    actual:=private.preview_moodle_case_v1(c);
    if actual is distinct from item then
      outcome:=jsonb_build_object('reason','stale_preview');
    else
      outcome:=private.reconcile_moodle_case_v1(c);
      insert into private.moodle_evidence_reconciliation(case_id,evidence_id,outcome)
        values(c,(outcome->>'evidence')::uuid,outcome) on conflict(case_id) do update
        set evidence_id=excluded.evidence_id,outcome=excluded.outcome,checked_at=clock_timestamp();
    end if;
    insert into private.moodle_history_reviews(run_id,case_id,preview,outcome) values(p_run,c,item,outcome);
    result:=result||jsonb_build_array(jsonb_build_object('case',c,'outcome',outcome));
  end loop;
  return result;
end $$;

revoke all on function private.plan_moodle_case_v1,private.preview_moodle_case_v1,
  private.preview_moodle_history_v1,private.apply_moodle_history_batch_v1,
  private.apply_moodle_grade_observation,private.recompute_grades_after_scale_change
  from public,anon,authenticated;

-- Raw task grades are observations, never a fallback practice grade. Preserve the
-- stored academic record for staff; students keep only the three agreed states.
do $patch$ declare def text; start_at integer; begin
  def:=pg_get_functiondef('private.moodle_practice_snapshot_v1(uuid)'::regprocedure);
  start_at:=position('  select coalesce(' in def);
  if start_at=0 then raise exception 'Unexpected canonical snapshot definition'; end if;
  def:=left(def,start_at-1)||$tail$
  linked:=private.moodle_exact_practice_task_v1(p_id);
  select ev.* into v from private.moodle_evidence_cases ec
    cross join lateral private.moodle_effective_evidence_v1(ec.id) ev
    where ec.estudiante_id=p.estudiante_id and ec.course_id=3615 and ec.cmid=linked
      and not ec.identity_conflict
      and not exists(select 1 from private.moodle_evidence_applications x
        join private.moodle_evidence_decisions xd on xd.id=x.decision_id
        where x.practica_id=p_id and x.action='revert' and xd.case_id=ec.id)
    order by ev.observed_at desc,(ev.source<>'legacy') desc,ev.received_at desc,ev.id desc limit 1;
  if v.id is null then return null; end if;
  select * into c from private.moodle_evidence_cases where id=v.case_id;
  result:=to_jsonb(jsonb_populate_record(null::public.moodle_grade_snapshots,jsonb_build_object(
    'practica_id',p.id,'estudiante_id',p.estudiante_id,'lanzamiento_id',p.lanzamiento_id,
    'cmid',linked,'course_id',3615,'task_status',case when v.content->>'status'='graded' then 'submitted' else v.content->>'status' end,
    'submitted',coalesce((v.content->>'submitted')::boolean,false) or v.content->>'status' in ('submitted','graded'),
    'observed_at',v.observed_at,'received_at',v.received_at,'confidence','moodle_session_observed',
    'submitted_at',v.content->>'submittedAt','submitted_at_display',v.content->>'submittedAtDisplay',
    'feedback_comment',v.content->>'feedbackComment','graded_at_display',v.content->>'gradedAtDisplay',
    'submission_classifier_version',v.content->>'classifierVersion',
    'submission_file_count',v.content->'fileCount','submission_logical_file_count',v.content->'logicalFileCount',
    'submission_file_types',v.content->'fileTypeCounts','attendance_evidence',v.content->>'attendanceEvidence',
    'attendance_confidence',v.content->>'attendanceConfidence','attendance_evidence_reasons',v.content->'reasons',
    'last_observed_at',v.observed_at,'last_task_status',v.content->>'status','scan_closed',false,'grade_revision',1)));
  return result||jsonb_build_object('academicGrade',p.nota,'academicGradeSource',p.nota_fuente,
    'reviewedAllocation',false,'reviewRequired',v.content->>'status'='graded',
    'attributionStatus','unconfirmed','evidenceId',v.id);
end $function$;
$tail$;
  execute def;
end $patch$;

-- Original student/jefe captures also apply through this authority, without waiting
-- for a student to open the panel. Store first, then reconcile; failed reads retain
-- the last valid evidence. Acquire practice locks before capture locks the case.
do $patch$ declare def text; begin
  def:=pg_get_functiondef('private.capture_moodle_evidence_v1(uuid,text,uuid,bigint,bigint,bigint,uuid,timestamptz,jsonb,uuid,uuid)'::regprocedure);
  if position('  -- Explicit allowlist:' in def)=0 or position('  return v_case;' in def)=0 then
    raise exception 'Unexpected evidence capture definition'; end if;
  def:=replace(def,'  -- Explicit allowlist:',
    '  perform 1 from public.practicas where estudiante_id=p_student order by id for update;'||chr(10)||'  -- Explicit allowlist:');
  def:=replace(def,'  return v_case;',
    '  if p_source in (''student'',''jefe'') then'||chr(10)||
    '    v_content:=private.reconcile_moodle_case_v1(v_case);'||chr(10)||
    '    insert into private.moodle_evidence_reconciliation(case_id,evidence_id,outcome)'||chr(10)||
    '      values(v_case,(v_content->>''evidence'')::uuid,v_content) on conflict(case_id) do update'||chr(10)||
    '      set evidence_id=excluded.evidence_id,outcome=excluded.outcome,checked_at=clock_timestamp();'||chr(10)||
    '  end if;'||chr(10)||'  return v_case;');
  execute def;
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='capture_jefe_moodle_evidence_v1';
  if position('  for v_task in select * from jsonb_array_elements(p_tasks) loop' in def)=0 then
    raise exception 'Unexpected jefe capture loop'; end if;
  def:=replace(def,'  for v_task in select * from jsonb_array_elements(p_tasks) loop',
    '  perform 1 from public.practicas p where p.estudiante_id in ('||chr(10)||
    '    select e.id from public.estudiantes e where exists ('||chr(10)||
    '      select 1 from jsonb_array_elements(p_tasks) t cross join lateral jsonb_array_elements(t->''rows'') r'||chr(10)||
    '      where regexp_replace(e.dni::text,''\D'','''',''g'')=r->>''moodleUsername'')) order by p.id for update;'||chr(10)||
    '  for v_task in select * from jsonb_array_elements(p_tasks) loop');
  execute def;
end $patch$;

commit;
