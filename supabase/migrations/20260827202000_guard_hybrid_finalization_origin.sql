begin;

create or replace function private.guard_hybrid_finalization_origin_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.accreditation_transition_events%rowtype;
  v_items jsonb;
begin
  if new.detalle_practicas is not null
    and jsonb_typeof(new.detalle_practicas) <> 'object'
  then
    raise exception 'detalle_practicas must be an object' using errcode = '22023';
  end if;

  v_items := coalesce(new.detalle_practicas -> 'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'detalle_practicas.items must be an array' using errcode = '22023';
  end if;

  if new.origen = 'manual' then
    -- Un cliente no puede fabricar badges de Campus dentro del flujo manual.
    if exists (
      select 1
      from jsonb_array_elements(v_items) item
      where item #>> '{informe,source}' = 'moodle'
         or item #>> '{asistencia,source}' = 'moodle'
    ) then
      raise exception 'Moodle evidence requires an assisted or automatic transition'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.origen = 'moodle_automatic' then
    if coalesce((select auth.role()), '') <> 'service_role'
      and current_user not in ('postgres', 'supabase_admin')
    then
      raise exception 'Automatic accreditation is reserved to the Moodle worker'
        using errcode = '42501';
    end if;
    if new.detalle_practicas ->> 'source' <> 'moodle_automatic' then
      raise exception 'Invalid automatic accreditation detail' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.origen <> 'moodle_assisted' then
    return new;
  end if;

  if new.estudiante_id is null or not exists (
    select 1
    from public.estudiantes e
    where e.id = new.estudiante_id
      and (
        e.user_id = (select auth.uid())
        or coalesce((select auth.role()), '') = 'service_role'
        or current_user in ('postgres', 'supabase_admin')
      )
  ) then
    raise exception 'The assisted transition does not belong to the current student'
      using errcode = '42501';
  end if;

  select event.*
    into v_event
  from public.accreditation_transition_events event
  where event.estudiante_id = new.estudiante_id
    and event.outcome = 'manual_required'
  for update;

  if v_event.id is null then
    raise exception 'No Moodle-assisted transition exists for this student'
      using errcode = '42501';
  end if;
  if v_event.finalizacion_id is not null then
    raise exception 'The Moodle-assisted transition was already submitted'
      using errcode = '23505';
  end if;
  if new.detalle_practicas ->> 'source' <> 'moodle_assisted' then
    raise exception 'Invalid assisted accreditation detail' using errcode = '22023';
  end if;

  -- Todo informe que el formulario evita volver a subir debe conservar la
  -- evidencia Moodle emitida por el servidor.
  if exists (
    select 1
    from jsonb_array_elements(v_items) item
    where item #>> '{informe,source}' is distinct from 'moodle'
       or item #>> '{informe,evidence}' is distinct from 'graded'
  ) then
    raise exception 'All assisted reports must be verified Moodle evidence'
      using errcode = '22023';
  end if;

  -- Cada PPS dudosa debe aparecer y traer una planilla efectivamente subida.
  if exists (
    select 1
    from unnest(v_event.uncertain_practice_ids) uncertain(practica_id)
    where not exists (
      select 1
      from jsonb_array_elements(v_items) item
      where item ->> 'practicaId' = uncertain.practica_id::text
        and item #>> '{asistencia,source}' = 'student_upload'
        and nullif(item #>> '{asistencia,url}', '') is not null
        and nullif(item #>> '{asistencia,filename}', '') is not null
    )
  ) then
    raise exception 'Every uncertain practice requires an uploaded attendance sheet'
      using errcode = '22023';
  end if;

  -- Y ninguna PPS que el snapshot declaró automática puede perder su evidencia
  -- al construir el detalle final.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_event.documentation_snapshot -> 'items', '[]'::jsonb)) evidence
    where evidence ->> 'practicaId' is not null
      and not exists (
        select 1
        from jsonb_array_elements(v_items) item
        where item ->> 'practicaId' = evidence ->> 'practicaId'
          and item #>> '{informe,source}' = 'moodle'
          and (
            coalesce((evidence ->> 'esOnline')::boolean, false)
            or coalesce((evidence ->> 'automatic')::boolean, false) = false
            or item #>> '{asistencia,source}' = 'moodle'
          )
      )
  ) then
    raise exception 'The assisted detail does not match the server evidence snapshot'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_hybrid_finalization_origin_v1()
  from public, anon, authenticated;

drop trigger if exists guard_hybrid_finalization_origin_trigger
  on public.finalizacion_pps;
create trigger guard_hybrid_finalization_origin_trigger
before insert or update of origen, detalle_practicas, estudiante_id
on public.finalizacion_pps
for each row execute function private.guard_hybrid_finalization_origin_v1();

create or replace function private.link_assisted_finalization_event_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.origen = 'moodle_assisted' then
    update public.accreditation_transition_events event
    set finalizacion_id = new.id,
        acknowledged_at = coalesce(event.acknowledged_at, now())
    where event.estudiante_id = new.estudiante_id
      and event.outcome = 'manual_required'
      and event.finalizacion_id is null;

    if not found then
      raise exception 'The assisted transition could not be linked'
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.link_assisted_finalization_event_v1()
  from public, anon, authenticated;

drop trigger if exists link_assisted_finalization_event_trigger
  on public.finalizacion_pps;
create trigger link_assisted_finalization_event_trigger
after insert on public.finalizacion_pps
for each row execute function private.link_assisted_finalization_event_v1();

comment on function private.guard_hybrid_finalization_origin_v1() is
  'Impide que el cliente autodeclare evidencia Moodle y valida las planillas exigidas por el evento asistido.';

commit;
