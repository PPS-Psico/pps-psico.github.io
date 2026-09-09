begin;
-- Historical imports use a placeholder as well as NULL for ungraded practices.
-- It is not a manually assigned academic grade.
create function private.moodle_grade_is_pending_v1(p_grade text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(lower(trim(p_grade)),'') in ('','sin calificar');
$$;
revoke all on function private.moodle_grade_is_pending_v1 from public,anon,authenticated;
do $$ declare def text; begin
  def:=pg_get_functiondef('private.reconcile_moodle_case_v1(uuid)'::regprocedure);
  if position('projection.practica_id is null and (p.nota is not null' in def)=0 then
    raise exception 'Unexpected manual-grade guard'; end if;
  def:=replace(def,'projection.practica_id is null and (p.nota is not null',
    'projection.practica_id is null and (not private.moodle_grade_is_pending_v1(p.nota)');
  execute def;
end $$;
-- Manual reviewers must see the same effective version that apply validates.
-- Cases with only failed reads stay visible in the administrative inbox.
do $$ declare def text; old_selector text; begin
  def:=pg_get_functiondef('private.moodle_evidence_inbox_v1(integer,integer)'::regprocedure);
  old_selector:='select * from private.moodle_evidence_versions v where v.case_id=c.id'||chr(10)||
    '      order by v.observed_at desc,v.received_at desc,v.id desc limit 1';
  if position(old_selector in def)=0 then raise exception 'Unexpected inbox selector'; end if;
  def:=replace(def,old_selector,
    'select * from private.moodle_effective_evidence_v1(c.id) union all '||
    '(select * from private.moodle_evidence_versions where case_id=c.id '||
    'and not exists(select 1 from private.moodle_effective_evidence_v1(c.id)) '||
    'order by observed_at desc,received_at desc,id desc limit 1)');
  execute def;
  def:=pg_get_functiondef('private.moodle_practice_snapshot_v1(uuid)'::regprocedure);
  if position('''scan_closed'',true,''grade_revision'',1' in def)=0 then
    raise exception 'Unexpected projection metadata'; end if;
  def:=replace(def,'''scan_closed'',true,''grade_revision'',1',
    '''submission_classifier_version'',v.content->>''classifierVersion'',''scan_closed'',true,''grade_revision'',1');
  execute def;
end $$;
commit;
