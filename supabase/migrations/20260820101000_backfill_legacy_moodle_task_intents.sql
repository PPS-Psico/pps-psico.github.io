-- Safe 2024-2026 coexistence backfill.
--
-- Only confirmed launch/orientation links are adopted. A practice is attached
-- to the matching normalized orientation. If its orientation is unknown, it is
-- attached only when the launch has exactly one intent; ambiguous practices are
-- deliberately left out for manual reconciliation.

do $$
declare
  v_intents integer := 0;
  v_participants integer := 0;
  v_ambiguous integer := 0;
begin
  with source_rows as (
    select
      l.id as lanzamiento_id,
      l.nombre_pps,
      l.fecha_inicio,
      l.fecha_finalizacion,
      lm.orientacion_key,
      lm.aula_entrega_id,
      lm.validated_at,
      ae.moodle_name,
      ae.institucion,
      ae.grade_conversion_mode,
      coalesce(ae.moodle_grade_max, 10) as grade_max,
      case
        when l.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}$'
          then (l.fecha_finalizacion::date - 7 + time '00:00:00')
            at time zone 'America/Argentina/Buenos_Aires'
      end as desired_open_at,
      case
        when l.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}$'
          then (l.fecha_finalizacion::date + 30 + time '23:59:59')
            at time zone 'America/Argentina/Buenos_Aires'
      end as desired_due_at
    from public.lanzamiento_moodle_tareas lm
    join public.lanzamientos_pps l on l.id = lm.lanzamiento_id
    join public.aula_entregas ae on ae.id = lm.aula_entrega_id and ae.activo
    where lm.validation_status = 'confirmed'
      and coalesce(substring(l.fecha_inicio from '^(\d{4})')::integer, 0) < 2027
  ), prepared as (
    select s.*,
      'PPS:' || s.lanzamiento_id::text || ':' || s.orientacion_key as stable_key,
      coalesce(nullif(trim(s.moodle_name), ''), nullif(trim(s.institucion), ''), 'Informe PPS')
        as desired_name,
      private.moodle_v2_config_hash(
        'PPS:' || s.lanzamiento_id::text || ':' || s.orientacion_key,
        coalesce(nullif(trim(s.moodle_name), ''), nullif(trim(s.institucion), ''), 'Informe PPS'),
        null,
        s.desired_open_at,
        s.desired_due_at,
        null,
        s.grade_conversion_mode,
        s.grade_max,
        'informes-' || s.orientacion_key,
        'visible',
        'v1'
      ) as desired_hash
    from source_rows s
  )
  insert into public.moodle_task_intents (
    lanzamiento_id, orientacion_key, mode, stable_key, desired_name,
    desired_open_at, desired_due_at, desired_grade_mode, desired_grade_max,
    desired_section_key, desired_visibility, desired_config_hash,
    provisioning_status, monitoring_status, next_scan_at,
    aula_entrega_id, last_verified_at
  )
  select
    p.lanzamiento_id, p.orientacion_key, 'legacy_shared', p.stable_key,
    p.desired_name, p.desired_open_at, p.desired_due_at,
    p.grade_conversion_mode, p.grade_max, 'informes-' || p.orientacion_key,
    'visible', p.desired_hash, 'verified',
    case when p.desired_open_at is not null and now() >= p.desired_open_at
      then 'hot' else 'not_started' end,
    case when p.desired_open_at is not null then greatest(now(), p.desired_open_at) end,
    p.aula_entrega_id, coalesce(p.validated_at, now())
  from prepared p
  on conflict (lanzamiento_id, orientacion_key) do update set
    mode = 'legacy_shared',
    desired_name = excluded.desired_name,
    desired_open_at = excluded.desired_open_at,
    desired_due_at = excluded.desired_due_at,
    desired_grade_mode = excluded.desired_grade_mode,
    desired_grade_max = excluded.desired_grade_max,
    desired_section_key = excluded.desired_section_key,
    desired_config_hash = excluded.desired_config_hash,
    provisioning_status = 'verified',
    aula_entrega_id = excluded.aula_entrega_id,
    last_verified_at = coalesce(public.moodle_task_intents.last_verified_at, excluded.last_verified_at),
    updated_at = now();
  get diagnostics v_intents = row_count;

  with intent_counts as (
    select i.lanzamiento_id, count(*)::integer as intent_count
    from public.moodle_task_intents i
    where i.mode = 'legacy_shared' and i.provisioning_status <> 'cancelled'
    group by i.lanzamiento_id
  ), eligible as (
    select
      i.id as intent_id,
      p.id as practica_id,
      p.estudiante_id,
      coalesce(p.created_at, now()) as active_from,
      case
        when lower(coalesce(p.estado, '')) in ('desaprobada', 'desaprobado')
          then 'institution_failed'
        when lower(coalesce(p.estado, '')) in ('cancelada', 'cancelado', 'abandonada', 'abandonado')
          then 'withdrawn'
        else 'expected'
      end as membership_status
    from public.practicas p
    join intent_counts c on c.lanzamiento_id = p.lanzamiento_id
    join public.moodle_task_intents i on i.lanzamiento_id = p.lanzamiento_id
      and i.mode = 'legacy_shared'
      and (
        i.orientacion_key = private.moodle_orientation_key(p.especialidad)
        or (private.moodle_orientation_key(p.especialidad) is null and c.intent_count = 1)
      )
    where p.estudiante_id is not null
  )
  insert into public.moodle_task_expected_participants (
    intent_id, practica_id, estudiante_id, membership_status,
    active_from, source
  )
  select intent_id, practica_id, estudiante_id, membership_status,
    active_from, 'backfill'
  from eligible
  on conflict (intent_id, practica_id) where active_to is null do update set
    estudiante_id = excluded.estudiante_id,
    membership_status = excluded.membership_status,
    updated_at = now();
  get diagnostics v_participants = row_count;

  select count(*)::integer into v_ambiguous
  from public.practicas p
  join (
    select i.lanzamiento_id
    from public.moodle_task_intents i
    where i.mode = 'legacy_shared' and i.provisioning_status <> 'cancelled'
    group by i.lanzamiento_id
    having count(*) > 1
  ) multi on multi.lanzamiento_id = p.lanzamiento_id
  where p.estudiante_id is not null
    and private.moodle_orientation_key(p.especialidad) is null;

  raise notice
    'Moodle v2 legacy backfill: % intents upserted, % participants upserted, % ambiguous practices intentionally skipped.',
    v_intents, v_participants, v_ambiguous;
end;
$$;
