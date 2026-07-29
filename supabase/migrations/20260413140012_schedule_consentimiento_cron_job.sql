select cron.schedule(
  'check-consentimiento-pendientes',
  '*/10 * * * *',
  $$select public.process_consentimiento_timeouts();$$
);