begin;

-- Una lista de adjuntos perteneciente a una tarea compartida no demuestra que
-- cada PPS presencial tenga su propia planilla. El evaluador central vuelve
-- inciertas todas las prácticas presenciales que comparten el mismo cmid.
do $patch$
declare
  v_src text;
begin
  select pg_get_functiondef(
    'private.evaluate_student_accreditation_transition_v1(uuid,uuid)'::regprocedure
  ) into v_src;

  if position('onsite_task_practice_count' in v_src) = 0 then
    if position($old$  with eligible_practices as (
    select p.*
    from public.practicas p
    where p.estudiante_id = p_student_id
      and translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun')
        not in (
          'desaprobada', 'desaprobado', 'no se pudo concretar',
          'cancelada', 'cancelado', 'abandonada', 'abandonado'
        )
  ), evidence as (
    select
      p.*,
      s.cmid,
      s.attendance_evidence,
      s.attendance_confidence,
      s.submission_file_count,
      s.submission_logical_file_count,
      s.submission_classifier_version,
      (
        p.es_online
        or (
          s.attendance_evidence in ('detected', 'assumed')
          and coalesce(s.attendance_confidence, 0) >= v_threshold
        )
      ) as documentation_safe
    from eligible_practices p
    left join lateral (
      select snapshot.*
      from public.moodle_grade_snapshots snapshot
      where snapshot.practica_id = p.id
      order by
        (snapshot.cmid = p.nota_moodle_cmid) desc,
        snapshot.observed_at desc
      limit 1
    ) s on true
  )
$old$ in v_src) = 0 then
      raise exception 'No se encontró el bloque de evidencia del evaluador híbrido';
    end if;

    v_src := replace(v_src, $old$  with eligible_practices as (
    select p.*
    from public.practicas p
    where p.estudiante_id = p_student_id
      and translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun')
        not in (
          'desaprobada', 'desaprobado', 'no se pudo concretar',
          'cancelada', 'cancelado', 'abandonada', 'abandonado'
        )
  ), evidence as (
    select
      p.*,
      s.cmid,
      s.attendance_evidence,
      s.attendance_confidence,
      s.submission_file_count,
      s.submission_logical_file_count,
      s.submission_classifier_version,
      (
        p.es_online
        or (
          s.attendance_evidence in ('detected', 'assumed')
          and coalesce(s.attendance_confidence, 0) >= v_threshold
        )
      ) as documentation_safe
    from eligible_practices p
    left join lateral (
      select snapshot.*
      from public.moodle_grade_snapshots snapshot
      where snapshot.practica_id = p.id
      order by
        (snapshot.cmid = p.nota_moodle_cmid) desc,
        snapshot.observed_at desc
      limit 1
    ) s on true
  )
$old$, $new$  with eligible_practices as (
    select p.*
    from public.practicas p
    where p.estudiante_id = p_student_id
      and translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun')
        not in (
          'desaprobada', 'desaprobado', 'no se pudo concretar',
          'cancelada', 'cancelado', 'abandonada', 'abandonado'
        )
  ), evidence_base as (
    select
      p.*,
      coalesce(s.cmid, p.nota_moodle_cmid) as cmid,
      s.attendance_evidence,
      s.attendance_confidence,
      s.submission_file_count,
      s.submission_logical_file_count,
      s.submission_classifier_version
    from eligible_practices p
    left join lateral (
      select snapshot.*
      from public.moodle_grade_snapshots snapshot
      where snapshot.practica_id = p.id
      order by
        (snapshot.cmid = p.nota_moodle_cmid) desc,
        snapshot.observed_at desc
      limit 1
    ) s on true
  ), evidence_counted as (
    select
      b.*,
      count(*) filter (where not coalesce(b.es_online, false))
        over (partition by b.cmid) as onsite_task_practice_count
    from evidence_base b
  ), evidence as (
    select
      c.*,
      (
        coalesce(c.es_online, false)
        or (
          c.onsite_task_practice_count = 1
          and c.attendance_evidence in ('detected', 'assumed')
          and coalesce(c.attendance_confidence, 0) >= v_threshold
        )
      ) as documentation_safe,
      (
        not coalesce(c.es_online, false)
        and c.onsite_task_practice_count > 1
      ) as shared_onsite_task
    from evidence_counted c
  )
$new$);

    if position($old$        'attendanceEvidence', case when e.es_online then 'not_required'
          else coalesce(e.attendance_evidence, 'needs_review') end,
        'attendanceConfidence', case when e.es_online then 1
          else coalesce(e.attendance_confidence, 0) end,
$old$ in v_src) = 0 then
      raise exception 'No se encontró la evidencia serializada del evaluador híbrido';
    end if;

    v_src := replace(v_src, $old$        'attendanceEvidence', case when e.es_online then 'not_required'
          else coalesce(e.attendance_evidence, 'needs_review') end,
        'attendanceConfidence', case when e.es_online then 1
          else coalesce(e.attendance_confidence, 0) end,
$old$, $new$        'attendanceEvidence', case
          when e.es_online then 'not_required'
          when e.shared_onsite_task then 'needs_review'
          else coalesce(e.attendance_evidence, 'needs_review')
        end,
        'attendanceConfidence', case
          when e.es_online then 1
          when e.shared_onsite_task then 0
          else coalesce(e.attendance_confidence, 0)
        end,
$new$);

    if position($old$        'classifierVersion', e.submission_classifier_version,
        'automatic', coalesce(e.documentation_safe, false)
$old$ in v_src) = 0 then
      raise exception 'No se encontró el snapshot documental del evaluador híbrido';
    end if;

    v_src := replace(v_src, $old$        'classifierVersion', e.submission_classifier_version,
        'automatic', coalesce(e.documentation_safe, false)
$old$, $new$        'classifierVersion', e.submission_classifier_version,
        'sharedTask', e.shared_onsite_task,
        'taskPracticeCount', e.onsite_task_practice_count,
        'automatic', coalesce(e.documentation_safe, false)
$new$);

    execute v_src;
  end if;
