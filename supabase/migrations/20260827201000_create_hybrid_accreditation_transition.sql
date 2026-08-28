begin;

-- El rollout comienza en sombra. Cambiar a `active` es una decisión operativa
-- posterior al piloto; el código de evaluación puede medirse sin crear trámites
-- ni mostrar mensajes al estudiante.
alter table public.app_config
  add column if not exists accreditation_automation_mode text not null default 'shadow',
  add column if not exists moodle_attendance_auto_threshold numeric(4,3) not null default 0.900;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.app_config'::regclass
      and conname = 'app_config_accreditation_automation_mode_check'
  ) then
    alter table public.app_config
      add constraint app_config_accreditation_automation_mode_check
      check (accreditation_automation_mode in ('off', 'shadow', 'active'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.app_config'::regclass
      and conname = 'app_config_moodle_attendance_threshold_check'
  ) then
    alter table public.app_config
      add constraint app_config_moodle_attendance_threshold_check
      check (moodle_attendance_auto_threshold between 0.500 and 1.000);
  end if;
end;
$$;

comment on column public.app_config.accreditation_automation_mode is
  'off: no evalúa; shadow: registra predicción sin efectos; active: crea transición híbrida o trámite automático.';
comment on column public.app_config.moodle_attendance_auto_threshold is
  'Confianza mínima para aceptar attendance_evidence detected/assumed en el inicio automático.';

alter table public.finalizacion_pps
  add column if not exists origen text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.finalizacion_pps'::regclass
      and conname = 'finalizacion_pps_origen_check'
  ) then
    alter table public.finalizacion_pps
      add constraint finalizacion_pps_origen_check
      check (origen in ('manual', 'moodle_assisted', 'moodle_automatic'));
  end if;
end;
$$;

comment on column public.finalizacion_pps.origen is
  'manual: flujo histórico; moodle_assisted: alumno completó sólo faltantes; moodle_automatic: documentación verificada en Campus.';

