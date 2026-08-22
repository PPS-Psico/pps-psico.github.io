-- Registra en el repo el cron de consentimientos que YA corre en produccion.
--
-- Esta migracion no cambia nada: reproduce, tal cual, el comando que hoy tiene
-- `cron.job`. Existe porque el ultimo archivo que tocaba este cron
-- (`20260413140609_fix_cron_with_anon_key.sql`) quedo viejo. Ese archivo agenda
-- el POST con la anon key, pero la funcion `check-consentimiento-pendientes`
-- exige `X-API-Key: CRON_SECRET` o una sesion admin, asi que ese comando
-- responderia 401. En algun momento se corrigio a mano contra la base y el
-- archivo nunca se actualizo -- en este proyecto las migraciones se aplican con
-- `db query --linked`, no con `db push`, y el drift es facil.
--
-- Estado real al 2026-08-22, verificado antes de escribir esto:
--   - `cron.job`: usa `X-API-Key` leido de `vault.decrypted_secrets`
--   - 432 corridas en 3 dias, todas `succeeded`
--   - `net._http_response`: 200 en todas, ningun 401
--
-- O sea: produccion esta bien y el repo estaba mal. Sin esto, cualquiera que
-- reconstruya el entorno desde las migraciones levanta el cron roto, y las
-- bajas automaticas por consentimiento no vencido dejan de ejecutarse en
-- silencio.
--
-- El secreto se lee del vault en cada corrida en vez de quedar escrito aca:
-- rotarlo no requiere una migracion nueva, y no queda material sensible en git.

do $$
begin
  perform cron.unschedule('check-consentimiento-pendientes');
exception
  when others then
    null;
end;
$$;

-- Cada 10 minutos: misma cadencia que `publish-scheduled-launches`.
select cron.schedule(
  'check-consentimiento-pendientes',
  '*/10 * * * *',
  $$
    select net.http_post(
      url := 'https://qxnxtnhtbpsgzprqtrjl.supabase.co/functions/v1/check-consentimiento-pendientes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
