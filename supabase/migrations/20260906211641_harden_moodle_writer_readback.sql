begin;

-- Keep the historical config hash stable. The writer adds a second, strict
-- verification hash covering the grading reminder and actual course/year.
create function private.moodle_writer_readback_hash_v1(
  p_config_hash text, p_grading_due timestamptz, p_course bigint, p_year integer
) returns text language sql immutable parallel safe set search_path='' as $$
  select md5(jsonb_build_array('moodle-writer/v2',p_config_hash,
    floor(extract(epoch from p_grading_due)/60),p_course,p_year)::text);
$$;
revoke all on function private.moodle_writer_readback_hash_v1 from public,anon,authenticated;

do $patch$
declare original text; patched text; anchor text;
begin
  select pg_get_functiondef('private.confirm_moodle_task_intent_v1_impl(uuid,uuid,bigint,bigint,text,text,text,timestamptz,timestamptz,timestamptz,text,numeric,text,text,jsonb)'::regprocedure) into original;
  patched:=replace(original,'  v_year smallint;', E'  v_year smallint;\n  v_grading_due timestamptz;\n  v_expected_readback_hash text;\n  v_observed_readback_hash text;');
  if patched=original then raise exception 'Writer declaration anchor missing'; end if;
  anchor:='  v_observed_hash := private.moodle_v2_config_hash(';
  if position(anchor in patched)=0 then raise exception 'Writer verification anchor missing'; end if;
  patched:=replace(patched,anchor,$guard$
  if p_cmid is null or p_cmid<=0 or p_course_id is distinct from 3615::bigint then
    raise exception 'Invalid writer course or CMID' using errcode='22023';
  end if;
  select substring(l.fecha_inicio from '^([0-9]{4})')::smallint into v_year
    from public.lanzamientos_pps l where l.id=v_intent.lanzamiento_id;
  if v_year is null then raise exception 'Launch academic year is missing'; end if;
  if jsonb_typeof(p_evidence) is distinct from 'object'
    or p_evidence->>'schema' is distinct from 'moodle-writer/v2'
    or not (p_evidence ? 'gradingDueAt')
    or p_evidence->>'sectionTitle' is distinct from 'Tareas '||v_year::text
    or coalesce((p_evidence->>'sectionId')::bigint,0)<=0
    or p_evidence->>'sourceUrl' is null
    or p_evidence->>'sourceUrl' not in (
      'https://campus.uflo.edu.ar/course/modedit.php?update='||p_cmid::text,
      'https://campus.uflo.edu.ar/course/modedit.php?update='||p_cmid::text||'&return=1')
    or (p_evidence->>'fileSubmissions')::boolean is distinct from true
    or (p_evidence->>'onlineText')::boolean is distinct from false
    or (p_evidence->>'observedAt')::timestamptz is null
    or (p_evidence->>'observedAt')::timestamptz<v_intent.last_attempt_at
    or (p_evidence->>'observedAt')::timestamptz>now()+interval '5 minutes'
  then raise exception 'Complete fresh Moodle readback required' using errcode='22023'; end if;
  v_grading_due:=(p_evidence->>'gradingDueAt')::timestamptz;
  if v_intent.aula_entrega_id is not null and not exists(
    select 1 from public.aula_entregas a where a.id=v_intent.aula_entrega_id
      and a.course_id=p_course_id and a.moodle_id=p_cmid::text
  ) then raise exception 'CMID differs from the confirmed task' using errcode='22023'; end if;
  if exists(select 1 from public.aula_entregas a
    join public.lanzamiento_moodle_tareas l on l.aula_entrega_id=a.id
    where a.course_id=p_course_id and a.moodle_id=p_cmid::text
      and (l.lanzamiento_id<>v_intent.lanzamiento_id or l.orientacion_key<>v_intent.orientacion_key)
  ) or exists(select 1 from public.aula_entregas a
    join public.practica_moodle_tareas l on l.aula_entrega_id=a.id
    where a.course_id=p_course_id and a.moodle_id=p_cmid::text
      and v_intent.aula_entrega_id is distinct from a.id
  ) then raise exception 'Task already belongs to another obligation' using errcode='22023'; end if;

  v_observed_hash := private.moodle_v2_config_hash($guard$);
  anchor:='  if v_observed_hash is distinct from v_intent.desired_config_hash then';
  if position(anchor in patched)=0 then raise exception 'Writer drift anchor missing'; end if;
  patched:=replace(patched,anchor,$hash$
  v_expected_readback_hash:=private.moodle_writer_readback_hash_v1(
    v_intent.desired_config_hash,v_intent.desired_grading_due_at,3615,v_year);
  v_observed_readback_hash:=private.moodle_writer_readback_hash_v1(
    v_observed_hash,v_grading_due,p_course_id,v_year);
  p_evidence:=p_evidence||jsonb_build_object('verificationHash',v_observed_readback_hash,
    'expectedVerificationHash',v_expected_readback_hash);
  if v_observed_hash is distinct from v_intent.desired_config_hash
    or v_observed_readback_hash is distinct from v_expected_readback_hash
    or (v_intent.desired_due_at is not null and v_grading_due is null)
    or floor(extract(epoch from v_grading_due)/60)<floor(extract(epoch from p_observed_due_at)/60)
  then$hash$);
  -- Eliminate the historical escaped-regex/current-year fallback: a 2027
  -- task prepared during 2026 must remain catalogued as 2027.
  anchor:=substring(patched from '  select coalesce\(substring\(l.fecha_inicio[\s\S]*?where l.id = v_intent.lanzamiento_id;');
  if anchor is null then raise exception 'Writer year anchor missing'; end if;
  patched:=replace(patched,anchor,'  -- Academic year already verified from the launch above.');
  execute patched;
end $patch$;

comment on function private.moodle_writer_readback_hash_v1 is
  'Supplemental writer verification hash; preserves historical legacy hashes while checking the grading reminder, course and launch year.';
commit;
