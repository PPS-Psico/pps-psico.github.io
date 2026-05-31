# n8n-workflows

Exports JSON de los workflows n8n del proyecto Hermes-PPS. Se versionan acá
como fuente de verdad; el editor n8n en el VPS es solo entorno de ejecución.

## Cómo importar

1. Editar el JSON: reemplazar `REEMPLAZAR-SUPABASE-CRED-ID` y `REEMPLAZAR-GMAIL-CRED-ID`
   por los IDs reales de las credenciales en tu instancia n8n. (También se
   puede dejar como está y reasignar en la UI tras importar.)
2. En `https://n8n-blas.com.ar` → Workflows → Import from File.
3. Antes de activarlo, definir la env var `HERMES_INTERNAL_TOKEN` en el contenedor
   n8n (debe matchear con la del `.env` de `hermes-pps`).
4. Ejecutar a mano una vez (Test workflow) para verificar.

## Workflows

- **01-daily-brief.json** — Cron 8am L-V. Lee Supabase (5 queries en paralelo),
  consolida el payload, llama a `hermes-pps`, manda el brief por mail a
  `blas.rivera@uflouniversidad.edu.ar`. La sugerencia queda persistida en
  `agent_suggestions` para revisión desde el panel.
- **02-gmail-sync.json** — Cron 7/13/19 L-V. Lista los mails recientes del INBOX
  y los sincroniza a `gmail_hilos` vía `hermes-pps`.
- **05-gmail-actions.json** — Webhook `POST /webhook/gmail-actions`. Recibe del
  panel (vía Hermes) acciones sobre un hilo: `getThread` (leer cuerpo completo),
  `send` (responder) y `modify` (archivar / marcar leído / papelera). Usa la
  credencial Gmail OAuth2. Es el backend de la bandeja de Mails de Gestión.
  Setear en `hermes-pps` la env var `GMAIL_ACTION_WEBHOOK_URL` apuntando a este
  webhook. El panel nunca toca Gmail directo: panel → Hermes → n8n → Gmail.

## Credenciales requeridas en n8n

- **Supabase UFLO PPS** (`supabaseApi`): URL del proyecto + service role key.
- **Gmail — blas.rivera@uflouniversidad.edu.ar** (`gmailOAuth2`): OAuth con
  scopes `gmail.send` (responder), `gmail.readonly` (leer hilo) y `gmail.modify`
  (archivar / marcar leído / mover a papelera). Los tres son necesarios para que
  la bandeja de Mails del panel funcione completa.
