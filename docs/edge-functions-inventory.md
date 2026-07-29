# Inventario canónico de Supabase Edge Functions

Última verificación: 28 de julio de 2026. Proyecto: `qxnxtnhtbpsgzprqtrjl`.
La fuente local está en `supabase/functions/` y la política JWT en `supabase/config.toml`.

## Reglas de despliegue

- `.github/workflows/deploy-edge-functions.yml` despliega 13 funciones canónicas al fusionar a `main`.
- `restore-backup` es canónica pero permanece en hold manual por ser destructiva.
- `send-push` y `onesignal-verify` son legado remoto; no se retiran sin aprobación explícita.
- Se usan imports directos de `esm.sh`; no se permiten `deno.json`, import maps ni JSR en la fuente efectiva.
- `verify_jwt = false` solo se admite con autenticación interna de cron o para un endpoint público deliberado.

## Estado productivo verificado

| Función                           | Versión | JWT | Estado                                             |
| --------------------------------- | ------: | :-: | -------------------------------------------------- |
| `automated-backup`                |     v19 | no  | canónica; autenticación `X-API-Key` o sesión admin |
| `check-consentimiento-pendientes` |     v15 | no  | canónica; cron cada 10 min                         |
| `generate-content`                |     v20 | sí  | canónica                                           |
| `health-check`                    |     v15 | no  | pública; solo estado estático                      |
| `hermes-proxy`                    |      v4 | sí  | canónica; roles `admin`/`SuperUser` y allowlist    |
| `launch-scheduler`                |     v31 | no  | canónica; cron cada 10 min                         |
| `list-backups`                    |     v13 | sí  | canónica                                           |
| `moodle-autologin`                |      v9 | sí  | canónica; no crea sesiones desde FilterCodes       |
| `request-password-reset`          |      v4 | sí  | canónica                                           |
| `reset-password-with-token`       |      v4 | sí  | canónica                                           |
| `restore-backup`                  |     v10 | sí  | manual/hold; no auto-deploy                        |
| `send-email`                      |     v42 | sí  | canónica                                           |
| `send-fcm-notification`           |     v44 | sí  | canónica; autorización server-side                 |
| `student-login`                   |      v3 | sí  | canónica                                           |
| `send-push`                       |     v42 | sí  | legacy remoto; sin consumidor activo confirmado    |
| `onesignal-verify`                |      v9 | sí  | legacy remoto; sin consumidor activo confirmado    |

Supabase todavía informa `import_map=true` para `automated-backup`, `generate-content` y `list-backups`, con rutas de versiones antiguas. `get_edge_function` confirmó que los paquetes efectivos actuales contienen solo `index.ts` con imports `esm.sh`; se trata de metadata histórica. `restore-backup` conserva su paquete remoto anterior porque no fue desplegada.

## Verificación posterior al despliegue

- PR #5 fusionada en `main` mediante `5cc583a`.
- Workflow de Edge Functions y CI/CD Pages: exitosos.
- A las 23:20 UTC, `check-consentimiento-pendientes` v15 respondió 200 y terminó con 0 pendientes.
- A las 23:20 UTC, `launch-scheduler` v31 respondió 200 y no encontró publicaciones pendientes.
- Ambas versiones registraron `booted`; no hubo `BOOT_ERROR`.
- No se ejecutó una restauración, un backup real ni un envío FCM real como smoke test.

## Secretos pendientes de rotación

La credencial Hermes antes publicada debe rotarse coordinadamente en Hermes/n8n/VPS y actualizarse como `HERMES_INTERNAL_TOKEN` en Supabase. También se detectó un token Todoist trackeado en `claude_desktop_config.json`: fue retirado de la copia actual, pero debe revocarse y reemplazarse desde el entorno local. No se reescribe historia sin aprobación explícita.
