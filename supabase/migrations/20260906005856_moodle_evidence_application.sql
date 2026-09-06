begin;

alter table private.moodle_evidence_decisions add constraint moodle_evidence_grade_precision
  check (grade is null or grade=round(grade,2));

-- A review is a proposal. Applying it is a separate, explicit academic action.
create table private.moodle_evidence_applications (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references private.moodle_evidence_decisions(id),
  practica_id uuid not null references public.practicas(id),
  action text not null check (action in ('apply','revert')),
  previous_academic jsonb not null,
  applied_academic jsonb not null,
  reason text not null check (length(trim(reason)) between 8 and 2000),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);
create index moodle_evidence_applications_practice on private.moodle_evidence_applications(practica_id,created_at desc);
create table private.moodle_evidence_projection (
  practica_id uuid primary key references public.practicas(id),
  application_id uuid not null references private.moodle_evidence_applications(id),
  decision_id uuid not null references private.moodle_evidence_decisions(id),
  active boolean not null,
  baseline_academic jsonb not null
);
alter table private.moodle_evidence_applications enable row level security;
alter table private.moodle_evidence_projection enable row level security;
revoke all on private.moodle_evidence_applications,private.moodle_evidence_projection from public,anon,authenticated;

create function private.moodle_academic_fields_v1(p public.practicas) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('nota',p.nota,'informe_estado',p.informe_estado,
    'nota_moodle',p.nota_moodle,'nota_fuente',p.nota_fuente,
    'nota_actualizada_at',p.nota_actualizada_at,'nota_moodle_cmid',p.nota_moodle_cmid);
