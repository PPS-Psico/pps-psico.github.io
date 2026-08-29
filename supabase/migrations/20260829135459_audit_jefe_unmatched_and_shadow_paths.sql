begin;

-- Las filas internas que Moodle devuelve pero no pueden vincularse se
-- conservan como diagnóstico mínimo. No se guardan DNI, nombres, correos,
-- nombres de archivos ni documentos.
create table if not exists private.moodle_jefe_unmatched_diagnostics (
  id bigint generated always as identity primary key,
  request_id uuid not null
    references public.moodle_sync_runs(request_id) on delete cascade,
  observed_at timestamptz not null,
  academic_year integer not null,
  course_id bigint not null,
  preview_key uuid,
  area_keys text[] not null default '{}',
  cmid bigint not null,
  estudiante_id uuid not null
    references public.estudiantes(id) on delete cascade,
  reason text not null check (
    reason in (
      'no_practice_in_area',
      'practice_without_confirmed_task_link',
      'task_mismatch'
    )
  ),
  practice_count integer not null default 0 check (practice_count >= 0),
  linked_task_count integer not null default 0 check (linked_task_count >= 0),
  created_at timestamptz not null default now(),
  unique (request_id, cmid, estudiante_id)
);

alter table private.moodle_jefe_unmatched_diagnostics enable row level security;
revoke all on table private.moodle_jefe_unmatched_diagnostics
  from public, anon, authenticated;
revoke all on sequence private.moodle_jefe_unmatched_diagnostics_id_seq
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.moodle_jefe_unmatched_diagnostics to service_role;
grant usage, select
  on sequence private.moodle_jefe_unmatched_diagnostics_id_seq to service_role;

create index if not exists moodle_jefe_unmatched_student_observed_idx
  on private.moodle_jefe_unmatched_diagnostics (estudiante_id, observed_at desc);

create index if not exists moodle_jefe_unmatched_reason_observed_idx
  on private.moodle_jefe_unmatched_diagnostics (reason, observed_at desc);

comment on table private.moodle_jefe_unmatched_diagnostics is
  'Diagnóstico privado y sin DNI de filas internas devueltas por Moodle que no encontraron una PPS/tarea compatible.';

-- El barrido mantiene el detalle privado y sólo devuelve contadores agregados
-- al cliente. El parche aborta si la función viva no coincide con el contrato
-- esperado para evitar reemplazos silenciosos sobre una versión desconocida.
do $patch$
declare
  v_src text;
