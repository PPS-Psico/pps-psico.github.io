-- Los default privileges del proyecto conceden EXECUTE a anon/authenticated al
-- crear funciones. Estas dos RPC son internas de la Edge Function y deben
-- quedar disponibles exclusivamente para service_role.

revoke all on function public.claim_consentimiento_final_reminder_batch(
  uuid,
  uuid,
  uuid,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_consentimiento_final_reminder_batch(
  uuid,
  uuid,
  uuid,
  timestamptz
) to service_role;

revoke all on function public.finish_consentimiento_final_reminder(
  uuid,
  uuid,
  boolean
) from public, anon, authenticated;
grant execute on function public.finish_consentimiento_final_reminder(
  uuid,
  uuid,
  boolean
) to service_role;
