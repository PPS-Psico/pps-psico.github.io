-- Habilita el barrido Moodle anual tambien dentro del simulador de jefatura.
-- El Admin elige una preview_key opaca. El servidor vuelve a resolver sus
-- areas, limita los cmid y registra al administrador como actor de la lectura.

create or replace function private.get_jefe_moodle_sync_tasks_for_areas_v1(p_areas text[])
returns table(
  academic_year integer,
  course_id bigint,
  cmid bigint,
  task_name text,
  area_keys text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(
    year from (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )::integer;
begin
  if coalesce(cardinality(p_areas), 0) = 0
     or not (p_areas <@ array['clinica', 'educacional', 'laboral', 'comunitaria']::text[]) then
    raise exception 'Invalid jefe Moodle area scope' using errcode = '42501';
  end if;

  return query
  with catalog_tasks as (
    select
      ae.academic_year,
      ae.course_id,
      ae.moodle_id::bigint as cmid,
      coalesce(
        nullif(trim(ae.moodle_name), ''),
        nullif(trim(ae.institucion), ''),
        'Tarea Moodle'
      ) as task_name,
      area_key
    from public.aula_entregas ae
    cross join lateral (
      select area_key
      from unnest(p_areas) area_key
      where private.jefe_orientation_key(ae.area) = area_key
    ) matched
    where ae.academic_year = v_year
      and ae.course_id = 3615
      and ae.moodle_id ~ '^\d+$'
  ), launch_tasks as (
    select
      ae.academic_year,
      ae.course_id,
      ae.moodle_id::bigint as cmid,
      coalesce(
        nullif(trim(ae.moodle_name), ''),
        nullif(trim(ae.institucion), ''),
        'Tarea Moodle'
      ) as task_name,
      lm.orientacion_key as area_key
    from public.lanzamiento_moodle_tareas lm
    join public.aula_entregas ae on ae.id = lm.aula_entrega_id
    where lm.validation_status = 'confirmed'
      and lm.orientacion_key = any(p_areas)
      and ae.academic_year = v_year
      and ae.course_id = 3615
      and ae.moodle_id ~ '^\d+$'
  ), direct_tasks as (
    select
      ae.academic_year,
      ae.course_id,
      ae.moodle_id::bigint as cmid,
      coalesce(
        nullif(trim(ae.moodle_name), ''),
        nullif(trim(ae.institucion), ''),
        'Tarea Moodle'
      ) as task_name,
      matched.area_key
    from public.practica_moodle_tareas pm
    join public.aula_entregas ae on ae.id = pm.aula_entrega_id
    join public.practicas p on p.id = pm.practica_id
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    cross join lateral (
      select area_key
      from unnest(p_areas) area_key
      where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
    ) matched
    where pm.validation_status = 'confirmed'
      and ae.academic_year = v_year
      and ae.course_id = 3615
      and ae.moodle_id ~ '^\d+$'
  ), all_tasks as (
    select * from catalog_tasks
    union all
    select * from launch_tasks
    union all
    select * from direct_tasks
  )
  select
    v_year,
    t.course_id,
    t.cmid,
    min(t.task_name) as task_name,
    array_agg(distinct t.area_key order by t.area_key) as area_keys
  from all_tasks t
  group by t.course_id, t.cmid
  order by min(t.task_name), t.cmid;
end;
$$;

create or replace function private.get_jefe_moodle_sync_tasks_v1_impl()
returns table(
  academic_year integer,
  course_id bigint,
  cmid bigint,
  task_name text,
  area_keys text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_areas text[];
begin
  v_areas := private.require_jefe_areas_v1();
  return query
  select *
  from private.get_jefe_moodle_sync_tasks_for_areas_v1(v_areas);
end;
$$;

create or replace function private.get_jefe_moodle_sync_tasks_preview_v1_impl(
  p_preview_key uuid
)
returns table(
  academic_year integer,
  course_id bigint,
  cmid bigint,
  task_name text,
  area_keys text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_areas text[];
  v_dni_count integer;
begin
  perform private.require_jefe_preview_access_v1();

  select
    count(distinct a.dni)::integer,
    array_agg(distinct a.area_key order by a.area_key)
  into v_dni_count, v_areas
  from private.jefe_area_assignments a
  where a.preview_key = p_preview_key;

  if v_dni_count <> 1 or coalesce(cardinality(v_areas), 0) = 0 then
    raise exception 'Unknown jefe preview identity' using errcode = '22023';
  end if;

  return query
  select *
  from private.get_jefe_moodle_sync_tasks_for_areas_v1(v_areas);
end;
$$;

create or replace function private.sync_jefe_moodle_reports_scoped_v1_impl(
  p_preview_key uuid,
  p_request_id uuid,
  p_course_id bigint,
  p_academic_year integer,
  p_observed_at timestamptz,
  p_actor_moodle_user_id bigint,
  p_actor_moodle_username text,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  select r.auth_user_id, r.details
  into v_existing_auth_user_id, v_existing_details
  from public.moodle_sync_runs r
  where r.request_id = p_request_id;

  if found then
    if v_existing_auth_user_id is distinct from v_auth_user_id
       or coalesce(v_existing_details ->> 'preview_key', '')
          is distinct from coalesce(p_preview_key::text, '') then
      raise exception 'Request id already belongs to another sync scope' using errcode = '42501';
    end if;
    return coalesce(v_existing_details, '{}'::jsonb)
      || jsonb_build_object('success', true, 'already_processed', true);
  end if;

  insert into public.moodle_sync_runs (
    request_id,
    auth_user_id,
    estudiante_id,
    observed_at,
    bridge_version,
    parser_version,
    outcome,
    requested_count,
    fetched_count,
    details
  ) values (
    p_request_id,
    v_auth_user_id,
    v_profile_id,
    p_observed_at,
    'pps-moodle-bridge/v1',
    'assignment-grading-table/v1',
    'pending',
    v_task_count,
    v_row_count,
    jsonb_strip_nulls(jsonb_build_object(
      'scope', v_scope,
      'preview_key', p_preview_key,
      'academic_year', p_academic_year,
      'areas', to_jsonb(v_areas),
      'actor_moodle_user_id', p_actor_moodle_user_id,
      'actor_moodle_username', regexp_replace(coalesce(p_actor_moodle_username, ''), '\D', '', 'g')
    ))
  );

  with raw_rows as (
    select
      (task ->> 'cmid')::bigint as cmid,
      row_data.*
    from jsonb_array_elements(p_tasks) task
    cross join lateral jsonb_to_recordset(task -> 'rows') as row_data(
      "moodleUserId" bigint,
      "moodleUsername" text,
      "email" text,
      "status" text,
      "submitted" boolean,
      "gradeValue" numeric,
      "gradeMax" numeric,
      "gradeDisplay" text,
      "gradedAtDisplay" text,
      "submittedAt" text,
      "submittedAtDisplay" text
    )
  ), normalized as (
    select distinct on (r.cmid, student_dni)
      r.cmid,
      r."moodleUserId" as moodle_user_id,
      student_dni,
      r."status" as source_status,
      r."submitted" as source_submitted,
      r."gradeValue" as grade_value,
      r."gradeMax" as grade_max,
      nullif(trim(r."gradeDisplay"), '') as grade_display,
      nullif(trim(r."gradedAtDisplay"), '') as graded_at_display,
      case
        when r."submittedAt" ~ '^\d{4}-\d{2}-\d{2}T' then r."submittedAt"::timestamptz
        else null
      end as submitted_at,
      nullif(trim(r."submittedAtDisplay"), '') as submitted_at_display,
      (
        r."moodleUserId" > 0
        and student_dni ~ '^\d{6,12}$'
        and r."status" in ('submitted', 'graded')
        and r."submitted" is true
        and (r."gradeValue" is null or r."gradeValue" >= 0)
        and (r."gradeMax" is null or r."gradeMax" > 0)
        and (r."gradeValue" is null or r."gradeMax" is null or r."gradeValue" <= r."gradeMax")
        and length(coalesce(r."gradeDisplay", '')) <= 160
        and length(coalesce(r."gradedAtDisplay", '')) <= 200
        and length(coalesce(r."submittedAtDisplay", '')) <= 200
        and (
          r."submittedAt" is null
          or (
            r."submittedAt" ~ '^\d{4}-\d{2}-\d{2}T'
            and r."submittedAt"::timestamptz <= p_observed_at + interval '5 minutes'
          )
        )
      ) as structurally_valid
    from raw_rows r
    cross join lateral (
      select regexp_replace(coalesce(r."moodleUsername", ''), '\D', '', 'g') as student_dni
    ) cleaned
    order by r.cmid, student_dni, r."moodleUserId"
  ), practice_scope as (
    select distinct
      p.id as practica_id,
      p.estudiante_id,
      p.lanzamiento_id,
      regexp_replace(coalesce(e.dni::text, ''), '\D', '', 'g') as student_dni,
      matched.area_key
    from public.practicas p
    join public.estudiantes e on e.id = p.estudiante_id
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    cross join lateral (
      select area_key
      from unnest(v_areas) area_key
      where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
    ) matched
  ), direct_candidates as (
    select distinct
      ps.practica_id,
      ps.estudiante_id,
      ps.lanzamiento_id,
      ps.student_dni,
      ae.id as aula_entrega_id,
      ae.moodle_id::bigint as cmid,
      ae.moodle_grade_max,
      ae.grade_conversion_mode
    from practice_scope ps
    join public.practica_moodle_tareas pm
      on pm.practica_id = ps.practica_id
     and pm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = pm.aula_entrega_id
     and ae.academic_year = p_academic_year
     and ae.course_id = p_course_id
     and ae.moodle_id ~ '^\d+$'
  ), launch_candidates as (
    select distinct
      ps.practica_id,
      ps.estudiante_id,
      ps.lanzamiento_id,
      ps.student_dni,
      ae.id as aula_entrega_id,
      ae.moodle_id::bigint as cmid,
      ae.moodle_grade_max,
      ae.grade_conversion_mode
    from practice_scope ps
    join public.lanzamiento_moodle_tareas lm
      on lm.lanzamiento_id = ps.lanzamiento_id
     and lm.orientacion_key = ps.area_key
     and lm.validation_status = 'confirmed'
    join public.aula_entregas ae
      on ae.id = lm.aula_entrega_id
     and ae.academic_year = p_academic_year
     and ae.course_id = p_course_id
     and ae.moodle_id ~ '^\d+$'
    where not exists (
      select 1
      from public.practica_moodle_tareas direct_link
      where direct_link.practica_id = ps.practica_id
        and direct_link.validation_status = 'confirmed'
    )
  ), candidates as (
    select * from direct_candidates
    union
    select * from launch_candidates
  ), candidate_counts as (
    select
      c.cmid,
      c.student_dni,
      count(distinct c.practica_id)::integer as candidate_count,
      (array_agg(c.practica_id order by c.practica_id))[1] as practica_id,
      (array_agg(c.estudiante_id order by c.practica_id))[1] as estudiante_id,
      (array_agg(c.lanzamiento_id order by c.practica_id))[1] as lanzamiento_id,
      (array_agg(c.aula_entrega_id order by c.practica_id))[1] as aula_entrega_id,
      (array_agg(c.moodle_grade_max order by c.practica_id))[1] as configured_grade_max,
      (array_agg(c.grade_conversion_mode order by c.practica_id))[1] as grade_conversion_mode
    from candidates c
    group by c.cmid, c.student_dni
  ), classified as (
    select
      n.*,
      cc.candidate_count,
      cc.practica_id,
      cc.estudiante_id,
      cc.lanzamiento_id,
      cc.aula_entrega_id,
      cc.configured_grade_max,
      cc.grade_conversion_mode,
      (
        n.structurally_valid
        and (n.grade_value is null or coalesce(n.grade_max, cc.configured_grade_max) is not null)
        and (
          n.grade_max is null
          or cc.configured_grade_max is null
          or abs(n.grade_max - cc.configured_grade_max) <= 0.001
        )
      ) as fully_valid
    from normalized n
    left join candidate_counts cc
      on cc.cmid = n.cmid
     and cc.student_dni = n.student_dni
  ), inserted as (
    insert into public.moodle_grade_observations (
      observed_at,
      auth_user_id,
      estudiante_id,
      practica_id,
      lanzamiento_id,
      aula_entrega_id,
      course_id,
      cmid,
      moodle_user_id,
      moodle_username,
      task_status,
      submitted,
      submitted_at,
      submitted_at_display,
      grade_value,
      grade_max,
      grade_display,
      graded_at_display,
      request_id,
      bridge_version,
      parser_version,
      confidence,
      payload_hash
    )
    select
      p_observed_at,
      v_auth_user_id,
      c.estudiante_id,
      c.practica_id,
      c.lanzamiento_id,
      c.aula_entrega_id,
      p_course_id,
      c.cmid,
      c.moodle_user_id,
      c.student_dni,
      case when c.grade_value is not null then 'graded' else 'submitted' end,
      true,
      c.submitted_at,
      c.submitted_at_display,
      c.grade_value,
      coalesce(c.grade_max, c.configured_grade_max),
      c.grade_display,
      c.graded_at_display,
      p_request_id,
      'pps-moodle-bridge/v1',
      'assignment-grading-table/v1',
      'moodle_session_observed',
      encode(
        extensions.digest(
          convert_to(
            jsonb_build_object(
              'requestId', p_request_id,
              'observedAt', p_observed_at,
              'practicaId', c.practica_id,
              'cmid', c.cmid,
              'moodleUserId', c.moodle_user_id,
              'moodleUsername', c.student_dni,
              'status', case when c.grade_value is not null then 'graded' else 'submitted' end,
              'submittedAt', c.submitted_at,
              'gradeValue', c.grade_value,
              'gradeMax', coalesce(c.grade_max, c.configured_grade_max)
            )::text,
            'UTF8'
          ),
          'sha256'
        ),
        'hex'
      )
    from classified c
    where c.candidate_count = 1
      and c.fully_valid
    on conflict (request_id, practica_id, cmid) do nothing
    returning *
  ), snapshot_upserts as (
    insert into public.moodle_grade_snapshots (
      practica_id,
      cmid,
      latest_observation_id,
      estudiante_id,
      lanzamiento_id,
      aula_entrega_id,
      task_status,
      submitted,
      submitted_at,
      submitted_at_display,
      grade_value,
      grade_max,
      grade_display,
      graded_at_display,
      observed_at,
      received_at,
      confidence
    )
    select
      i.practica_id,
      i.cmid,
      i.id,
      i.estudiante_id,
      i.lanzamiento_id,
      i.aula_entrega_id,
      i.task_status,
      i.submitted,
      i.submitted_at,
      i.submitted_at_display,
      i.grade_value,
      i.grade_max,
      i.grade_display,
      i.graded_at_display,
      i.observed_at,
      i.received_at,
      i.confidence
    from inserted i
    on conflict (practica_id, cmid) do update set
      latest_observation_id = excluded.latest_observation_id,
      estudiante_id = excluded.estudiante_id,
      lanzamiento_id = excluded.lanzamiento_id,
      aula_entrega_id = excluded.aula_entrega_id,
      task_status = excluded.task_status,
      submitted = excluded.submitted,
      submitted_at = excluded.submitted_at,
      submitted_at_display = excluded.submitted_at_display,
      grade_value = excluded.grade_value,
      grade_max = excluded.grade_max,
      grade_display = excluded.grade_display,
      graded_at_display = excluded.graded_at_display,
      observed_at = excluded.observed_at,
      received_at = excluded.received_at,
      confidence = excluded.confidence
    returning practica_id
  )
  select
    count(*) filter (where c.candidate_count = 1 and c.fully_valid)::integer,
    (select count(*) from inserted)::integer,
    (select count(*) from snapshot_upserts)::integer,
    count(*) filter (where c.candidate_count > 1)::integer,
    count(*) filter (where coalesce(c.candidate_count, 0) = 0)::integer,
    count(*) filter (
      where c.candidate_count = 1 and not c.fully_valid
    )::integer
  into
    v_accepted,
    v_stored,
    v_snapshot_updated,
    v_ambiguous,
    v_unmatched,
    v_invalid
  from classified c;

  v_result := jsonb_build_object(
    'success', true,
    'academic_year', p_academic_year,
    'task_count', v_task_count,
    'rows_received', v_row_count,
    'accepted', v_accepted,
    'stored', v_stored,
    'snapshot_updated', v_snapshot_updated,
    'ambiguous', v_ambiguous,
    'unmatched', v_unmatched,
    'invalid', v_invalid,
    'observed_at', p_observed_at
  );

  update public.moodle_sync_runs r
  set
    completed_at = now(),
    outcome = case
      when v_ambiguous + v_invalid > 0 then 'partial'
      when v_stored = 0 then 'noop'
      else 'success'
    end,
    accepted_count = v_accepted,
    stored_count = v_stored,
    snapshot_updated_count = v_snapshot_updated,
    rejected_count = v_ambiguous + v_invalid,
    duration_ms = greatest(0, extract(milliseconds from clock_timestamp() - r.started_at)::integer),
    details = v_result || jsonb_strip_nulls(jsonb_build_object(
      'scope', v_scope,
      'preview_key', p_preview_key,
      'areas', to_jsonb(v_areas),
      'actor_moodle_user_id', p_actor_moodle_user_id,
      'actor_moodle_username', regexp_replace(coalesce(p_actor_moodle_username, ''), '\D', '', 'g')
    ))
  where r.request_id = p_request_id;

  return v_result;
end;
$$;

create or replace function private.sync_jefe_moodle_reports_v1_impl(
  p_request_id uuid,
  p_course_id bigint,
  p_academic_year integer,
  p_observed_at timestamptz,
  p_actor_moodle_user_id bigint,
  p_actor_moodle_username text,
  p_tasks jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.sync_jefe_moodle_reports_scoped_v1_impl(
    null::uuid,
    p_request_id,
    p_course_id,
    p_academic_year,
    p_observed_at,
    p_actor_moodle_user_id,
    p_actor_moodle_username,
    p_tasks
  );
$$;

create or replace function private.sync_jefe_moodle_reports_preview_v1_impl(
  p_preview_key uuid,
  p_request_id uuid,
  p_course_id bigint,
  p_academic_year integer,
  p_observed_at timestamptz,
  p_actor_moodle_user_id bigint,
  p_actor_moodle_username text,
  p_tasks jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.sync_jefe_moodle_reports_scoped_v1_impl(
    p_preview_key,
    p_request_id,
    p_course_id,
    p_academic_year,
    p_observed_at,
    p_actor_moodle_user_id,
    p_actor_moodle_username,
    p_tasks
  );
$$;

create or replace function public.get_jefe_moodle_sync_tasks_preview_v1(
  p_preview_key uuid
)
returns table(
  academic_year integer,
  course_id bigint,
  cmid bigint,
  task_name text,
  area_keys text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_jefe_moodle_sync_tasks_preview_v1_impl(p_preview_key);
$$;

create or replace function public.sync_jefe_moodle_reports_preview_v1(
  p_preview_key uuid,
  p_request_id uuid,
  p_course_id bigint,
  p_academic_year integer,
  p_observed_at timestamptz,
  p_actor_moodle_user_id bigint,
  p_actor_moodle_username text,
  p_tasks jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.sync_jefe_moodle_reports_preview_v1_impl(
    p_preview_key,
    p_request_id,
    p_course_id,
    p_academic_year,
    p_observed_at,
    p_actor_moodle_user_id,
    p_actor_moodle_username,
    p_tasks
  );
$$;

revoke all on function private.get_jefe_moodle_sync_tasks_for_areas_v1(text[])
  from public, anon, authenticated;
revoke all on function private.get_jefe_moodle_sync_tasks_preview_v1_impl(uuid)
  from public, anon, authenticated;
revoke all on function private.sync_jefe_moodle_reports_scoped_v1_impl(
  uuid, uuid, bigint, integer, timestamptz, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function private.sync_jefe_moodle_reports_preview_v1_impl(
  uuid, uuid, bigint, integer, timestamptz, bigint, text, jsonb
) from public, anon, authenticated;

grant execute on function private.get_jefe_moodle_sync_tasks_preview_v1_impl(uuid)
  to authenticated, service_role;
grant execute on function private.sync_jefe_moodle_reports_preview_v1_impl(
  uuid, uuid, bigint, integer, timestamptz, bigint, text, jsonb
) to authenticated, service_role;

revoke all on function public.get_jefe_moodle_sync_tasks_preview_v1(uuid)
  from public, anon;
revoke all on function public.sync_jefe_moodle_reports_preview_v1(
  uuid, uuid, bigint, integer, timestamptz, bigint, text, jsonb
) from public, anon;

grant execute on function public.get_jefe_moodle_sync_tasks_preview_v1(uuid)
  to authenticated;
grant execute on function public.sync_jefe_moodle_reports_preview_v1(
  uuid, uuid, bigint, integer, timestamptz, bigint, text, jsonb
) to authenticated;

comment on function public.get_jefe_moodle_sync_tasks_preview_v1(uuid) is
  'Lista anual deduplicada de tareas Moodle para la jefatura simulada. Solo SuperUser/AdminTester y preview_key opaca valida.';
comment on function public.sync_jefe_moodle_reports_preview_v1(
  uuid, uuid, bigint, integer, timestamptz, bigint, text, jsonb
) is
  'Ingiere el barrido Moodle del area simulada. El servidor revalida Admin, preview_key, areas y cmid antes de persistir.';