begin
  select pg_get_functiondef(
    'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure
  ) into v_src;

  if position('v_unmatched_reasons jsonb' in v_src) = 0 then
    if position('  v_unmatched_external integer := 0;' in v_src) = 0 then
      raise exception 'No se encontró la declaración de unmatched externo del barrido Moodle';
    end if;
    v_src := replace(
      v_src,
      '  v_unmatched_external integer := 0;',
      '  v_unmatched_external integer := 0;' || chr(10)
        || '  v_unmatched_reasons jsonb := ''{}''::jsonb;'
    );
  end if;

  if position('unmatched_diagnostics as (' in v_src) = 0 then
    if position($old$  ), inserted as (
    insert into public.moodle_grade_observations (
$old$ in v_src) = 0 then
      raise exception 'No se encontró el ancla de inserción de observaciones Moodle';
    end if;

    v_src := replace(v_src, $old$  ), inserted as (
    insert into public.moodle_grade_observations (
$old$, $new$  ), unmatched_diagnostics as (
    insert into private.moodle_jefe_unmatched_diagnostics (
      request_id,
      observed_at,
      academic_year,
      course_id,
      preview_key,
      area_keys,
      cmid,
      estudiante_id,
      reason,
      practice_count,
      linked_task_count
    )
    select
      p_request_id,
      p_observed_at,
      p_academic_year,
      p_course_id,
      p_preview_key,
      v_areas,
      c.cmid,
      matched_student.id,
      case
        when not exists (
          select 1
          from practice_scope ps
          where ps.student_dni = c.student_dni
        ) then 'no_practice_in_area'
        when exists (
          select 1
          from candidates candidate
          where candidate.student_dni = c.student_dni
        ) then 'task_mismatch'
        else 'practice_without_confirmed_task_link'
      end,
      (
        select count(distinct ps.practica_id)::integer
        from practice_scope ps
        where ps.student_dni = c.student_dni
      ),
      (
        select count(distinct candidate.cmid)::integer
        from candidates candidate
        where candidate.student_dni = c.student_dni
      )
    from classified c
    cross join lateral (
      select e.id
      from public.estudiantes e
      where regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') = c.student_dni
      order by e.created_at desc nulls last, e.id
      limit 1
    ) matched_student
    where coalesce(c.candidate_count, 0) = 0
    on conflict (request_id, cmid, estudiante_id) do update set
      observed_at = excluded.observed_at,
      academic_year = excluded.academic_year,
      course_id = excluded.course_id,
      preview_key = excluded.preview_key,
      area_keys = excluded.area_keys,
      reason = excluded.reason,
      practice_count = excluded.practice_count,
      linked_task_count = excluded.linked_task_count
    returning reason
  ), inserted as (
    insert into public.moodle_grade_observations (
$new$);
  end if;

  if position('jsonb_object_agg(reason, reason_count)' in v_src) = 0 then
    if position($old$    count(*) filter (
      where c.practica_id is not null and c.fully_valid and c.candidate_count > 1
    )::integer
  into
$old$ in v_src) = 0 then
      raise exception 'No se encontró el ancla de contadores del barrido Moodle';
    end if;

    v_src := replace(v_src, $old$    count(*) filter (
      where c.practica_id is not null and c.fully_valid and c.candidate_count > 1
    )::integer
  into
$old$, $new$    count(*) filter (
      where c.practica_id is not null and c.fully_valid and c.candidate_count > 1
    )::integer,
    coalesce((
      select jsonb_object_agg(reason, reason_count)
      from (
        select reason, count(*)::integer as reason_count
        from unmatched_diagnostics
        group by reason
      ) reasons
    ), '{}'::jsonb)
  into
$new$);

    if position($old$    v_unmatched_external,
    v_deduplicated
    from classified c;
$old$ in v_src) = 0 then
      raise exception 'No se encontró el ancla INTO del barrido Moodle';
    end if;

    v_src := replace(v_src, $old$    v_unmatched_external,
    v_deduplicated
    from classified c;
$old$, $new$    v_unmatched_external,
    v_deduplicated,
    v_unmatched_reasons
    from classified c;
$new$);
  end if;

  if position('''unmatched_reasons'', v_unmatched_reasons' in v_src) = 0 then
    if position('    ''unmatched_external'', v_unmatched_external,' in v_src) = 0 then
      raise exception 'No se encontró el resultado de unmatched externo';
    end if;
    v_src := replace(
      v_src,
      '    ''unmatched_external'', v_unmatched_external,',
      '    ''unmatched_external'', v_unmatched_external,' || chr(10)
        || '    ''unmatched_reasons'', v_unmatched_reasons,'
    );
  end if;

  execute v_src;
end;
$patch$;

-- Evaluador puro de auditoría. Replica el contrato del evaluador operativo,
-- pero nunca inserta finalizaciones ni eventos y tampoco altera evaluaciones.
-- Permite probar perfiles ya acreditados sin tocar su historial.
create or replace function private.assess_student_accreditation_v1(
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_threshold numeric := 0.900;
  v_total_required numeric := 250;
  v_specialty_required numeric := 70;
  v_rotation_required integer := 3;
  v_selected_orientation text;
  v_practice_count integer := 0;
  v_total_hours numeric := 0;
  v_specialty_hours numeric := 0;
  v_rotation_count integer := 0;
  v_has_active boolean := false;
  v_all_reports_approved boolean := false;
  v_academic_ready boolean := false;
  v_documentation_ready boolean := false;
  v_already_started boolean := false;
  v_requirement_gaps text[] := '{}';
  v_uncertain_ids uuid[] := '{}';
  v_predicted_outcome text;
begin
  if p_student_id is null then
    raise exception 'student_id is required' using errcode = '22023';
  end if;

  select
    coalesce(c.moodle_attendance_auto_threshold, 0.900),
    coalesce(c.horas_objetivo_total, 250),
    coalesce(c.horas_objetivo_orientacion, 70),
    coalesce(c.rotacion_objetivo, 3)::integer
  into v_threshold, v_total_required, v_specialty_required, v_rotation_required
  from public.app_config c
  order by c.id
  limit 1;

  v_threshold := coalesce(v_threshold, 0.900);
  v_total_required := coalesce(v_total_required, 250);
  v_specialty_required := coalesce(v_specialty_required, 70);
  v_rotation_required := coalesce(v_rotation_required, 3);

  select private.moodle_orientation_key(e.orientacion_elegida)
  into v_selected_orientation
  from public.estudiantes e
  where e.id = p_student_id;

  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.finalizacion_pps f where f.estudiante_id = p_student_id
  ) into v_already_started;

  with eligible_practices as (
    select
      p.*,
      private.moodle_orientation_key(p.especialidad) as orientation_key,
      translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun') as normalized_state
    from public.practicas p
    where p.estudiante_id = p_student_id
      and translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun')
        not in (
          'desaprobada', 'desaprobado', 'no se pudo concretar',
          'cancelada', 'cancelado', 'abandonada', 'abandonado'
        )
  )
  select
    count(*),
    coalesce(sum(coalesce(p.horas_realizadas, 0)), 0),
    coalesce(sum(coalesce(p.horas_realizadas, 0))
      filter (where p.orientation_key = v_selected_orientation), 0),
    count(distinct p.orientation_key) filter (where p.orientation_key is not null),
    coalesce(bool_or(p.normalized_state in ('en curso', 'pendiente', 'en proceso')), false),
    coalesce(bool_and(coalesce(p.informe_estado = 'calificado', false)), false)
  into
    v_practice_count,
    v_total_hours,
    v_specialty_hours,
    v_rotation_count,
    v_has_active,
    v_all_reports_approved
  from eligible_practices p;

  if v_total_hours < v_total_required then
    v_requirement_gaps := array_append(v_requirement_gaps, 'total_hours');
  end if;
  if v_selected_orientation is null or v_specialty_hours < v_specialty_required then
    v_requirement_gaps := array_append(v_requirement_gaps, 'specialty_hours');
  end if;
  if v_rotation_count < v_rotation_required then
    v_requirement_gaps := array_append(v_requirement_gaps, 'rotation');
  end if;
  if v_has_active then
    v_requirement_gaps := array_append(v_requirement_gaps, 'active_practices');
  end if;
  v_academic_ready := cardinality(v_requirement_gaps) = 0;

  with eligible_practices as (
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
      s.attendance_confidence
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
      ) as documentation_safe
    from evidence_counted c
  )
  select
    coalesce(
      array_agg(e.id order by e.fecha_inicio, e.id)
        filter (where not coalesce(e.documentation_safe, false)),
      '{}'::uuid[]
    ),
    coalesce(bool_and(coalesce(e.documentation_safe, false)), false)
  into v_uncertain_ids, v_documentation_ready
  from evidence e;

  v_predicted_outcome := case
    when v_practice_count = 0 or not v_all_reports_approved then 'reports_pending'
    when v_academic_ready and v_documentation_ready then 'auto_started'
    when v_academic_ready then 'manual_required'
    else 'requirements_pending'
  end;

  return jsonb_build_object(
    'assessmentVersion', 'accreditation-readiness/v1',
    'predictedOutcome', v_predicted_outcome,
    'alreadyStarted', v_already_started,
    'reportsApproved', v_all_reports_approved,
    'academicReady', v_academic_ready,
    'documentationReady', v_documentation_ready,
    'requirementGaps', to_jsonb(v_requirement_gaps),
    'uncertainPracticeIds', to_jsonb(v_uncertain_ids),
    'practiceCount', v_practice_count,
    'totalHours', v_total_hours,
    'specialtyHours', v_specialty_hours,
    'rotationCount', v_rotation_count,
    'attendanceThreshold', v_threshold
  );
end;
$$;

revoke all on function private.assess_student_accreditation_v1(uuid)
  from public, anon, authenticated;
grant execute on function private.assess_student_accreditation_v1(uuid)
  to service_role;

comment on function private.assess_student_accreditation_v1(uuid) is
  'Simula sin escrituras el resultado híbrido para auditoría, incluso si el estudiante ya inició una acreditación.';

commit;