end;
$patch$;

-- El barrido anual inserta observaciones y snapshots en una misma sentencia.
-- Este trigger de transición se ejecuta al final de esa sentencia, cuando la
-- evidencia ya es visible, y no interfiere con la ingesta estudiantil que hace
-- su evaluación explícita después del upsert de snapshots.
create or replace function private.evaluate_accreditation_after_jefe_observation_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
begin
  for v_candidate in
    select distinct on (n.estudiante_id)
      n.estudiante_id,
      n.id as observation_id
    from new_jefe_grade_observations n
    where n.parser_version = 'assignment-grading-table/v2'
      and n.task_status = 'graded'
    order by n.estudiante_id, n.observed_at desc, n.received_at desc, n.id desc
  loop
    begin
      perform private.evaluate_student_accreditation_transition_v1(
        v_candidate.estudiante_id,
        v_candidate.observation_id
      );
    exception when others then
      raise warning 'jefe accreditation evaluation failed for observation %: %',
        v_candidate.observation_id,
        sqlerrm;
    end;
  end loop;
  return null;
end;
$$;

revoke all on function private.evaluate_accreditation_after_jefe_observation_v1()
  from public, anon, authenticated;

drop trigger if exists evaluate_accreditation_after_jefe_observation_trigger
  on public.moodle_grade_observations;
create trigger evaluate_accreditation_after_jefe_observation_trigger
after insert on public.moodle_grade_observations
referencing new table as new_jefe_grade_observations
for each statement
execute function private.evaluate_accreditation_after_jefe_observation_v1();

-- Operación repetible para recalcular en shadow la evidencia que ya había sido
-- observada antes de instalar el trigger. Se niega a correr en active para no
-- convertir un backfill administrativo en un lanzamiento masivo accidental.
create or replace function private.backfill_moodle_accreditation_evaluations_v1(
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_result jsonb;
  v_key text;
  v_processed integer := 0;
  v_failed integer := 0;
  v_outcomes jsonb := '{}'::jsonb;
  v_mode text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit must be between 1 and 5000' using errcode = '22023';
  end if;

  select coalesce(accreditation_automation_mode, 'shadow')
    into v_mode
  from public.app_config
  order by id
  limit 1;
  if coalesce(v_mode, 'shadow') <> 'shadow' then
    raise exception 'accreditation backfill is allowed only in shadow mode'
      using errcode = '55000';
  end if;

  for v_candidate in
    select candidate.estudiante_id, candidate.observation_id
    from (
      select distinct on (o.estudiante_id)
        o.estudiante_id,
        o.id as observation_id,
        o.observed_at
      from public.moodle_grade_observations o
      where o.task_status = 'graded'
        and o.submission_classifier_version is not null
        and not exists (
          select 1
          from public.finalizacion_pps f
          where f.estudiante_id = o.estudiante_id
        )
        and exists (
          select 1
          from public.practicas p
          where p.estudiante_id = o.estudiante_id
            and translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun')
              not in (
                'desaprobada', 'desaprobado', 'no se pudo concretar',
                'cancelada', 'cancelado', 'abandonada', 'abandonado'
              )
        )
        and not exists (
          select 1
          from public.practicas p
          where p.estudiante_id = o.estudiante_id
            and translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun')
              not in (
                'desaprobada', 'desaprobado', 'no se pudo concretar',
                'cancelada', 'cancelado', 'abandonada', 'abandonado'
              )
            and coalesce(p.informe_estado = 'calificado', false) = false
        )
      order by o.estudiante_id, o.observed_at desc, o.received_at desc, o.id desc
    ) candidate
    order by candidate.observed_at desc
    limit p_limit
  loop
    begin
      v_result := private.evaluate_student_accreditation_transition_v1(
        v_candidate.estudiante_id,
        v_candidate.observation_id
      );
      v_key := coalesce(v_result ->> 'predictedOutcome', v_result ->> 'status', 'unknown');
      v_outcomes := v_outcomes || jsonb_build_object(
        v_key,
        coalesce((v_outcomes ->> v_key)::integer, 0) + 1
      );
      v_processed := v_processed + 1;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'mode', v_mode,
    'processed', v_processed,
    'failed', v_failed,
    'outcomes', v_outcomes
  );
end;
$$;

revoke all on function private.backfill_moodle_accreditation_evaluations_v1(integer)
  from public, anon, authenticated;
grant execute on function private.backfill_moodle_accreditation_evaluations_v1(integer)
  to service_role;

comment on function private.backfill_moodle_accreditation_evaluations_v1(integer) is
  'Reevalúa en modo shadow las observaciones calificadas que ya tienen evidencia de adjuntos. Nunca activa trámites.';

commit;
