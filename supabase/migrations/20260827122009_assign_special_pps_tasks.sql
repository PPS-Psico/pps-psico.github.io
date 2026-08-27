begin;

-- PPS excepcionales asignadas por coordinacion, sin lanzamiento. La tarea de
-- Moodle se configura una sola vez por actividad, orientacion y anio; cada
-- asignacion crea una practica y un vinculo exacto practica -> tarea.

create table if not exists public.special_pps_task_catalog (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null
    check (activity_type in ('relevamiento_profesional', 'entrevistas_profesionales')),
  orientation_key text not null
    check (orientation_key in ('clinica', 'laboral_comunitaria', 'educacional')),
  academic_year smallint not null check (academic_year between 2024 and 2100),
  aula_entrega_id bigint not null references public.aula_entregas(id) on delete restrict,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  unique (activity_type, orientation_key, academic_year),
  unique (activity_type, academic_year, aula_entrega_id)
);

create index if not exists special_pps_task_catalog_year_idx
  on public.special_pps_task_catalog (academic_year desc, activity_type, orientation_key)
  where enabled;

create table if not exists public.special_pps_assignments (
  id uuid primary key default gen_random_uuid(),
  practica_id uuid not null unique references public.practicas(id) on delete restrict,
  estudiante_id uuid not null references public.estudiantes(id) on delete restrict,
  task_catalog_id uuid not null references public.special_pps_task_catalog(id) on delete restrict,
  activity_type text not null
    check (activity_type in ('relevamiento_profesional', 'entrevistas_profesionales')),
  orientation_key text not null
    check (orientation_key in ('clinica', 'laboral', 'comunitaria', 'educacional')),
  academic_year smallint not null check (academic_year between 2024 and 2100),
  expected_hours numeric not null default 20 check (expected_hours > 0 and expected_hours <= 500),
  status text not null default 'assigned' check (status in ('assigned', 'cancelled')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null default auth.uid(),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  check (
    (status = 'assigned' and cancelled_at is null and cancelled_by is null)
    or
    (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null
      and nullif(btrim(cancellation_reason), '') is not null)
  )
);

create unique index if not exists special_pps_assignment_active_student_idx
  on public.special_pps_assignments (estudiante_id, activity_type, academic_year)
  where status = 'assigned';

create index if not exists special_pps_assignments_student_idx
  on public.special_pps_assignments (estudiante_id, academic_year desc);
create index if not exists special_pps_assignments_catalog_idx
  on public.special_pps_assignments (task_catalog_id);

alter table public.special_pps_task_catalog enable row level security;
alter table public.special_pps_assignments enable row level security;

revoke all on table public.special_pps_task_catalog from public, anon, authenticated;
revoke all on table public.special_pps_assignments from public, anon, authenticated;
grant select on table public.special_pps_task_catalog to authenticated;
grant select on table public.special_pps_assignments to authenticated;
grant all on table public.special_pps_task_catalog to service_role;
grant all on table public.special_pps_assignments to service_role;

create policy "Coordinator read special PPS task catalog"
  on public.special_pps_task_catalog for select to authenticated
  using (private.moodle_v2_is_coordinator());

create policy "Scoped read special PPS assignments"
  on public.special_pps_assignments for select to authenticated
  using (
    private.moodle_v2_is_coordinator()
    or exists (
      select 1
      from public.estudiantes e
      where e.id = estudiante_id
        and e.user_id = (select auth.uid())
    )
  );

create or replace function private.set_special_pps_task_v1_impl(
  p_activity_type text,
  p_orientation_key text,
  p_academic_year smallint,
  p_aula_entrega_id bigint
)
returns public.special_pps_task_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.aula_entregas%rowtype;
  v_result public.special_pps_task_catalog%rowtype;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;
  if p_activity_type not in ('relevamiento_profesional', 'entrevistas_profesionales') then
    raise exception 'Invalid special PPS activity type' using errcode = '22023';
  end if;
  if p_orientation_key not in ('clinica', 'laboral_comunitaria', 'educacional') then
    raise exception 'Invalid orientation' using errcode = '22023';
  end if;
  if p_academic_year < 2024 or p_academic_year > 2100 then
    raise exception 'Invalid academic year' using errcode = '22023';
  end if;

  select * into v_task
  from public.aula_entregas ae
  where ae.id = p_aula_entrega_id
  for share;

  if v_task.id is null then
    raise exception 'Moodle task not found in catalog' using errcode = 'P0002';
  end if;
  if not v_task.activo then
    raise exception 'Moodle task is inactive' using errcode = '22023';
  end if;
  if v_task.academic_year is distinct from p_academic_year then
    raise exception 'Moodle task belongs to year %, not %', v_task.academic_year, p_academic_year
      using errcode = '22023';
  end if;
  if not (
    v_task.area = p_orientation_key
    or (p_orientation_key = 'laboral_comunitaria' and v_task.area in ('laboral', 'comunitaria'))
  ) then
    raise exception 'Moodle task belongs to orientation %, not %', v_task.area, p_orientation_key
      using errcode = '22023';
  end if;

  insert into public.special_pps_task_catalog (
    activity_type, orientation_key, academic_year, aula_entrega_id,
    enabled, created_by, updated_at, updated_by
  ) values (
    p_activity_type, p_orientation_key, p_academic_year, p_aula_entrega_id,
    true, auth.uid(), now(), auth.uid()
  )
  on conflict (activity_type, orientation_key, academic_year) do update
  set aula_entrega_id = excluded.aula_entrega_id,
      enabled = true,
      updated_at = now(),
      updated_by = auth.uid()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function private.set_special_pps_task_v1_impl(text, text, smallint, bigint)
  from public, anon, authenticated;
grant execute on function private.set_special_pps_task_v1_impl(text, text, smallint, bigint)
  to authenticated, service_role;

create or replace function public.set_special_pps_task_v1(
  p_activity_type text,
  p_orientation_key text,
  p_academic_year smallint,
  p_aula_entrega_id bigint
)
returns public.special_pps_task_catalog
language sql
security invoker
set search_path = ''
as $$
  select private.set_special_pps_task_v1_impl(
    p_activity_type, p_orientation_key, p_academic_year, p_aula_entrega_id
  );
$$;

revoke all on function public.set_special_pps_task_v1(text, text, smallint, bigint)
  from public, anon;
grant execute on function public.set_special_pps_task_v1(text, text, smallint, bigint)
  to authenticated, service_role;

create or replace function private.assign_special_pps_v1_impl(
  p_estudiante_id uuid,
  p_activity_type text,
  p_orientation_key text,
  p_academic_year smallint,
  p_expected_hours numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog public.special_pps_task_catalog%rowtype;
  v_task public.aula_entregas%rowtype;
  v_practica_id uuid;
  v_assignment_id uuid;
  v_practice_name text;
  v_orientation_name text;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;
  if p_expected_hours is null or p_expected_hours <= 0 or p_expected_hours > 500 then
    raise exception 'Expected hours must be between 1 and 500' using errcode = '22023';
  end if;
  if not exists (select 1 from public.estudiantes e where e.id = p_estudiante_id) then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  select c.* into v_catalog
  from public.special_pps_task_catalog c
  where c.activity_type = p_activity_type
    and c.orientation_key = case
      when p_orientation_key in ('laboral', 'comunitaria') then 'laboral_comunitaria'
      else p_orientation_key
    end
    and c.academic_year = p_academic_year
    and c.enabled
  for share;

  if v_catalog.id is null then
    raise exception 'No annual Moodle task is configured for this activity and orientation'
      using errcode = 'P0002';
  end if;

  select * into v_task
  from public.aula_entregas ae
  where ae.id = v_catalog.aula_entrega_id
    and ae.activo
    and ae.academic_year = p_academic_year
  for share;

  if v_task.id is null then
    raise exception 'The configured Moodle task is inactive or belongs to another year'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.special_pps_assignments a
    where a.estudiante_id = p_estudiante_id
      and a.activity_type = p_activity_type
      and a.academic_year = p_academic_year
      and a.status = 'assigned'
  ) then
    raise exception 'Student already has this special PPS assigned for the selected year'
      using errcode = '23505';
  end if;

  v_practice_name := case p_activity_type
    when 'relevamiento_profesional' then 'Relevamiento del Ejercicio Profesional en Psicología'
    when 'entrevistas_profesionales' then 'Entrevistas a Profesionales'
  end;
  v_orientation_name := case p_orientation_key
    when 'clinica' then 'Clínica'
    when 'laboral' then 'Laboral'
    when 'comunitaria' then 'Comunitaria'
    when 'educacional' then 'Educacional'
  end;

  insert into public.practicas (
    estudiante_id, lanzamiento_id, horas_realizadas, fecha_inicio,
    fecha_finalizacion, estado, especialidad, nombre_institucion,
    es_online, tipo_actividad, informe_estado
  ) values (
    p_estudiante_id, null, p_expected_hours, null,
    null, 'En curso', v_orientation_name, v_practice_name,
    true, 'actividad_especial', 'a_revisar'
  ) returning id into v_practica_id;

  insert into public.practica_moodle_tareas (
    practica_id, aula_entrega_id, validation_status, link_source,
    rationale, validated_at, validated_by
  ) values (
    v_practica_id, v_task.id, 'confirmed', 'manual',
    format('Asignacion excepcional %s %s por coordinacion', p_activity_type, p_academic_year),
    now(), auth.uid()
  );

  insert into public.special_pps_assignments (
    practica_id, estudiante_id, task_catalog_id, activity_type,
    orientation_key, academic_year, expected_hours, assigned_by
  ) values (
    v_practica_id, p_estudiante_id, v_catalog.id, p_activity_type,
    p_orientation_key, p_academic_year, p_expected_hours, auth.uid()
  ) returning id into v_assignment_id;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'practica_id', v_practica_id,
    'aula_entrega_id', v_task.id,
    'cmid', v_task.moodle_id
  );
