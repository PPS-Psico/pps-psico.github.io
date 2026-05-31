# hermes-pps

Servicio HTTP que razona sobre los datos del panel y devuelve **propuestas**
(nunca acciones). Lo invoca n8n; el operador revisa el resultado en el panel.

## Deploy en el VPS

```bash
# en el VPS
cd /opt
git clone <repo> consulta-pps-uflo
cd consulta-pps-uflo/agent/hermes-pps

cp .env.example .env
nano .env                       # completar todas las variables

# generar Basic Auth para Traefik
htpasswd -nb blas TU_PASS       # copiar al BASIC_AUTH_USERS escapando $ -> $$

# crear el vault si no existe
mkdir -p /opt/obsidian-pps
cp -r /opt/consulta-pps-uflo/docs/obsidian-vault-template/* /opt/obsidian-pps/

# levantar
docker compose up -d --build
docker compose logs -f hermes-pps
```

DNS previo: registro A `pps-hermes.n8n-blas.com.ar → 129.121.60.217` en Cloudflare
(DNS only, nube gris). Traefik se encarga del cert Let's Encrypt automático.

## Endpoints

- `GET /health` — sin auth, devuelve modo y modelo.
- `POST /tasks/daily_brief` — header `X-Hermes-Token: <HERMES_INTERNAL_TOKEN>`.
- `POST /tasks/daily_brief_from_db` — ídem; arma el brief leyendo Supabase directo.
- `POST /tasks/plan_today` — ídem; arma el tablero "Hoy con Hermes" (acciones del día).
- `POST /tasks/draft_reply` — header `X-Hermes-Token: <HERMES_INTERNAL_TOKEN>`.

## Regeneración automática (scheduler interno)

El servicio trae un scheduler propio que corre dentro del contenedor (no
depende de configurar n8n aparte). Cada mañana:

- **Borradores de correo**: a `HERMES_DRAFT_EMAILS_AT` (default 07:55, 10 min
  antes del plan) genera los borradores de respuesta faltantes para los correos
  esperando respuesta, así "Hoy con Hermes" ya los muestra listos.
- **Plan del día** ("Hoy con Hermes"): se regenera a `HERMES_PLAN_TODAY_AT`
  (default 08:05 hora local). Incluye los borradores de reactivación (WhatsApp o
  email) de las solicitudes estancadas.
- **Daily brief de respaldo**: a `HERMES_DAILY_BRIEF_AT` (default 08:30) genera
  el brief **solo si n8n no lo generó todavía** (no pisa el de n8n; corre 30 min
  después del cron de n8n para darle margen). Así el panel nunca queda sin análisis.

Config en `.env` (todas opcionales, con defaults sanos):

| Variable                      | Default | Qué hace                               |
| ----------------------------- | ------- | -------------------------------------- |
| `HERMES_SCHEDULER_ENABLED`    | `1`     | `0` apaga el scheduler                 |
| `HERMES_TZ_OFFSET`            | `-3`    | offset horario vs UTC (Argentina = -3) |
| `HERMES_DRAFT_EMAILS_ENABLED` | `1`     | `0` apaga la generación de borradores  |
| `HERMES_DRAFT_EMAILS_AT`      | `07:55` | hora local de los borradores de correo |
| `HERMES_DRAFT_EMAILS_LIMIT`   | `40`    | máx. de hilos a procesar por corrida   |
| `HERMES_PLAN_TODAY_AT`        | `08:05` | hora local del plan del día            |
| `HERMES_DAILY_BRIEF_AT`       | `08:30` | hora local del brief de respaldo       |
| `HERMES_DAILY_BRIEF_FALLBACK` | `1`     | `1` solo si falta el de hoy; `0` nunca |

Tras `docker compose up -d --build`, en los logs deberías ver
`[scheduler] activo · plan_today 08:05 · daily_brief 08:30 · draft_emails 07:55 (UTC-3)`.

> Pensado para un único worker uvicorn (como arranca el contenedor por
> defecto). Con `--workers > 1` habría que mover el scheduler a un proceso
> aparte para no disparar los jobs varias veces.

## Modo

`HERMES_MODE=shadow` por defecto. Nunca cambies a algo que ejecute acciones
sin antes implementar la compuerta de aprobación humana en el panel.

## Verificación de doble pasada (`verify_finalizacion`)

`verify_finalizacion` analiza los 3 documentos de finalización contra el
lanzamiento. Como un falso "verified" en una acreditación es el error más caro,
por defecto corre una **segunda pasada**: un verificador independiente audita el
veredicto de la primera antes de persistir (idea tomada del _verifier node_ del
modo Swarm de [Hermes Agent](https://hermes-agent.nousresearch.com/) de Nous
Research — que **no** es la base de este servicio; ver nota abajo).

- Cuesta ~1 llamada LLM extra por verificación (centavos a este volumen).
- Degrada con elegancia: si la segunda pasada falla, se queda con el resultado
  de la primera (nunca peor que sin doble pasada).
- El veredicto del verificador queda en `agent_suggestions.contexto.verificador`
  y en `agent_audit_log`.
- Apagable con `HERMES_DOUBLE_CHECK_VERIFY=0`.

> **Nota sobre el nombre.** Este servicio (`hermes-pps`) es una implementación
> propia en FastAPI + OpenRouter, **no** el framework open-source "Hermes Agent"
> de Nous Research (que comparte nombre). De ese proyecto solo tomamos ideas
> sueltas cuando aplican; no es una dependencia.
