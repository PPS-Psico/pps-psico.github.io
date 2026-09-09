begin;

alter table private.moodle_evidence_decisions add column origin text not null default 'manual'
  check (origin in ('manual','automatic/v1'));

-- Private diagnostics never become student-facing delivery states.
create table private.moodle_evidence_reconciliation (
  case_id uuid primary key references private.moodle_evidence_cases(id),
  evidence_id uuid references private.moodle_evidence_versions(id),
  outcome jsonb not null,
  checked_at timestamptz not null default clock_timestamp()
);
alter table private.moodle_evidence_reconciliation enable row level security;
revoke all on private.moodle_evidence_reconciliation from public,anon,authenticated;

-- Do not let a failed fetch erase a valid observation. Within the SAME observation
-- prefer original evidence to the lossy legacy copy. Never borrow an older comment.
create function private.moodle_effective_evidence_v1(p_case uuid)
returns setof private.moodle_evidence_versions language sql stable set search_path='' as $$
  select v.* from private.moodle_evidence_versions v where v.case_id=p_case
    and v.content->>'status' in ('graded','submitted','not_submitted')
  order by v.observed_at desc,(v.source<>'legacy') desc,
    (nullif(trim(v.content->>'feedbackComment'),'') is not null) desc,
    v.received_at desc,v.id desc limit 1;
$$;

create function private.moodle_report_words_v1(p_text text) returns text[]
language sql immutable set search_path='' as $$
  select coalesce(array_agg(distinct regexp_replace(w,'s$','')),'{}'::text[])
  from regexp_split_to_table(translate(lower(coalesce(p_text,'')), 'áéíóúñ','aeioun'),'[^a-z0-9]+') w
  where length(w)>2 and w not in ('informe','clinica','clinico','final','pps','del','los','las','para');
$$;

-- Deliberately constrained grammar: explicit report label, numeric grade and
-- agreeing written grade. Unsupported/free-form comments stay in the review inbox.
create function private.moodle_report_grades_v1(p_text text)
returns table(label text,grade numeric) language sql immutable set search_path='' as $$
  select trim(m[1]),m[2]::numeric
  from regexp_matches(coalesce(p_text,''),
    'informe[[:space:]]+([^:;\n]{3,100}):[[:space:]]*(10|[4-9])[[:space:]]*\((cuatro|cinco|seis|siete|ocho|nueve|diez)\)','gi') m
  where lower(m[3])=(array['cuatro','cinco','seis','siete','ocho','nueve','diez'])[m[2]::int-3];
$$;

-- Confirmed practice links take precedence; ambiguous links yield no candidate.
create function private.moodle_exact_practice_task_v1(p_id uuid) returns bigint
language sql stable security definer set search_path='' as $$
  with direct as (
    select distinct ae.moodle_id::bigint cmid from public.practica_moodle_tareas l
    join public.aula_entregas ae on ae.id=l.aula_entrega_id
    where l.practica_id=p_id and l.validation_status='confirmed' and ae.course_id=3615
      and ae.moodle_id ~ '^[0-9]+$'
  ), launch as (
    select distinct ae.moodle_id::bigint cmid from public.practicas p
    join public.lanzamiento_moodle_tareas l on l.lanzamiento_id=p.lanzamiento_id
    join public.aula_entregas ae on ae.id=l.aula_entrega_id
    where p.id=p_id and l.validation_status='confirmed' and ae.course_id=3615
      and ae.moodle_id ~ '^[0-9]+$'
      and private.jefe_text_has_area(coalesce(p.especialidad,''),l.orientacion_key)
  ) select case when exists(select 1 from direct) then
    (select min(cmid) from direct having count(*)=1)
    else (select min(cmid) from launch having count(*)=1) end;
$$;

