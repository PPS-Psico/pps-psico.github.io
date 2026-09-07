begin;

-- Academic policy confirmed by coordination: 2024 uses literal pass/fail grades.
-- Keep the numeric observation intact; a reviewed academic decision is separate.
alter table private.moodle_evidence_decisions add column qualitative_grade text;
alter table private.moodle_evidence_decisions add constraint moodle_evidence_qualitative_grade
  check (qualitative_grade is null or
    (qualitative_grade in ('Aprobado','Desaprobado') and grade is null and action='allocate'));

create function private.decide_moodle_evidence_v2(p_case uuid,p_evidence uuid,p_practice uuid,
  p_revision integer,p_action text,p_reason text,p_grade numeric default null,
  p_qualitative_grade text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare c private.moodle_evidence_cases; next_revision integer; task_year smallint;
begin
  if not private.moodle_v2_is_coordinator() or auth.uid() is null then
    raise exception 'Coordinator required' using errcode='42501';
  end if;
  select * into c from private.moodle_evidence_cases where id=p_case for update;
  if not found or c.revision is distinct from p_revision then
    raise exception 'Evidence changed; reload before deciding' using errcode='40001';
  end if;
  if c.identity_conflict or c.estudiante_id is null
    or not exists(select 1 from private.moodle_evidence_versions where id=p_evidence and case_id=p_case)
    or not exists(select 1 from public.practicas where id=p_practice and estudiante_id=c.estudiante_id) then
    raise exception 'Evidence and practice must belong to the same student' using errcode='42501';
  end if;
  select academic_year into task_year from public.aula_entregas
    where course_id=c.course_id and moodle_id=c.cmid::text;
  if p_qualitative_grade is not null and
    (task_year is distinct from 2024 or p_qualitative_grade not in ('Aprobado','Desaprobado')
      or p_grade is not null or p_action is distinct from 'allocate') then
    raise exception 'Qualitative grade requires a confirmed 2024 task and an allocation';
  end if;
  if task_year=2024 and p_grade is not null then
    raise exception '2024 uses Aprobado or Desaprobado; numeric equivalence is not authorized';
  end if;
  next_revision:=c.revision+1;
  insert into private.moodle_evidence_decisions
    (case_id,evidence_id,practica_id,revision,action,grade,qualitative_grade,reason,actor_id)
    values(p_case,p_evidence,p_practice,next_revision,p_action,p_grade,p_qualitative_grade,trim(p_reason),auth.uid());
  update private.moodle_evidence_cases set revision=next_revision,updated_at=clock_timestamp() where id=p_case;
  return next_revision;
end $$;
create function public.decide_moodle_evidence_v2(p_case uuid,p_evidence uuid,p_practice uuid,
  p_revision integer,p_action text,p_reason text,p_grade numeric default null,
  p_qualitative_grade text default null) returns integer
language sql security invoker set search_path='' as $$
  select private.decide_moodle_evidence_v2(p_case,p_evidence,p_practice,p_revision,p_action,p_reason,p_grade,p_qualitative_grade);
$$;
revoke all on function private.decide_moodle_evidence_v2,public.decide_moodle_evidence_v2 from public,anon;
grant execute on function private.decide_moodle_evidence_v2,public.decide_moodle_evidence_v2 to authenticated;

-- Old clients retain their API and the same policy checks.
create or replace function private.decide_moodle_evidence_v1(p_case uuid,p_evidence uuid,p_practice uuid,
  p_revision integer,p_action text,p_reason text,p_grade numeric default null)
returns integer language plpgsql security definer set search_path='' as $$
begin
  return private.decide_moodle_evidence_v2(p_case,p_evidence,p_practice,p_revision,p_action,p_reason,p_grade,null);
end $$;

do $patch$
declare source text;
begin
  select pg_get_functiondef('private.apply_moodle_evidence_decision_v1(uuid,jsonb,uuid,text,text)'::regprocedure) into source;
  if position('if d.grade is not null then' in source)=0 then raise exception 'Unexpected application definition'; end if;
  source:=replace(source,'d.grade is not null or p.informe_estado',
    'd.grade is not null or d.qualitative_grade is not null or p.informe_estado');
  source:=replace(source,'if d.grade is not null then',
    $replacement$if d.qualitative_grade is not null then
      if not exists(select 1 from public.aula_entregas ae where ae.course_id=c.course_id
        and ae.moodle_id=c.cmid::text and ae.academic_year=2024) then
        raise exception 'Qualitative grade requires a confirmed 2024 task';
      end if;
      target:=target || jsonb_build_object('nota',d.qualitative_grade,'nota_moodle',null,
        'nota_fuente','admin','nota_actualizada_at',now(),'nota_moodle_cmid',c.cmid);
    elsif d.grade is not null then$replacement$);
  execute source;

  select pg_get_functiondef('private.moodle_practice_snapshot_v1(uuid)'::regprocedure) into source;
  if position('then d.grade::text end' in source)=0 then raise exception 'Unexpected snapshot definition'; end if;
  source:=replace(source,$s$'task_status',case when d.grade is not null and not changed$s$,
    $s$'task_status',case when (d.grade is not null or d.qualitative_grade is not null) and not changed$s$);
  source:=replace(source,'then d.grade::text end','then coalesce(d.qualitative_grade,d.grade::text) end');
  execute source;

  select pg_get_functiondef('private.moodle_evidence_inbox_v1(integer,integer)'::regprocedure) into source;
  if position($s$'taskName',ae.moodle_name$s$ in source)=0 then raise exception 'Unexpected inbox definition'; end if;
  source:=replace(source,$s$'taskName',ae.moodle_name$s$,$s$'taskName',ae.moodle_name,'taskYear',ae.academic_year$s$);
  execute source;
end $patch$;

commit;