end;
$$;

revoke all on function private.assign_special_pps_v1_impl(uuid, text, text, smallint, numeric)
  from public, anon, authenticated;
grant execute on function private.assign_special_pps_v1_impl(uuid, text, text, smallint, numeric)
  to authenticated, service_role;

create or replace function public.assign_special_pps_v1(
  p_estudiante_id uuid,
  p_activity_type text,
  p_orientation_key text,
  p_academic_year smallint,
  p_expected_hours numeric default 20
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.assign_special_pps_v1_impl(
    p_estudiante_id, p_activity_type, p_orientation_key, p_academic_year, p_expected_hours
  );
$$;

revoke all on function public.assign_special_pps_v1(uuid, text, text, smallint, numeric)
  from public, anon;
grant execute on function public.assign_special_pps_v1(uuid, text, text, smallint, numeric)
  to authenticated, service_role;

create or replace function private.cancel_special_pps_assignment_v1_impl(
  p_assignment_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.special_pps_assignments%rowtype;
begin
  if not private.moodle_v2_is_coordinator() then
    raise exception 'Coordinator access required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancellation reason is required' using errcode = '22023';
  end if;

  select * into v_assignment
  from public.special_pps_assignments a
  where a.id = p_assignment_id
    and a.status = 'assigned'
  for update;

  if v_assignment.id is null then
    return false;
  end if;

  update public.special_pps_assignments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = btrim(p_reason)
  where id = v_assignment.id;

  delete from public.practica_moodle_tareas
  where practica_id = v_assignment.practica_id;

  update public.practicas
  set estado = 'Cancelada', informe_estado = null
  where id = v_assignment.practica_id;

  return true;
end;
$$;

revoke all on function private.cancel_special_pps_assignment_v1_impl(uuid, text)
  from public, anon, authenticated;
grant execute on function private.cancel_special_pps_assignment_v1_impl(uuid, text)
  to authenticated, service_role;

create or replace function public.cancel_special_pps_assignment_v1(
  p_assignment_id uuid,
  p_reason text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_special_pps_assignment_v1_impl(p_assignment_id, p_reason);
$$;

revoke all on function public.cancel_special_pps_assignment_v1(uuid, text) from public, anon;
grant execute on function public.cancel_special_pps_assignment_v1(uuid, text)
  to authenticated, service_role;

-- Backfill verificable: estas son las tareas anuales que efectivamente existen
-- hoy. Relevamiento 906164/6/7 pertenece a 2025; Entrevistas 1097090 a 2026.
insert into public.special_pps_task_catalog (
  activity_type, orientation_key, academic_year, aula_entrega_id,
  enabled, created_by, updated_by
)
select seed.activity_type, seed.orientation_key, seed.academic_year, ae.id,
       true, null, null
from (values
  ('relevamiento_profesional', 'clinica', 2025::smallint, '906164'),
  ('relevamiento_profesional', 'laboral_comunitaria', 2025::smallint, '906166'),
  ('relevamiento_profesional', 'educacional', 2025::smallint, '906167'),
  ('entrevistas_profesionales', 'laboral_comunitaria', 2026::smallint, '1097090')
) as seed(activity_type, orientation_key, academic_year, moodle_id)
join public.aula_entregas ae
  on ae.course_id = 3615
 and ae.moodle_id = seed.moodle_id
 and ae.academic_year = seed.academic_year
on conflict (activity_type, orientation_key, academic_year) do update
set aula_entrega_id = excluded.aula_entrega_id,
    enabled = true,
    updated_at = now();

commit;