create function private.reconcile_moodle_case_v1(p_case uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
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
  -- Same lock order as manual academic applications, including all shared practices.
  perform 1 from public.practicas where estudiante_id=c.estudiante_id order by id for update;
  select * into c from private.moodle_evidence_cases where id=p_case for update;
  if c.estudiante_id is null or c.identity_conflict then return jsonb_build_object('reason','identity_requires_review'); end if;
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
      or (projection.practica_id is null and (p.nota is not null
        and coalesce(p.nota_fuente,'')<>'moodle_session_observed')) then
      result:=result||jsonb_build_array(jsonb_build_object('practice',p.id,'status','manual_record_preserved'));
      continue;
    end if;
    candidate_grade:=(item->>'grade')::numeric;
    if projection.active and decision.grade=candidate_grade and
      private.moodle_evidence_meaning_v1(v.content)=
      (select private.moodle_evidence_meaning_v1(content) from private.moodle_evidence_versions where id=decision.evidence_id) then
      result:=result||jsonb_build_array(jsonb_build_object('practice',p.id,'status','unchanged'));
      continue;
    end if;
    why:=case when labels>0 then 'automatic/v1: explicit report label matched to confirmed launch'
      else 'automatic/v1: unique confirmed practice and catalogue scale' end;
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

create function private.reconcile_student_moodle_evidence_v1(p_student uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c record; outcome jsonb; summary jsonb:='[]'; changed integer:=0;
begin
  if auth.uid() is null or not (
    exists(select 1 from public.estudiantes where id=p_student and user_id=auth.uid())
    or private.moodle_v2_is_coordinator()) then
    raise exception 'Student or coordinator required' using errcode='42501'; end if;
  for c in select id from private.moodle_evidence_cases where estudiante_id=p_student order by id loop
    outcome:=private.reconcile_moodle_case_v1(c.id);
    changed:=changed+(select count(*) from jsonb_array_elements(coalesce(outcome->'results','[]')) r
      where r->>'status'='applied');
    insert into private.moodle_evidence_reconciliation(case_id,evidence_id,outcome)
      values(c.id,(outcome->>'evidence')::uuid,outcome) on conflict(case_id) do update
      set evidence_id=excluded.evidence_id,outcome=excluded.outcome,checked_at=clock_timestamp();
    summary:=summary||jsonb_build_array(jsonb_build_object('case',c.id,'outcome',outcome));
  end loop;
  -- The student receives no internal diagnostics or cross-practice allocations.
  return jsonb_build_object('processed',jsonb_array_length(summary),'changed',changed);
end $$;
create function public.reconcile_student_moodle_evidence_v1(p_student uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select private.reconcile_student_moodle_evidence_v1(p_student);
$$;
revoke all on function private.moodle_effective_evidence_v1,private.moodle_report_words_v1,
  private.moodle_report_grades_v1,private.moodle_exact_practice_task_v1,private.reconcile_moodle_case_v1
  from public,anon,authenticated;
revoke all on function private.reconcile_student_moodle_evidence_v1,public.reconcile_student_moodle_evidence_v1 from public,anon;
grant execute on function private.reconcile_student_moodle_evidence_v1,public.reconcile_student_moodle_evidence_v1 to authenticated;

-- Existing manual review permissions remain unchanged. Its freshness check and
-- the projection use the same lossless evidence selection as automatic processing.
do $$ declare def text; fn regprocedure; begin
  foreach fn in array array[
    'private.moodle_practice_snapshot_v1(uuid)'::regprocedure,
    'private.apply_moodle_evidence_decision_v1(uuid,jsonb,uuid,text,text)'::regprocedure
  ] loop
    def:=pg_get_functiondef(fn);
    if position('order by observed_at desc,received_at desc,id desc limit 1' in def)=0 then
      raise exception 'Unexpected evidence selector in %',fn; end if;
    def:=replace(def,'from private.moodle_evidence_versions where case_id=c.id'||chr(10)||
      '      order by observed_at desc,received_at desc,id desc limit 1',
      'from private.moodle_effective_evidence_v1(c.id)');
    execute def;
  end loop;
end $$;

commit;
