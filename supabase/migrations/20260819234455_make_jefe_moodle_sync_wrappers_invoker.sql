-- Los RPC publicos no necesitan elevar privilegios: los impl privados ya
-- validan auth.uid(), rol, identidad Moodle y areas. Mantener el wrapper como
-- invoker evita exponer una funcion SECURITY DEFINER en el schema de API.

create or replace function public.get_jefe_moodle_sync_tasks_v1()
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
  select * from private.get_jefe_moodle_sync_tasks_v1_impl();
$$;

create or replace function public.sync_jefe_moodle_reports_v1(
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
  select private.sync_jefe_moodle_reports_v1_impl(
    p_request_id,
    p_course_id,
    p_academic_year,
    p_observed_at,
    p_actor_moodle_user_id,
    p_actor_moodle_username,
    p_tasks
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.get_jefe_moodle_sync_tasks_v1_impl()
  to authenticated, service_role;
grant execute on function private.sync_jefe_moodle_reports_v1_impl(
  uuid, bigint, integer, timestamptz, bigint, text, jsonb
) to authenticated, service_role;

revoke all on function public.get_jefe_moodle_sync_tasks_v1()
  from public, anon;
revoke all on function public.sync_jefe_moodle_reports_v1(
  uuid, bigint, integer, timestamptz, bigint, text, jsonb
) from public, anon;
grant execute on function public.get_jefe_moodle_sync_tasks_v1()
  to authenticated;
grant execute on function public.sync_jefe_moodle_reports_v1(
  uuid, bigint, integer, timestamptz, bigint, text, jsonb
) to authenticated;
