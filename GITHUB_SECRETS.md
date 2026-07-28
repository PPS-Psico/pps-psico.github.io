# GitHub Secrets y configuracion de entornos

Los secretos de CI/CD y los secretos de Edge Functions pertenecen a almacenes distintos.
Nunca deben guardarse en variables `VITE_*`, Markdown, logs ni codigo fuente.

## GitHub Actions

### Build del frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` o publishable key equivalente
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_GA4_MEASUREMENT_ID`
- opcionales: `VITE_SENTRY_DSN`, `VITE_APP_VERSION`, `VITE_ENABLE_MONITORING_IN_DEV`

### Despliegue de Edge Functions

- `SUPABASE_ACCESS_TOKEN`: PAT de Supabase con permiso para desplegar.
- `SUPABASE_PROJECT_REF`: referencia del proyecto, no una URL.

### Workflow de backup

- `SUPABASE_PROJECT_REF`
- `CRON_SECRET`: mismo valor que el secreto server-side de Supabase.

## Supabase Edge Function Secrets

Los built-ins `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los
provee Supabase. Según las funciones habilitadas también se requieren:

- `CRON_SECRET`
- `GEMINI_API_KEY`
- `HERMES_API_URL`
- `HERMES_INTERNAL_TOKEN`
- `FCM_SERVICE_ACCOUNT_KEY`
- credenciales del proveedor de email usadas por `send-email`
- `TURNSTILE_SECRET_KEY` para recuperación de acceso, cuando corresponda

## Reglas operativas

1. `.env.example` solo documenta configuración pública de desarrollo.
2. Hermes se consume desde `hermes-proxy`; no existen variables `VITE_HERMES_*`.
3. `restore-backup` no se despliega automáticamente.
4. Rotar fuera del repo toda credencial que haya aparecido en un bundle o commit público.
5. Verificar los nombres efectivos en `docs/edge-functions-inventory.md` antes de cambiar CI.
