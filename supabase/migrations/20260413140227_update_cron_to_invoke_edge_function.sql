select cron.unschedule('check-consentimiento-pendientes');

select cron.schedule(
  'check-consentimiento-pendientes',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://qxnxtnhtbpsgzprqtrjl.supabase.co/functions/v1/check-consentimiento-pendientes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);