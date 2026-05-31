# Deploy de Hermes-PPS — acceso al VPS y procedimiento

> Operación de **producción**. Leer entero antes de ejecutar.
> Este documento NO contiene secretos. Las credenciales viven en el gestor de
> contraseñas del equipo (ver §Credenciales).

---

## 1. Datos del servidor (no secretos)

| Dato                                 | Valor                                     |
| ------------------------------------ | ----------------------------------------- |
| Dominio del agente                   | `https://pps-hermes.n8n-blas.com.ar`      |
| IP pública (Cloudflare, DNS only)    | `129.121.60.217`                          |
| Ruta del proyecto en el VPS          | `/opt/consulta-pps-uflo`                  |
| Ruta del agente                      | `/opt/consulta-pps-uflo/agent/hermes-pps` |
| Stack n8n/Traefik                    | `/opt/n8n-traefik/`                       |
| Vault Obsidian (montado en `/vault`) | `/opt/obsidian-pps/`                      |
| Usuario SSH                          | `root`                                    |
| Red Docker externa                   | `n8n-traefik_app_network`                 |

## 2. Acceso (SSH)

El acceso recomendado es por **clave SSH**, no por contraseña. Ya hay una clave de
deploy autorizada en el servidor (`claude-code@hermes-pps-deploy` en
`/root/.ssh/authorized_keys`).

```bash
ssh root@129.121.60.217
```

### Si necesitás configurar tu propia clave (recomendado, una sola vez)

```bash
# en tu máquina local
ssh-keygen -t ed25519 -C "deploy@pps"          # genera ~/.ssh/id_ed25519(.pub)
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@129.121.60.217
# a partir de acá, `ssh root@129.121.60.217` entra sin pedir contraseña
```

### Credenciales

- **No se documentan contraseñas en este repo.** La contraseña de `root` (acceso de
  emergencia / consola del proveedor) está en el **gestor de contraseñas del equipo**
  bajo la entrada `VPS root — pps-hermes`.
- Si en algún momento se compartió una contraseña por chat/mail, **rotarla** en el VPS
  (`passwd root`) y migrar a clave SSH.
- El secreto de la API del agente (`HERMES_INTERNAL_TOKEN`) vive en
  `/opt/consulta-pps-uflo/agent/hermes-pps/.env` del servidor (nunca en git).

## 3. Subir el código nuevo al servidor

El servidor toma el código por `git`. Desde el VPS:

```bash
cd /opt/consulta-pps-uflo
git pull            # trae los últimos cambios (incluye agent/hermes-pps/app/main.py)
```

> Si trabajás en una rama distinta de la desplegada, hacer `git fetch` + `git checkout`
> de la rama correspondiente antes del `pull`.

## 4. Redeploy del contenedor

```bash
cd /opt/consulta-pps-uflo/agent/hermes-pps
docker compose up -d --build        # reconstruye la imagen y reinicia el contenedor
docker compose logs -f hermes-pps   # verificar arranque (Ctrl+C para salir)
```

En los logs deberías ver algo como:
`[scheduler] activo · plan_today 08:05 · daily_brief 08:30 · draft_emails 07:55 (UTC-3)`

## 5. Verificación post-deploy

```bash
# liveness (público, no expone secretos)
curl -fsS https://pps-hermes.n8n-blas.com.ar/health

# forzar un brief nuevo con el formato `ref` (sin esperar al cron de las 8:30).
# El token va por header; tomalo del .env del server, no lo pegues en claro:
TOKEN=$(grep -E '^HERMES_INTERNAL_TOKEN=' /opt/consulta-pps-uflo/agent/hermes-pps/.env | cut -d= -f2-)
curl -fsS -X POST https://pps-hermes.n8n-blas.com.ar/tasks/daily_brief_from_db \
  -H "X-Hermes-Token: $TOKEN"
```

Tras esto, el Inicio del panel mostrará prioridades con `ref` estructurado y los
deep-links abrirán la ficha puntual (solicitud / hilo / institución) en vez de la
lista general.

## 6. Rollback

```bash
cd /opt/consulta-pps-uflo
git log --oneline -5            # identificar el commit previo estable
git checkout <commit-previo>
cd agent/hermes-pps
docker compose up -d --build
```

## 7. Revocar el acceso de deploy asistido (cuando termine la asistencia)

```bash
sed -i '/claude-code@hermes-pps-deploy/d' /root/.ssh/authorized_keys
```
