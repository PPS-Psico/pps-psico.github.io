begin;

-- Fija la consigna de las tareas exclusivas: "un informe por tarea".
--
-- Mientras dos PPS entreguen en un mismo espacio, Moodle guarda una sola
-- calificacion para los dos informes y hay que repartirla leyendo el comentario
-- de retroalimentacion, alumno por alumno. Hoy hay 189 pares (alumno, tarea) en
-- esa situacion, repartidos en 17 tareas.
--
-- Las tareas `dedicated` ya se crean una por PPS; lo que faltaba era decirselo
-- al alumno en el enunciado, que es donde se corta antes de que el problema
-- llegue a la nota. Las `legacy_shared` no se tocan: son de la catedra.
--
-- Cambiar la consigna cambia el `desired_config_hash`, asi que las tareas
-- exclusivas ya verificadas pasan a `needs_attention` y el agente las actualiza
-- en Campus. Es el comportamiento buscado.

CREATE OR REPLACE FUNCTION private.reconcile_moodle_task_intents_v1_impl(p_launch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_unit record;
  v_intent_id uuid;
  v_intent_count integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_participants_synced integer := 0;
  v_participants_closed integer := 0;
  v_rows integer;
  v_existing boolean;
  v_finish_date date;
  v_open_at timestamptz;
  v_due_at timestamptz;
  v_grading_due_at timestamptz;
  v_description text;
  v_stable_key text;
  v_desired_name text;
  v_desired_hash text;
  v_visibility text;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;

  for v_unit in
    with confirmed_legacy as (
      select l.id as lanzamiento_id, l.nombre_pps, l.fecha_inicio, l.fecha_finalizacion,
        lm.orientacion_key, 'legacy_shared'::text as mode, lm.aula_entrega_id,
        ae.moodle_name, ae.institucion as task_institution, ae.grade_conversion_mode,
        coalesce(ae.moodle_grade_max, 10) as grade_max, lm.validated_at
      from public.lanzamiento_moodle_tareas lm
      join public.lanzamientos_pps l on l.id = lm.lanzamiento_id
      join public.aula_entregas ae on ae.id = lm.aula_entrega_id and ae.activo
      where lm.validation_status = 'confirmed'
        and (p_launch_id is null or l.id = p_launch_id)
        and coalesce(substring(l.fecha_inicio from '^(\d{4})')::integer, 0) < 2027

        and not coalesce(l.moodle_pilot_dedicated, false)
    ), dedicated_units as (
      select distinct on (l.id, unit.orientacion_key)
        l.id as lanzamiento_id, l.nombre_pps, l.fecha_inicio, l.fecha_finalizacion,
        unit.orientacion_key, 'dedicated'::text as mode, null::bigint as aula_entrega_id,
        null::text as moodle_name, null::text as task_institution,
        'direct_10'::text as grade_conversion_mode, 10::numeric as grade_max,
        null::timestamptz as validated_at
      from public.lanzamientos_pps l
      cross join lateral (
        select private.moodle_orientation_key(p.especialidad) as orientacion_key
        from public.practicas p where p.lanzamiento_id = l.id
        union select private.moodle_orientation_key(l.orientacion)
      ) unit
      where (coalesce(substring(l.fecha_inicio from '^(\d{4})')::integer, 0) >= 2027

             or coalesce(l.moodle_pilot_dedicated, false))
        and (coalesce(l.moodle_pilot_dedicated, false)

             or lower(coalesce(l.estado_convocatoria, '')) in ('activa', 'archivado'))
        and unit.orientacion_key is not null
        and (p_launch_id is null or l.id = p_launch_id)
      order by l.id, unit.orientacion_key
    )
    select * from confirmed_legacy union all select * from dedicated_units
  loop
    v_finish_date := case when v_unit.fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}$'
      then v_unit.fecha_finalizacion::date else null end;
    v_open_at := case when v_finish_date is not null then
      (v_finish_date - 7 + time '00:00:00') at time zone 'America/Argentina/Buenos_Aires' end;
    v_due_at := case when v_finish_date is not null then
      (v_finish_date + 30 + time '23:59:59') at time zone 'America/Argentina/Buenos_Aires' end;
    v_grading_due_at := case when v_due_at is not null
      then v_due_at + interval '30 days' end;
    v_stable_key := 'PPS:' || v_unit.lanzamiento_id::text || ':' || v_unit.orientacion_key;
    v_desired_name := case when v_unit.mode = 'legacy_shared' then
      coalesce(nullif(trim(v_unit.moodle_name), ''), nullif(trim(v_unit.task_institution), ''), 'Informe PPS')
    else concat('Informe final PPS · ', coalesce(nullif(trim(v_unit.nombre_pps), ''), 'PPS'),
      ' · ', private.moodle_v2_orientation_label(v_unit.orientacion_key), private.moodle_v2_period_suffix(v_unit.fecha_inicio)) end;
    v_visibility := 'stealth';
    -- La consigna se fija solo en las tareas exclusivas. Las legacy son de la
    -- catedra y no se les reescribe el enunciado.
    --
    -- El punto central es "un informe por tarea": mientras dos PPS entregaron
    -- en un mismo espacio, Moodle guardo una sola nota para los dos informes y
    -- hubo que repartirla leyendo el comentario, alumno por alumno.
    v_description := case when v_unit.mode = 'dedicated' then
      '<p><strong>Subí un solo informe en esta tarea.</strong> Este espacio corresponde a '
      || 'una única PPS: si cursaste más de una, cada una tiene su propia tarea y su propia '
      || 'entrega.</p>'
      || '<p>Si subís dos informes acá, el Campus puede registrar una sola calificación para '
      || 'los dos y tu nota queda trabada hasta que Coordinación la resuelva a mano.</p>'
      || '<p>Adjuntá el informe final y, si tu PPS es presencial, la planilla de asistencia.</p>'
    end;
    v_desired_hash := private.moodle_v2_config_hash(
      v_stable_key, v_desired_name, v_description, v_open_at, v_due_at, null,
      v_unit.grade_conversion_mode, v_unit.grade_max,
      'informes-' || v_unit.orientacion_key, v_visibility, 'v1'
    );

    select exists (select 1 from public.moodle_task_intents i
      where i.lanzamiento_id = v_unit.lanzamiento_id
        and i.orientacion_key = v_unit.orientacion_key) into v_existing;

    insert into public.moodle_task_intents (
      lanzamiento_id, orientacion_key, mode, stable_key, desired_name,
      desired_description_html,
      desired_open_at, desired_due_at, desired_grading_due_at,
      desired_grade_mode, desired_grade_max,
      desired_section_key, desired_visibility, desired_config_hash,
      provisioning_status, monitoring_status, next_reconcile_at, next_scan_at,
      aula_entrega_id, last_verified_at
    ) values (
      v_unit.lanzamiento_id, v_unit.orientacion_key, v_unit.mode, v_stable_key,
      v_desired_name, v_description,
      v_open_at, v_due_at, v_grading_due_at, v_unit.grade_conversion_mode,
      v_unit.grade_max, 'informes-' || v_unit.orientacion_key, v_visibility,
      v_desired_hash, case when v_unit.mode = 'legacy_shared' then 'verified' else 'pending' end,
      case when v_open_at is not null and now() >= v_open_at then 'hot' else 'not_started' end,
      case when v_unit.mode = 'dedicated' then now() end,
      case when v_open_at is not null then greatest(now(), v_open_at) end,
      v_unit.aula_entrega_id,
      case when v_unit.mode = 'legacy_shared' then coalesce(v_unit.validated_at, now()) end
    )
    on conflict (lanzamiento_id, orientacion_key) do update set
      mode = excluded.mode,
      desired_name = excluded.desired_name,
      desired_description_html = excluded.desired_description_html,
      desired_open_at = excluded.desired_open_at,
      desired_due_at = excluded.desired_due_at,
      desired_grading_due_at = excluded.desired_grading_due_at,
      desired_grade_mode = excluded.desired_grade_mode,
      desired_grade_max = excluded.desired_grade_max,
      desired_section_key = excluded.desired_section_key,
      desired_visibility = excluded.desired_visibility,
      desired_config_hash = excluded.desired_config_hash,
      provisioning_status = case
        when excluded.mode = 'legacy_shared' then 'verified'
        when public.moodle_task_intents.provisioning_status = 'verified'
          and public.moodle_task_intents.desired_config_hash is distinct from excluded.desired_config_hash
          then 'needs_attention'
        else public.moodle_task_intents.provisioning_status end,
      monitoring_status = case when public.moodle_task_intents.monitoring_status = 'settled'
        then 'settled' else excluded.monitoring_status end,
      next_reconcile_at = case when excluded.mode = 'dedicated'
        and public.moodle_task_intents.provisioning_status in ('pending', 'error')
        then coalesce(public.moodle_task_intents.next_reconcile_at, now())
        else public.moodle_task_intents.next_reconcile_at end,
      next_scan_at = coalesce(public.moodle_task_intents.next_scan_at, excluded.next_scan_at),
      aula_entrega_id = coalesce(excluded.aula_entrega_id, public.moodle_task_intents.aula_entrega_id),
      last_verified_at = case when excluded.mode = 'legacy_shared'
        then coalesce(public.moodle_task_intents.last_verified_at, excluded.last_verified_at)
        else public.moodle_task_intents.last_verified_at end,
      updated_at = now()
    returning id into v_intent_id;

    if v_existing then v_updated := v_updated + 1; else v_created := v_created + 1; end if;
    select count(*) into v_intent_count from public.moodle_task_intents i
      where i.lanzamiento_id = v_unit.lanzamiento_id and i.provisioning_status <> 'cancelled';

    insert into public.moodle_task_expected_participants (
      intent_id, practica_id, estudiante_id, membership_status, active_from, source
    )
    select v_intent_id, p.id, p.estudiante_id,
      case
        when lower(coalesce(p.estado, '')) in ('desaprobada', 'desaprobado') then 'institution_failed'
        when lower(coalesce(p.estado, '')) in ('cancelada', 'cancelado', 'abandonada', 'abandonado') then 'withdrawn'
        else 'expected' end,
      coalesce(p.created_at, now()),
      case when v_unit.mode = 'legacy_shared' then 'backfill' else 'selection' end
    from public.practicas p
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    where p.lanzamiento_id = v_unit.lanzamiento_id and p.estudiante_id is not null
      and (
        private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) = v_unit.orientacion_key
        or (private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) is null
          and v_intent_count = 1)
      )
    on conflict (intent_id, practica_id) where active_to is null do update set
      estudiante_id = excluded.estudiante_id,
      membership_status = case when public.moodle_task_expected_participants.source = 'manual'
        then public.moodle_task_expected_participants.membership_status
        else excluded.membership_status end,
      updated_at = now();
    get diagnostics v_rows = row_count;
    v_participants_synced := v_participants_synced + v_rows;

    update public.moodle_task_expected_participants ep
    set membership_status = 'withdrawn', active_to = now(),
      reason_code = coalesce(ep.reason_code, 'NO_LONGER_IN_UNIT'), updated_at = now()
    where ep.intent_id = v_intent_id and ep.active_to is null and ep.membership_status = 'expected'
      and not exists (
        select 1 from public.practicas p
        left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
        where p.id = ep.practica_id and p.estudiante_id = ep.estudiante_id
          and p.lanzamiento_id = v_unit.lanzamiento_id
          and (
            private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) = v_unit.orientacion_key
            or (private.moodle_orientation_key(coalesce(p.especialidad, l.orientacion)) is null
              and v_intent_count = 1)
          )
      );
    get diagnostics v_rows = row_count;
    v_participants_closed := v_participants_closed + v_rows;
  end loop;

  return jsonb_build_object(
    'intents_created', v_created, 'intents_updated', v_updated,
    'participants_synced', v_participants_synced,
    'participants_closed', v_participants_closed
  );
end;
$function$


commit;
