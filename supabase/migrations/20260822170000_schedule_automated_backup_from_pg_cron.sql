-- Mueve el disparo del backup diario de GitHub Actions a pg_cron.
--
-- POR QUE
--
-- El backup lo agendaba `.github/workflows/automated-backup.yml`, que mandaba
-- `X-API-Key: ${{ secrets.CRON_SECRET }}`. Eso obligaba a tener el MISMO
-- secreto en dos lugares: el secret de GitHub y el `CRON_SECRET` de las Edge
-- Functions de Supabase.
--
-- El 2026-07-27 14:44 se roto el secreto del lado de Supabase. El de GitHub
-- quedo con el valor del 2026-02-14. Desde el 28/07 todas las corridas
-- respondieron 401 y el sistema estuvo 26 dias sin backup. Nadie se entero:
-- el ultimo backup real quedo fechado 2026-07-27 05:54.
--
-- Los otros 7 jobs agendados nunca se rompieron porque leen el secreto del
-- vault en cada corrida. El backup era el unico con una copia que mantener
-- sincronizada a mano, y esa copia fue justamente la que fallo.
--
-- Con este cambio hay una sola fuente de verdad (`vault.cron_secret`) y rotar
-- el secreto no vuelve a romper nada.
--
-- QUE PASA CON EL DISPARO MANUAL
--
-- No se pierde: el panel de admin (`BackupManager`) llama a la funcion con la
-- sesion del administrador, no con `CRON_SECRET`. Ese camino sigue igual.
--
-- SOBRE EL TIMEOUT
--
-- `net.http_post` corta a los 5s por defecto y un backup completo tarda mas
-- (lee 8 tablas y sube ~3,5 MB). El corte no cancelaria el backup -- la Edge
-- Function sigue corriendo del lado del servidor -- pero dejaria `status_code`
-- en NULL y perderiamos la senal. Con 90s la respuesta entra y queda
-- registrada en `net._http_response`.

do $$
begin
  perform cron.unschedule('automated-backup-daily');
exception
  when others then
    null;
end;
$$;

-- 02:00 UTC: misma hora que tenia el workflow de GitHub (`0 2 * * *`) y que
-- `backup_config.backup_time`.
select cron.schedule(
  'automated-backup-daily',
  '0 2 * * *',
  $$
    select net.http_post(
      url := 'https://qxnxtnhtbpsgzprqtrjl.supabase.co/functions/v1/automated-backup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 90000
    );
  $$
);
