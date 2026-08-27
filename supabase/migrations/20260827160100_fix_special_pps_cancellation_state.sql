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
  set estado = 'No se pudo concretar', informe_estado = null
  where id = v_assignment.practica_id;

  return true;
end;
$$;

revoke all on function private.cancel_special_pps_assignment_v1_impl(uuid, text)
  from public, anon, authenticated;
grant execute on function private.cancel_special_pps_assignment_v1_impl(uuid, text)
  to authenticated, service_role;
