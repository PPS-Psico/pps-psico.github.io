-- Endurece funciones SECURITY DEFINER que quedaban ejecutables por anon sin razón.
-- Triggers/cron: revocar todo menos service_role (los triggers se disparan igual,
-- no usan el grant EXECUTE; el cron corre como postgres/service_role).
do $$
declare
  f text;
  internal text[] := array[
    'public.process_consentimiento_timeouts()',
    'public.check_practica_updates()',
    'public.log_practica_update()',
    'public.set_cohorte_on_activity()',
    'public.calc_cohorte_estudiante(uuid)'
  ];
begin
  foreach f in array internal loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- increment_snooze_count: RPC de reminders (acción de admin autenticado). Sin anon.
revoke execute on function public.increment_snooze_count(uuid) from public, anon;
grant execute on function public.increment_snooze_count(uuid) to authenticated, service_role;
