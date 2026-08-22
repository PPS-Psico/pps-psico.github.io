# Inventario canónico de Supabase Edge Functions

Última verificación: 22 de agosto de 2026. Proyecto: `qxnxtnhtbpsgzprqtrjl`.
La fuente local está en `supabase/functions/` y la política JWT en `supabase/config.toml`.

## Reglas de despliegue

- `.github/workflows/deploy-edge-functions.yml` despliega las 19 funciones canónicas al fusionar a `main`.
- Desplegado y repo coinciden: 19 y 19. Si esa cuenta deja de dar, hay drift.
- `send-push` y `onesignal-verify` fueron **eliminadas el 2026-08-22**. Eran legado de la etapa OneSignal (FCM → VAPID → OneSignal → FCM), leían la tabla `push_subscriptions` que ya no existe y ningún cliente las invocaba. La fuente vive en git en `59e2f08^`.
- **Todo lo agendado se dispara desde `pg_cron`, nunca desde GitHub Actions.** El secreto se lee de `vault.decrypted_secrets` en cada corrida, asi que rotarlo no rompe nada. `automated-backup.yml` existia y mandaba una copia del `CRON_SECRET` guardada aparte en GitHub: al rotarse el secreto el 2026-07-27, esa copia quedo vieja y el backup estuvo 26 dias caido devolviendo 401. Se elimino el workflow y el backup pasó a `pg_cron` (`automated-backup-daily`, 02:00 UTC) el 2026-08-22. Si alguna vez hace falta agendar algo nuevo, va en `pg_cron`.
- Se usan imports directos de `esm.sh`; no se permiten `deno.json`, import maps ni JSR en la fuente efectiva.
- `verify_jwt = false` solo se admite con autenticación interna de cron o para un endpoint público deliberado.

## Estado productivo verificado

| Función                               | Versión | JWT | Estado                                             |
| ------------------------------------- | ------: | :-: | -------------------------------------------------- |
| `automated-backup`                    |     v22 | no  | canónica; autenticación `X-API-Key` o sesión admin |
| `check-consentimiento-pendientes`     |     v20 | no  | canónica; cron cada 10 min                         |
| `generate-content`                    |     v23 | sí  | canónica                                           |
| `health-check`                        |     v15 | no  | pública; chequea DB, storage y frescura del backup |
| `hermes-proxy`                        |      v7 | sí  | canónica; roles `admin`/`SuperUser` y allowlist    |
| `ingest-moodle-grade-export`          |      v2 | sí  | canónica                                           |
| `ingest-moodle-grade-observation`     |     v11 | sí  | canónica                                           |
| `issue-moodle-signup-ticket`          |      v2 | no  | canónica                                           |
| `launch-scheduler`                    |     v34 | no  | canónica; disparo manual (el cron lo hace en SQL)  |
| `list-backups`                        |     v16 | sí  | canónica                                           |
| `moodle-autologin`                    |     v16 | sí  | canónica; autologin estricto solo para alumnos     |
| `register-moodle-student`             |      v5 | no  | canónica                                           |
| `request-password-reset`              |      v8 | sí  | canónica                                           |
| `reset-password-with-token`           |      v7 | sí  | canónica                                           |
| `restore-backup`                      |     v10 | sí  | canónica; **desplegada es de feb-2026**, ver nota  |
| `send-consentimiento-final-reminders` |      v4 | sí  | canónica; disparo manual desde el Lanzador         |
| `send-email`                          |     v46 | sí  | canónica                                           |
| `send-fcm-notification`               |     v47 | sí  | canónica; autorización server-side                 |
| `student-login`                       |      v6 | sí  | canónica                                           |

Supabase todavía informa `import_map=true` para `automated-backup`, `generate-content` y `list-backups`, con rutas de versiones antiguas. `get_edge_function` confirmó que los paquetes efectivos actuales contienen solo `index.ts` con imports `esm.sh`; se trata de metadata histórica.

**Nota sobre `restore-backup` e `ingest-moodle-grade-export`**: hasta el 2026-08-22 ninguna de las dos estaba en la lista de despliegue del workflow, pese a estar declaradas en `config.toml`. Se agregaron. Consecuencia: lo desplegado de `restore-backup` es la v10 del 2026-02-12, seis meses más viejo que el repo. El próximo merge a `main` lo va a actualizar.

## Verificación posterior al despliegue

- PR #5 fusionada en `main` mediante `5cc583a`.
- Workflow de Edge Functions y CI/CD Pages: exitosos.
- A las 23:20 UTC, `check-consentimiento-pendientes` v15 respondió 200 y terminó con 0 pendientes.
- A las 23:20 UTC, `launch-scheduler` v31 respondió 200 y no encontró publicaciones pendientes.
- Ambas versiones registraron `booted`; no hubo `BOOT_ERROR`.
- No se ejecutó una restauración, un backup real ni un envío FCM real como smoke test.

## Secretos pendientes de rotación

La credencial Hermes antes publicada debe rotarse coordinadamente en Hermes/n8n/VPS y actualizarse como `HERMES_INTERNAL_TOKEN` en Supabase. También se detectó un token Todoist trackeado en `claude_desktop_config.json`: fue retirado de la copia actual, pero debe revocarse y reemplazarse desde el entorno local. No se reescribe historia sin aprobación explícita.