$$;
-- Parser metadata and repeated reads do not invalidate a reviewed result.
create function private.moodle_evidence_meaning_v1(p jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_strip_nulls(coalesce(jsonb_object_agg(key,value),'{}'::jsonb))
  from jsonb_each(p) where key=any(array['status','submitted','gradeValue','gradeMax',
    'gradeDisplay','gradedAtDisplay','feedbackComment','submittedAt','submittedAtDisplay',
    'fileCount','logicalFileCount','fileTypeCounts']);
$$;
revoke all on function private.moodle_academic_fields_v1,private.moodle_evidence_meaning_v1 from public,anon,authenticated;

create function private.apply_moodle_evidence_decision_v1(p_decision uuid,p_expected_academic jsonb,
  p_expected_application uuid,p_action text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d private.moodle_evidence_decisions;
  c private.moodle_evidence_cases;
  v private.moodle_evidence_versions;
  latest private.moodle_evidence_versions;
  p public.practicas;
  projection private.moodle_evidence_projection;
  previous_application private.moodle_evidence_applications;
  target jsonb;
  before_value jsonb;
  baseline jsonb;
  result_id uuid;
begin
  if not private.moodle_v2_is_coordinator() or auth.uid() is null then
    raise exception 'Coordinator required' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('apply','revert') or p_expected_academic is null
    or p_reason is null or length(trim(p_reason)) not between 8 and 2000 then
    raise exception 'Invalid application';
  end if;
  select * into d from private.moodle_evidence_decisions where id=p_decision;
  if not found then raise exception 'Unknown decision'; end if;
  -- Serialize against academic writers before locking the evidence case.
  select * into p from public.practicas where id=d.practica_id for update;
  select * into c from private.moodle_evidence_cases where id=d.case_id for update;
  if c.estudiante_id is distinct from p.estudiante_id or c.identity_conflict
    or c.estudiante_id is null then raise exception 'Identity requires review' using errcode='42501'; end if;
  select * into projection from private.moodle_evidence_projection where practica_id=p.id;
  before_value:=private.moodle_academic_fields_v1(p);
  if before_value is distinct from p_expected_academic
    or projection.application_id is distinct from p_expected_application then
    raise exception 'Academic record changed; reload before applying' using errcode='40001';
  end if;
  if p_action='apply' then
    if d.action<>'allocate' or exists(select 1 from private.moodle_evidence_decisions x
      where x.case_id=d.case_id and x.practica_id=d.practica_id and x.revision>d.revision) then
      raise exception 'Decision was superseded' using errcode='40001';
    end if;
    select * into v from private.moodle_evidence_versions where id=d.evidence_id;
    select * into latest from private.moodle_evidence_versions where case_id=c.id
      order by observed_at desc,received_at desc,id desc limit 1;
    if private.moodle_evidence_meaning_v1(v.content) is distinct from private.moodle_evidence_meaning_v1(latest.content) then
      raise exception 'New evidence requires review' using errcode='40001';
    end if;
    if coalesce(v.content->>'status','') not in ('submitted','graded') then
      raise exception 'Only positive delivery evidence can be applied';
    end if;
    -- Applying an association without a proposed grade preserves the academic grade.
    target:=before_value || jsonb_build_object('informe_estado',
      case when d.grade is not null or p.informe_estado='calificado' then 'calificado' else 'entregado' end);
    if d.grade is not null then
      target:=target || jsonb_build_object('nota',rtrim(rtrim(to_char(d.grade,'FM990.00'),'0'),'.'),
        'nota_moodle',d.grade,'nota_fuente','admin','nota_actualizada_at',now(),'nota_moodle_cmid',c.cmid);
    end if;
    baseline:=case when projection.active then projection.baseline_academic else before_value end;
  else
    if not coalesce(projection.active,false) or projection.decision_id<>d.id then
      raise exception 'This decision is not the applied decision' using errcode='40001';
    end if;
    select * into previous_application from private.moodle_evidence_applications where id=projection.application_id;
    if before_value is distinct from previous_application.applied_academic then
      raise exception 'A later academic edit must be reconciled before reverting' using errcode='40001';
    end if;
    target:=projection.baseline_academic;
    baseline:=target;
  end if;
  update public.practicas set nota=target->>'nota',informe_estado=target->>'informe_estado',
    nota_moodle=(target->>'nota_moodle')::numeric,nota_fuente=target->>'nota_fuente',
    nota_actualizada_at=(target->>'nota_actualizada_at')::timestamptz,
    nota_moodle_cmid=(target->>'nota_moodle_cmid')::bigint where id=p.id;
  insert into private.moodle_evidence_applications(decision_id,practica_id,action,previous_academic,
    applied_academic,reason,actor_id) values(d.id,p.id,p_action,before_value,target,trim(p_reason),auth.uid())
    returning id into result_id;
  insert into private.moodle_evidence_projection(practica_id,application_id,decision_id,active,baseline_academic)
    values(p.id,result_id,d.id,p_action='apply',baseline)
    on conflict(practica_id) do update set application_id=excluded.application_id,
      decision_id=excluded.decision_id,active=excluded.active,baseline_academic=excluded.baseline_academic;
  return result_id;
end $$;
create function public.apply_moodle_evidence_decision_v1(p_decision uuid,p_expected_academic jsonb,
  p_action text,p_reason text,p_expected_application uuid default null) returns uuid
language sql security invoker set search_path='' as $$
  select private.apply_moodle_evidence_decision_v1(p_decision,p_expected_academic,p_expected_application,p_action,p_reason);
$$;
revoke all on function private.apply_moodle_evidence_decision_v1,public.apply_moodle_evidence_decision_v1 from public,anon;
grant execute on function private.apply_moodle_evidence_decision_v1,public.apply_moodle_evidence_decision_v1 to authenticated;

-- One selection per practice. Never borrow another practice's submission.
create function private.moodle_practice_snapshot_v1(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.practicas; projection private.moodle_evidence_projection;
  d private.moodle_evidence_decisions; v private.moodle_evidence_versions;
  latest private.moodle_evidence_versions; c private.moodle_evidence_cases;
  a private.moodle_evidence_applications; linked bigint; result jsonb; changed boolean;
begin
  select * into p from public.practicas where id=p_id;
  if not found then return null; end if;
  select * into projection from private.moodle_evidence_projection where practica_id=p_id;
  if projection.active then
    select * into d from private.moodle_evidence_decisions where id=projection.decision_id;
    select * into v from private.moodle_evidence_versions where id=d.evidence_id;
    select * into c from private.moodle_evidence_cases where id=d.case_id;
    select * into latest from private.moodle_evidence_versions where case_id=c.id
      order by observed_at desc,received_at desc,id desc limit 1;
    select * into a from private.moodle_evidence_applications where id=projection.application_id;
    changed:=private.moodle_academic_fields_v1(p) is distinct from a.applied_academic;
    result:=to_jsonb(jsonb_populate_record(null::public.moodle_grade_snapshots,jsonb_build_object(
      'practica_id',p.id,'estudiante_id',p.estudiante_id,'lanzamiento_id',p.lanzamiento_id,
      'cmid',c.cmid,'task_status',case when d.grade is not null and not changed then 'graded' else 'submitted' end,
      'submitted',true,'grade_value',case when not changed then d.grade end,
      'grade_max',case when d.grade is not null and not changed then 10 end,
      'grade_display',case when not changed then d.grade::text end,
      'observed_at',v.observed_at,'received_at',v.received_at,'confidence','admin',
      'submitted_at',v.content->>'submittedAt','submitted_at_display',v.content->>'submittedAtDisplay',
      'feedback_comment',v.content->>'feedbackComment','graded_at_display',v.content->>'gradedAtDisplay',
      'last_observed_at',latest.observed_at,'last_task_status',latest.content->>'status',
      'scan_closed',true,'grade_revision',1,'attendance_evidence','needs_review')));
    return result || jsonb_build_object('grade_conversion_mode','direct_10',
      'reviewedAllocation',true,'applicationId',a.id,'evidenceId',v.id,
      'academicGrade',p.nota,'academicGradeSource',p.nota_fuente,
      'reviewRequired',changed or c.identity_conflict or
        exists(select 1 from private.moodle_evidence_decisions newer where newer.case_id=d.case_id
          and newer.practica_id=d.practica_id and newer.revision>d.revision) or
        private.moodle_evidence_meaning_v1(v.content) is distinct from private.moodle_evidence_meaning_v1(latest.content));
  end if;
  select coalesce(
    (select ae.moodle_id::bigint from public.practica_moodle_tareas l
      join public.aula_entregas ae on ae.id=l.aula_entrega_id
      where l.practica_id=p_id and l.validation_status='confirmed' and ae.course_id=3615 and ae.moodle_id ~ '^\d+$'
      order by l.created_at desc,l.id desc limit 1),
    (select ae.moodle_id::bigint from public.lanzamiento_moodle_tareas l
      join public.aula_entregas ae on ae.id=l.aula_entrega_id
      where l.lanzamiento_id=p.lanzamiento_id and l.validation_status='confirmed'
        and ae.course_id=3615 and ae.moodle_id ~ '^\d+$'
        and private.jefe_text_has_area(coalesce(p.especialidad,''),l.orientacion_key)
      order by l.created_at desc,l.id desc limit 1)) into linked;
  select to_jsonb(s)||jsonb_build_object('grade_conversion_mode',ae.grade_conversion_mode) into result
    from public.moodle_grade_snapshots s left join public.aula_entregas ae on ae.id=s.aula_entrega_id
    where s.practica_id=p_id and s.estudiante_id=p.estudiante_id
      and not exists(select 1 from private.moodle_evidence_applications x
        join private.moodle_evidence_decisions xd on xd.id=x.decision_id
        join private.moodle_evidence_cases xc on xc.id=xd.case_id
        where x.practica_id=p_id and x.action='revert' and xc.cmid=s.cmid)
    order by (s.cmid=linked and (s.task_status in ('submitted','graded') or s.submitted)) desc nulls last,
      (case when s.task_status='graded' then 3 when s.task_status='submitted' or s.submitted then 2
        when s.task_status='not_submitted' then 1 else 0 end) desc,
      (s.cmid=linked) desc nulls last,s.observed_at desc,s.cmid desc limit 1;
  return result || jsonb_build_object('academicGrade',p.nota,'academicGradeSource',p.nota_fuente);
end $$;
revoke all on function private.moodle_practice_snapshot_v1 from public,anon,authenticated;

create function private.read_moodle_practice_snapshots_v1(p_student uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare areas text[]; staff boolean; own_student boolean; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select exists(select 1 from public.estudiantes where id=p_student and user_id=auth.uid()) into own_student;
  select exists(select 1 from public.estudiantes where user_id=auth.uid()
    and role in ('SuperUser','AdminTester','Directivo')) into staff;
  if not staff and not own_student then areas:=private.require_jefe_areas_v1(); end if;
  select coalesce(jsonb_agg(s.value),'[]'::jsonb) into result from public.practicas p
    cross join lateral(select private.moodle_practice_snapshot_v1(p.id) value) s
    where p.estudiante_id=p_student and (staff or own_student or exists(select 1 from unnest(areas) area
      where private.jefe_text_has_area(coalesce(p.especialidad,''),area))) and s.value is not null;
  return result;
end $$;
create function public.read_moodle_practice_snapshots_v1(p_student uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.read_moodle_practice_snapshots_v1(p_student);
$$;
revoke all on function private.read_moodle_practice_snapshots_v1,public.read_moodle_practice_snapshots_v1 from public,anon;
grant execute on function private.read_moodle_practice_snapshots_v1,public.read_moodle_practice_snapshots_v1 to authenticated;

-- V1 remains a proposal-only API for old clients. V2 adds explicit application controls.
create function private.moodle_evidence_inbox_v2(p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  result:=private.moodle_evidence_inbox_v1(p_offset,p_limit);
  return jsonb_set(result,'{cases}',coalesce((select jsonb_agg(c || jsonb_build_object('practices',
    coalesce((select jsonb_agg(pr || jsonb_build_object('academic',private.moodle_academic_fields_v1(p),
      'applicationId',projection.application_id,'appliedDecisionId',case when projection.active then projection.decision_id end,
      'effectiveSnapshot',private.moodle_practice_snapshot_v1(p.id)))
      from jsonb_array_elements(c->'practices') pr join public.practicas p on p.id=(pr->>'id')::uuid
      left join private.moodle_evidence_projection projection on projection.practica_id=p.id),'[]'::jsonb),
    'applications',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from private.moodle_evidence_applications a join private.moodle_evidence_decisions d on d.id=a.decision_id
      where d.case_id=(c->>'id')::uuid),'[]'::jsonb)))
    from jsonb_array_elements(result->'cases') c),'[]'::jsonb)) || jsonb_build_object('mode','review_and_apply');
end $$;
create function public.moodle_evidence_inbox_v2(p_offset integer default 0,p_limit integer default 30) returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.moodle_evidence_inbox_v2(p_offset,p_limit);
$$;
revoke all on function private.moodle_evidence_inbox_v2,public.moodle_evidence_inbox_v2 from public,anon;
grant execute on function private.moodle_evidence_inbox_v2,public.moodle_evidence_inbox_v2 to authenticated;

-- Preserve raw observations but never let the automatic projection overwrite
-- a practice that coordination has taken over, including after a reversal.
do $patch$
declare source text;
begin
  select pg_get_functiondef('private.apply_moodle_grade_observation()'::regprocedure) into source;
  if position(E'begin\n  select a.grade_conversion_mode' in source)=0 then
    raise exception 'Unexpected observation projector definition';
  end if;
  source:=replace(source,E'begin\n  select a.grade_conversion_mode',
    E'begin\n  perform 1 from public.practicas where id=new.practica_id for update;\n  if exists(select 1 from private.moodle_evidence_projection where practica_id=new.practica_id) then return new; end if;\n  select a.grade_conversion_mode');
  execute source;
end $patch$;

CREATE OR REPLACE FUNCTION private.jefe_report_rows_v1(p_areas text[])
 RETURNS TABLE(practica_id uuid, estudiante_id uuid, student_name text, legajo text, lanzamiento_id uuid, pps_name text, institution_name text, orientation text, submitted boolean, submitted_at timestamp with time zone, deadline_at date, days_remaining integer, grade text, report_status text, urgency text, campus_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with direct_links as (
    select
      p.id as practica_id,
      p.estudiante_id,
      ae.moodle_id::bigint as cmid
    from public.practicas p
    join public.practica_moodle_tareas pm
      on pm.practica_id = p.id
     and pm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = pm.aula_entrega_id
     and ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
  ), launch_links as (
    select
      p.id as practica_id,
      p.estudiante_id,
      ae.moodle_id::bigint as cmid
    from public.practicas p
    join public.lanzamiento_moodle_tareas lm
      on lm.lanzamiento_id = p.lanzamiento_id
     and lm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = lm.aula_entrega_id
     and ae.course_id = 3615
     and ae.moodle_id ~ '^\d+$'
    where not exists (
      select 1
      from public.practica_moodle_tareas pm2
      where pm2.practica_id = p.id
        and pm2.validation_status = 'confirmed'
    )
  ), resolved_cmid as (
    select * from direct_links
    union all
    select * from launch_links
  ), superseded_practicas as (
    select distinct r.practica_id
    from resolved_cmid r
    join public.practicas p on p.id = r.practica_id
    where lower(coalesce(p.estado, '')) <> 'en curso'
      and exists (
        select 1
        from resolved_cmid other
        join public.practicas op on op.id = other.practica_id
        where other.estudiante_id = r.estudiante_id
          and other.cmid = r.cmid
          and other.practica_id <> r.practica_id
          and lower(coalesce(op.estado, '')) = 'en curso'
      )
  ), base as (
    select
      p.id as practica_id,
      p.estudiante_id,
      coalesce(nullif(trim(e.nombre), ''), 'Estudiante') as student_name,
      e.legajo,
      p.lanzamiento_id,
      coalesce(
        nullif(trim(l.nombre_pps), ''),
        nullif(trim(p.nombre_institucion), ''),
        'PPS'
      ) as pps_name,
      coalesce(
        nullif(trim(i.nombre), ''),
        nullif(trim(p.nombre_institucion), ''),
        nullif(trim(l.nombre_pps), ''),
        'Sin institución'
      ) as institution_name,
      coalesce(
        nullif(trim(p.especialidad), ''),
        nullif(trim(l.orientacion), ''),
        'No informada'
      ) as orientation,
      p.nota,
      p.informe_estado,
      s.grade_value,
      s.grade_display,
      s.cmid,
      linked_task.cmid as linked_cmid,
      -- Nota de Campus ya interpretada segun el contrato de escala de la tarea.
      private.read_moodle_grade_v1(s.grade_value, s.grade_max, s.grade_conversion_mode)
        as campus_grade,
      (
        s.grade_conversion_mode = 'pass_fail' and s.grade_value is not null
        or private.read_moodle_grade_v1(s.grade_value, s.grade_max, s.grade_conversion_mode)
             is not null
      ) as campus_graded,
      l.informe as launch_report_url,
      s.submitted_at,
      coalesce(s.submitted, false) as submitted,
      (sp.practica_id is not null) as superseded
    from public.practicas p
    left join public.estudiantes e on e.id = p.estudiante_id
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    left join public.instituciones i
      on i.id::text = coalesce(p.institucion_id::text, l.institucion_id)
    left join superseded_practicas sp on sp.practica_id = p.id
    left join lateral (
      select c0.*
      from public.convocatorias c0
      where c0.estudiante_id = p.estudiante_id
        and c0.lanzamiento_id = p.lanzamiento_id
      order by c0.created_at desc nulls last
      limit 1
    ) c on true
    left join lateral (
      select ss.*, raw.value->>'grade_conversion_mode' as grade_conversion_mode
      from (select private.moodle_practice_snapshot_v1(p.id) value) raw
      cross join lateral jsonb_populate_record(null::public.moodle_grade_snapshots,raw.value) ss
    ) s on true
    -- Tarea de Campus a la que apunta la práctica aunque todavía no haya
    -- ninguna lectura de Moodle. Es el único link que sirve justo cuando la
    -- jefatura necesita abrir la tarea: cuando no hay entrega observada.
    left join lateral (
      select coalesce(
        (
          select ae.moodle_id::bigint
          from public.practica_moodle_tareas pm
          join public.aula_entregas ae on ae.id = pm.aula_entrega_id
          where pm.practica_id = p.id
            and pm.validation_status = 'confirmed'
            and ae.course_id = 3615
            and ae.moodle_id ~ '^\d+$'
          order by ae.academic_year desc nulls last, ae.id
          limit 1
        ),
        (
          select ae.moodle_id::bigint
          from public.lanzamiento_moodle_tareas lm
          join public.aula_entregas ae on ae.id = lm.aula_entrega_id
          where lm.lanzamiento_id = p.lanzamiento_id
            and lm.validation_status = 'confirmed'
            and ae.course_id = 3615
            and ae.moodle_id ~ '^\d+$'
          order by
            private.jefe_text_has_area(
              coalesce(p.especialidad, l.orientacion), lm.orientacion_key
            ) desc,
            ae.academic_year desc nulls last,
            ae.id
          limit 1
        )
      ) as cmid
    ) linked_task on true
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and exists (
        select 1
        from unnest(p_areas) area_key
        where private.jefe_text_has_area(
          coalesce(p.especialidad, l.orientacion),
          area_key
        )
      )
  ), visible as (
    select
      b.*,
      (
        lower(coalesce(b.informe_estado, '')) = 'calificado'
        or coalesce(b.nota, '') ~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
        or lower(trim(coalesce(b.nota, ''))) = 'desaprobado'
        or b.campus_graded
      ) as graded
    from base b
    where not (b.superseded and b.submitted_at is null)
      or exists(select 1 from private.moodle_evidence_projection ep where ep.practica_id=b.practica_id and ep.active)
  ), classified as (
    select
      v.*,
      case
        when v.submitted_at is not null
          then (v.submitted_at at time zone 'America/Argentina/Buenos_Aires')::date + 30
        else null
      end as deadline_at
    from visible v
  ), statused as (
    select
      c.*,
      private.jefe_report_status_v1(
        c.graded,
        c.submitted,
        c.deadline_at,
        (now() at time zone 'America/Argentina/Buenos_Aires')::date
      ) as report_status
    from classified c
  )
  select
    s.practica_id,
    s.estudiante_id,
    s.student_name,
    s.legajo,
    s.lanzamiento_id,
    s.pps_name,
    s.institution_name,
    s.orientation,
    s.submitted,
    s.submitted_at,
    s.deadline_at,
    case
      when s.deadline_at is not null
        then s.deadline_at
          - (now() at time zone 'America/Argentina/Buenos_Aires')::date
      else null
    end as days_remaining,
    coalesce(
      case
        when trim(coalesce(s.nota, '')) ~ '^(10|[0-9])([.,][0-9]{1,2})?$'
          or lower(trim(coalesce(s.nota, ''))) in ('aprobado', 'desaprobado')
        then trim(s.nota)
      end,
      rtrim(rtrim(to_char(s.campus_grade, 'FM999999990.00'), '0'), '.'),
      nullif(trim(s.nota), ''),
      nullif(trim(s.grade_display), '')
    ) as grade,
    s.report_status,
    case
      when s.report_status <> 'pending' then s.report_status
      when s.deadline_at is null then 'undated'
      when s.deadline_at
        < (now() at time zone 'America/Argentina/Buenos_Aires')::date
        then 'critical'
      when s.deadline_at
        <= (now() at time zone 'America/Argentina/Buenos_Aires')::date + 7
        then 'soon'
      else 'on_time'
    end as urgency,
    coalesce(
      case
        when coalesce(s.cmid, s.linked_cmid) is not null
          then 'https://campus.uflo.edu.ar/mod/assign/view.php?id='
            || coalesce(s.cmid, s.linked_cmid)::text
      end,
      case
        when trim(coalesce(s.launch_report_url, '')) ~ '^https?://'
          then trim(s.launch_report_url)
      end
    ) as campus_url
  from statused s
  order by
    case s.report_status
      when 'pending' then 0
      when 'waiting' then 1
      when 'stale' then 2
      else 3
    end,
    s.deadline_at asc nulls last,
    s.student_name;
$function$;

commit;


