# GitHub Secrets y configuracion de entornos

Este proyecto usa GitHub Secrets para inyectar configuracion en build y despliegue, y usa secretos separados dentro de Supabase para Edge Functions.

## Secrets de GitHub Actions

### Requeridos

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_GA4_MEASUREMENT_ID`

### Recomendados

- `VITE_SENTRY_DSN`
- `VITE_APP_VERSION`
- `VITE_ENABLE_MONITORING_IN_DEV`

### Cuando corresponda al flujo operativo

- `CRON_SECRET`

`CRON_SECRET` debe coincidir con la configuracion esperada por las funciones o procesos automatizados que lo usan.

## Secrets de Supabase Edge Functions

Segun el modulo activo, pueden ser necesarios:

- `GEMINI_API_KEY`
- `VAPID_PRIVATE_KEY`
- otros secretos internos de automatizacion o proveedores externos

Estos secretos no deben vivir en el frontend ni en el repo.

## Notas importantes

- `VITE_GEMINI_API_KEY` no debe volver a usarse como secreto de frontend.
- Las variables `VITE_AIRTABLE_PAT` y `VITE_AIRTABLE_BASE_ID` deben tratarse como legado, no como arquitectura principal.
- Nunca documentar tokens reales ni pegar credenciales en Markdown.

## Flujo recomendado

1. Mantener `.env.example` sin valores reales.
2. Guardar secretos de CI/CD en GitHub.
3. Guardar secretos server-side en Supabase.
4. Revisar documentacion si cambia un proveedor, una funcion Edge o un entorno.
