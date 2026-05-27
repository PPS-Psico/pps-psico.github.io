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
- `POST /tasks/draft_reply` — header `X-Hermes-Token: <HERMES_INTERNAL_TOKEN>`.

## Modo

`HERMES_MODE=shadow` por defecto. Nunca cambies a algo que ejecute acciones
sin antes implementar la compuerta de aprobación humana en el panel.
