# Inventario canónico de Supabase Edge Functions

Última reconciliación: 28 de julio de 2026. Proyecto: `qxnxtnhtbpsgzprqtrjl`.
La fuente local está en `supabase/functions/` y la política JWT en `supabase/config.toml`.

## Reglas de despliegue

- `.github/workflows/deploy-edge-functions.yml` despliega 13 funciones canónicas al fusionar a `main`.
- `restore-backup` es canónica pero queda en hold manual por ser destructiva.
- `send-push` y `onesignal-verify` existen solo en producción como legado; no se retiran sin confirmación explícita.
- Las funciones usan imports directos de `esm.sh`; no se permiten `deno.json`, import maps ni JSR.
- `verify_jwt = false` solo se usa cuando existe autenticación interna para cron o un endpoint público deliberado.

## Estado local y remoto

| Función                           | Remota | JWT canónico | Consumidor principal                | Estado                                               |
| --------------------------------- | -----: | :----------: | ----------------------------------- | ---------------------------------------------------- |
| `automated-backup`                |    v18 |      no      | workflow diario y admin             | canónica; normalizada localmente                     |
| `check-consentimiento-pendientes` |    v14 |      no      | pg_cron cada 10 min                 | canónica                                             |
| `generate-content`                |    v19 |      sí      | panel admin                         | canónica; import map remoto pendiente de reemplazo   |
| `health-check`                    |    v14 |      no      | monitoreo                           | canónica y pública                                   |
| `hermes-proxy`                    |     v3 |      sí      | panel admin                         | canónica; roles `admin`/`SuperUser`                  |
| `launch-scheduler`                |    v30 |      no      | pg_cron cada 10 min y admin         | canónica                                             |
| `list-backups`                    |    v12 |      sí      | `BackupManager`                     | canónica; import map remoto pendiente de reemplazo   |
| `moodle-autologin`                |     v8 |      sí      | onboarding Moodle                   | canónica                                             |
| `request-password-reset`          |     v4 |      sí      | recuperación de acceso              | canónica                                             |
| `reset-password-with-token`       |     v4 |      sí      | recuperación de acceso              | canónica                                             |
| `restore-backup`                  |    v10 |      sí      | `BackupManager`                     | canónica, manual/hold; no auto-deploy                |
| `send-email`                      |    v42 |      sí      | flujos administrativos              | canónica                                             |
| `send-fcm-notification`           |    v43 |      sí      | selección, lanzador y pruebas admin | canónica; autorización interna endurecida localmente |
| `student-login`                   |     v3 |      sí      | autenticación de estudiante         | canónica                                             |
| `send-push`                       |    v42 |      sí      | sin consumidor activo               | legacy remoto; retiro pendiente de aprobación        |
| `onesignal-verify`                |     v9 |      sí      | sin consumidor activo               | legacy remoto; retiro pendiente de aprobación        |

## Autenticación y secretos

| Función                           | Autenticación interna                               | Secretos adicionales                                                               |
| --------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `automated-backup`                | `X-API-Key` de cron o sesión con rol admin          | `CRON_SECRET`                                                                      |
| `check-consentimiento-pendientes` | `X-API-Key` de cron o sesión admin                  | `CRON_SECRET`, `APP_URL`                                                           |
| `generate-content`                | sesión y rol admin                                  | `GEMINI_API_KEY`                                                                   |
| `health-check`                    | endpoint público, solo estado estático              | ninguno                                                                            |
| `hermes-proxy`                    | sesión; roles `admin`/`SuperUser`; allowlist        | `HERMES_API_URL`, `HERMES_INTERNAL_TOKEN`                                          |
| `launch-scheduler`                | `X-API-Key` de cron o sesión admin                  | `CRON_SECRET`                                                                      |
| `list-backups`                    | sesión y rol administrativo                         | ninguno adicional                                                                  |
| `moodle-autologin`                | sesión válida; no crea sesiones desde FilterCodes   | ninguno adicional                                                                  |
| `request-password-reset`          | contrato público controlado por gateway y Turnstile | `APP_URL`, `TURNSTILE_SECRET_KEY`, `IP_HASH_SECRET`, `SMTP_EMAIL`, `SMTP_PASSWORD` |
| `reset-password-with-token`       | JWT exigido por gateway y token de recuperación     | ninguno adicional                                                                  |
| `restore-backup`                  | sesión y rol administrativo + confirmación UI       | ninguno adicional                                                                  |
| `send-email`                      | service role o sesión con rol admin                 | `SMTP_EMAIL`, `SMTP_PASSWORD`                                                      |
| `send-fcm-notification`           | service role o sesión con rol admin                 | `FCM_SERVICE_ACCOUNT_KEY`                                                          |
| `student-login`                   | contrato de autenticación propio tras gateway       | ninguno adicional                                                                  |

Todas usan los built-ins de Supabase que correspondan: `SUPABASE_URL`,
`SUPABASE_ANON_KEY` y/o `SUPABASE_SERVICE_ROLE_KEY`.

## Drift confirmado al iniciar esta reconciliación

En producción, `automated-backup`, `generate-content`, `list-backups` y
`restore-backup` todavía referencian import maps. La fuente local ya fue normalizada.
`automated-backup` remoto conserva `verify_jwt=true`, mientras que el contrato canónico
es `false` porque el cron autentica por `X-API-Key`; el código interno rechaza requests
anónimos. Este drift se cierra únicamente al desplegar la revisión validada.

La credencial Hermes que estuvo embebida en frontend y snapshots públicos debe rotarse
en Hermes/n8n/VPS y actualizarse como `HERMES_INTERNAL_TOKEN` en Supabase. La limpieza
del código no invalida por sí sola una credencial ya publicada.