create table if not exists public.accreditation_transition_events (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  trigger_practica_id uuid not null references public.practicas(id) on delete cascade,
  trigger_observation_id uuid not null references public.moodle_grade_observations(id) on delete cascade,
  outcome text not null
    check (outcome in ('auto_started', 'manual_required', 'requirements_pending')),
  finalizacion_id uuid references public.finalizacion_pps(id) on delete set null,
  uncertain_practice_ids uuid[] not null default '{}',
  requirement_gaps text[] not null default '{}',
  documentation_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(documentation_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique (estudiante_id),
  unique (trigger_observation_id)
);

comment on table public.accreditation_transition_events is
  'Transición única que se muestra al aprobarse el último informe: trámite automático o apertura asistida de faltantes.';
comment on column public.accreditation_transition_events.uncertain_practice_ids is
  'PPS cuyas planillas no alcanzaron evidencia automática; el formulario sólo pide documentación para estas filas.';
comment on column public.accreditation_transition_events.acknowledged_at is
  'Evita repetir el cartel de felicitación después de que el estudiante actuó.';

create index if not exists accreditation_transition_events_student_pending_idx
  on public.accreditation_transition_events (estudiante_id, created_at desc)
  where acknowledged_at is null;

create index if not exists accreditation_transition_events_practice_idx
  on public.accreditation_transition_events (trigger_practica_id);

create index if not exists accreditation_transition_events_finalization_idx
  on public.accreditation_transition_events (finalizacion_id)
  where finalizacion_id is not null;

alter table public.accreditation_transition_events enable row level security;
revoke all on table public.accreditation_transition_events from anon, authenticated;
grant select on table public.accreditation_transition_events to authenticated;
grant update (acknowledged_at) on table public.accreditation_transition_events to authenticated;
grant select, insert, update, delete on table public.accreditation_transition_events to service_role;

create policy "Students read own accreditation transition"
  on public.accreditation_transition_events
  for select to authenticated
  using (
    exists (
      select 1 from public.estudiantes e
      where e.id = estudiante_id and e.user_id = (select auth.uid())
    )
  );

create policy "Admins read accreditation transitions"
  on public.accreditation_transition_events
  for select to authenticated
  using ((select public.is_admin()));

create policy "Students acknowledge own accreditation transition"
  on public.accreditation_transition_events
  for update to authenticated
  using (
    exists (
      select 1 from public.estudiantes e
      where e.id = estudiante_id and e.user_id = (select auth.uid())
    )
  )
  with check (
    acknowledged_at is not null
    and
    exists (
      select 1 from public.estudiantes e
      where e.id = estudiante_id and e.user_id = (select auth.uid())
    )
  );

create table if not exists private.accreditation_automation_evaluations (
  id bigint generated by default as identity primary key,
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  trigger_practica_id uuid not null references public.practicas(id) on delete cascade,
  trigger_observation_id uuid not null references public.moodle_grade_observations(id) on delete cascade,
  automation_mode text not null check (automation_mode in ('shadow', 'active')),
  predicted_outcome text not null
    check (predicted_outcome in ('auto_started', 'manual_required', 'requirements_pending')),
  academic_ready boolean not null,
  documentation_ready boolean not null,
  uncertain_practice_ids uuid[] not null default '{}',
  requirement_gaps text[] not null default '{}',
  documentation_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(documentation_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (trigger_observation_id)
);

alter table private.accreditation_automation_evaluations enable row level security;
revoke all on table private.accreditation_automation_evaluations
  from public, anon, authenticated;
grant select, insert, update, delete on table private.accreditation_automation_evaluations
  to service_role;

create index if not exists accreditation_automation_evaluations_student_created_idx
  on private.accreditation_automation_evaluations (estudiante_id, created_at desc);

create index if not exists accreditation_automation_evaluations_practice_idx
  on private.accreditation_automation_evaluations (trigger_practica_id);

comment on table private.accreditation_automation_evaluations is
  'Auditoría del modo sombra/activo. No contiene nombres de archivos ni documentos y no se expone por PostgREST.';

create or replace function private.evaluate_student_accreditation_transition_v1(
  p_student_id uuid,
  p_trigger_observation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := 'shadow';
  v_threshold numeric := 0.900;
  v_total_required numeric := 250;
  v_specialty_required numeric := 70;
  v_rotation_required integer := 3;
  v_trigger_practice_id uuid;
  v_selected_orientation text;
  v_practice_count integer := 0;
  v_total_hours numeric := 0;
  v_specialty_hours numeric := 0;
  v_rotation_count integer := 0;
  v_has_active boolean := false;
  v_all_reports_approved boolean := false;
  v_academic_ready boolean := false;
  v_documentation_ready boolean := false;
  v_requirement_gaps text[] := '{}';
  v_uncertain_ids uuid[] := '{}';
  v_documentation_items jsonb := '[]'::jsonb;
  v_detail_items jsonb := '[]'::jsonb;
  v_documentation_snapshot jsonb := '{}'::jsonb;
  v_predicted_outcome text;
  v_finalizacion_id uuid;
  v_event_id uuid;
begin
  if p_student_id is null or p_trigger_observation_id is null then
    raise exception 'student_id and trigger_observation_id are required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text, 0));

  select o.practica_id
    into v_trigger_practice_id
  from public.moodle_grade_observations o
  where o.id = p_trigger_observation_id
    and o.estudiante_id = p_student_id
    and o.task_status = 'graded';

  if v_trigger_practice_id is null then
    raise exception 'The trigger is not a graded observation for this student'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.finalizacion_pps f where f.estudiante_id = p_student_id
  ) then
    return jsonb_build_object('status', 'already_started');
  end if;

  select
    coalesce(c.accreditation_automation_mode, 'shadow'),
    coalesce(c.moodle_attendance_auto_threshold, 0.900),
    coalesce(c.horas_objetivo_total, 250),
    coalesce(c.horas_objetivo_orientacion, 70),
    coalesce(c.rotacion_objetivo, 3)::integer
  into v_mode, v_threshold, v_total_required, v_specialty_required, v_rotation_required
  from public.app_config c
  order by c.id
  limit 1;

  -- Conserva defaults seguros incluso si una restauración deja app_config vacío.
  v_mode := coalesce(v_mode, 'shadow');
  v_threshold := coalesce(v_threshold, 0.900);
  v_total_required := coalesce(v_total_required, 250);
  v_specialty_required := coalesce(v_specialty_required, 70);
  v_rotation_required := coalesce(v_rotation_required, 3);

  if v_mode = 'off' then
    return jsonb_build_object('status', 'off');
  end if;

  select private.moodle_orientation_key(e.orientacion_elegida)
    into v_selected_orientation
  from public.estudiantes e
  where e.id = p_student_id;

  with eligible_practices as (
    select p.*,
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
    coalesce(bool_and(p.informe_estado = 'calificado'), false)
  into
    v_practice_count,
    v_total_hours,
    v_specialty_hours,
    v_rotation_count,
    v_has_active,
    v_all_reports_approved
  from eligible_practices p;

  -- El evento sólo nace cuando la observación recién llegada completa el
  -- conjunto de informes aprobados. Antes de eso no hay felicitación final.
  if v_practice_count = 0 or not v_all_reports_approved then
    return jsonb_build_object('status', 'reports_pending');
  end if;

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
  select
    coalesce(
      array_agg(e.id order by e.fecha_inicio, e.id)
        filter (where not coalesce(e.documentation_safe, false)),
      '{}'::uuid[]
    ),
    coalesce(bool_and(coalesce(e.documentation_safe, false)), false),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'practicaId', e.id,
        'esOnline', e.es_online,
        'cmid', e.cmid,
        'reportEvidence', 'graded',
        'attendanceEvidence', case when e.es_online then 'not_required'
          else coalesce(e.attendance_evidence, 'needs_review') end,
        'attendanceConfidence', case when e.es_online then 1
          else coalesce(e.attendance_confidence, 0) end,
        'fileCount', e.submission_file_count,
        'logicalFileCount', e.submission_logical_file_count,
        'classifierVersion', e.submission_classifier_version,
        'automatic', coalesce(e.documentation_safe, false)
      ) order by e.fecha_inicio, e.id
    ), '[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'practicaId', e.id,
        'nombre', coalesce(nullif(trim(e.nombre_institucion), ''), 'PPS'),
        'especialidad', e.especialidad,
        'horas', coalesce(e.horas_realizadas, 0),
        'fechaInicio', e.fecha_inicio,
        'fechaFinalizacion', e.fecha_finalizacion,
        'esOnline', e.es_online,
        'nota', '',
        'informe', jsonb_build_object(
          'source', 'moodle', 'cmid', e.cmid, 'evidence', 'graded'
        ),
        'asistencia', case
          when e.es_online then null
          when coalesce(e.documentation_safe, false) then jsonb_build_object(
            'source', 'moodle',
            'cmid', e.cmid,
            'evidence', e.attendance_evidence,
            'confidence', e.attendance_confidence,
            'fileCount', e.submission_file_count,
            'logicalFileCount', e.submission_logical_file_count
          )
          else null
        end,
        'documentation', jsonb_build_object(
          'report', 'verified',
          'attendance', case when e.es_online then 'not_required'
            when coalesce(e.documentation_safe, false) then 'verified'
            else 'required' end
        )
      ) order by e.fecha_inicio, e.id
    ), '[]'::jsonb)
  into v_uncertain_ids, v_documentation_ready, v_documentation_items, v_detail_items
  from evidence e;

  v_documentation_snapshot := jsonb_build_object(
    'version', 'moodle-submission-evidence/v1',
    'threshold', v_threshold,
    'items', v_documentation_items
  );

  v_predicted_outcome := case
    when v_academic_ready and v_documentation_ready then 'auto_started'
    when v_academic_ready then 'manual_required'
    else 'requirements_pending'
  end;

  insert into private.accreditation_automation_evaluations (
    estudiante_id,
    trigger_practica_id,
    trigger_observation_id,
    automation_mode,
    predicted_outcome,
    academic_ready,
    documentation_ready,
    uncertain_practice_ids,
    requirement_gaps,
    documentation_snapshot
  ) values (
    p_student_id,
    v_trigger_practice_id,
    p_trigger_observation_id,
    v_mode,
    v_predicted_outcome,
    v_academic_ready,
    v_documentation_ready,
    v_uncertain_ids,
    v_requirement_gaps,
    v_documentation_snapshot
  )
  on conflict (trigger_observation_id) do update set
    automation_mode = excluded.automation_mode,
    predicted_outcome = excluded.predicted_outcome,
    academic_ready = excluded.academic_ready,
    documentation_ready = excluded.documentation_ready,
    uncertain_practice_ids = excluded.uncertain_practice_ids,
    requirement_gaps = excluded.requirement_gaps,
    documentation_snapshot = excluded.documentation_snapshot;

  if v_mode = 'shadow' then
    return jsonb_build_object(
      'status', 'shadow',
      'predictedOutcome', v_predicted_outcome,
      'academicReady', v_academic_ready,
      'documentationReady', v_documentation_ready,
      'uncertainPracticeIds', to_jsonb(v_uncertain_ids),
      'requirementGaps', to_jsonb(v_requirement_gaps)
    );
  end if;

  if v_predicted_outcome = 'auto_started' then
    insert into public.finalizacion_pps (
      estudiante_id,
      fecha_solicitud,
      estado,
      informe_final_url,
      planilla_horas_url,
      planilla_asistencia_url,
      sugerencias_mejoras,
      detalle_practicas,
      origen
    ) values (
      p_student_id,
      to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'Pendiente',
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      jsonb_build_object(
        'version', 'moodle-assisted/v1',
        'source', 'moodle_automatic',
        'totalHoras', v_total_hours,
        'notaPromedio', null,
        'items', v_detail_items
      ),
      'moodle_automatic'
    )
    returning id into v_finalizacion_id;
  end if;

  insert into public.accreditation_transition_events (
    estudiante_id,
    trigger_practica_id,
    trigger_observation_id,
    outcome,
    finalizacion_id,
    uncertain_practice_ids,
    requirement_gaps,
    documentation_snapshot
  ) values (
    p_student_id,
    v_trigger_practice_id,
    p_trigger_observation_id,
    v_predicted_outcome,
    v_finalizacion_id,
    v_uncertain_ids,
    v_requirement_gaps,
    v_documentation_snapshot
  )
  on conflict (estudiante_id) do nothing
  returning id into v_event_id;

  return jsonb_build_object(
    'status', case when v_event_id is null then 'already_notified' else v_predicted_outcome end,
    'eventId', v_event_id,
    'finalizacionId', v_finalizacion_id,
    'academicReady', v_academic_ready,
    'documentationReady', v_documentation_ready,
    'uncertainPracticeIds', to_jsonb(v_uncertain_ids),
    'requirementGaps', to_jsonb(v_requirement_gaps)
  );
end;
$$;

revoke all on function private.evaluate_student_accreditation_transition_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.evaluate_student_accreditation_transition_v1(uuid, uuid)
  to service_role;

create or replace function public.evaluate_student_accreditation_transition_v1(
  p_student_id uuid,
  p_trigger_observation_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.evaluate_student_accreditation_transition_v1(
    p_student_id,
    p_trigger_observation_id
  );
$$;

revoke all on function public.evaluate_student_accreditation_transition_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.evaluate_student_accreditation_transition_v1(uuid, uuid)
  to service_role;

comment on function public.evaluate_student_accreditation_transition_v1(uuid, uuid) is
  'Entrada exclusiva del worker Moodle. En shadow sólo audita; en active crea una transición idempotente o el trámite automático.';

commit;
