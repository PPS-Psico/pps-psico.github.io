# Estado actual — Hermes-PPS

> Snapshot de lo construido hasta el **2026-05-27**.
> Documento vivo: actualizar a medida que avanzan las fases.
> Documento maestro de plan en [plan_hermes_pps.md](plan_hermes_pps.md).

---

## 1. Resumen en una línea

Hermes-PPS está **vivo en producción**, en modo sombra, con cuatro tareas operativas
(`daily_brief`, `draft_reply`, `explore`, `learn_from_feedback`), conectado a Supabase
y al vault Obsidian. Tiene Gmail enchufado y un workflow de sync diseñado. **No le falta
infraestructura**; le falta UI en el panel y producir feedback humano para empezar a aprender.

---

## 2. Componentes desplegados

### 2.1 Contenedor `hermes-pps`

- **Host**: `https://pps-hermes.n8n-blas.com.ar` (Traefik + Let's Encrypt válido).
- **Auth**: header `X-Hermes-Token` (no Basic Auth — se quitó porque la mayoría de
  clientes son máquina-a-máquina con header auth, no dos capas).
- **Imagen**: Python 3.12 + FastAPI + supabase-py + openai (cliente OpenRouter).
- **Memoria**: cap 1500 MB. Idle ~80 MB. Activo ~250 MB.
- **LLM**: DeepSeek V4 Flash via OpenRouter (subkey dedicada `pps-hermes`).
  Fallback automático a Claude Haiku 4.5 si DeepSeek falla.
- **Vault montado**: `/vault` → `/opt/obsidian-pps/` en el host.
- **Modo**: `shadow`. Nunca ejecuta acciones — solo propone.
- **Código**: `agent/hermes-pps/app/main.py` (200+ líneas, FastAPI app única).

### 2.2 Endpoints HTTP

| Endpoint                          | Auth             | Qué hace                                                                                                                                            | Estado                                      |
| --------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `GET /health`                     | público          | devuelve `{status, mode, model}`                                                                                                                    | ✅                                          |
| `POST /tasks/daily_brief`         | `X-Hermes-Token` | recibe datos del panel, devuelve bullets priorizados, persiste en `agent_suggestions`                                                               | ✅ probado en producción                    |
| `POST /tasks/draft_reply`         | `X-Hermes-Token` | recibe un mensaje Gmail/WhatsApp + institucion_id, devuelve borrador o "requiere decisión humana"                                                   | ✅ probado                                  |
| `POST /tasks/explore`             | `X-Hermes-Token` | investiga Supabase directo, escribe hallazgos al vault (`agent/exploracion-YYYY-MM-DD.md`) y registra suggestion                                    | ✅ ejecutado 2026-05-27                     |
| `POST /tasks/learn_from_feedback` | `X-Hermes-Token` | recibe `{accion, payload_original, payload_final, motivo}`, destila lección, la appendea a `agent/aprendizajes.md` y la espeja en `agent_audit_log` | ✅ **cableado** desde el panel (2026-05-31) |

### 2.3 Tablas Supabase (migration `20260526120000_create_agent_tables.sql`)

- `agent_suggestions` — propuestas pendientes/aprobadas/editadas/descartadas con
  `tipo`, `payload`, `contexto`, `institucion_id`, `lanzamiento_id`, `resolved_by`,
  `edited_payload`. RLS: solo admin lee; service role escribe.
- `agent_audit_log` — append-only por `invocation_id`, `tool`, `input`, `output`,
  `duration_ms`, `suggestion_id`, `error`. RLS: solo admin lee.
- `gmail_hilos` — PK `thread_id`, con `estado` enum (`nuevo` / `respondido_por_nos` /
  `esperando_respuesta` / `cerrado` / `archivado`), `clasificacion`, `participantes`,
  `ultimo_mensaje_at`, `raw_mensajes`.
- `whatsapp_mensajes` — PK `id` (gmail-style), `chat_jid`, `from_me`, `texto`, `timestamp`.
- `institucion_resumen` — PK `institucion_id`, `resumen`, `pendientes_concretos`,
  `ultimo_contacto_at`, `version_prompt`.

### 2.4 n8n workflows

| Workflow               | n8n ID             | Cron        | Estado                                      |
| ---------------------- | ------------------ | ----------- | ------------------------------------------- |
| `PPS — 01 Daily Brief` | `syy3LB8xoj8keDIh` | 8:00 L-V    | importado, probado, **activar manualmente** |
| `PPS — 02 Gmail Sync`  | `Bq0waUBc3mTOV3Rw` | 7/13/19 L-V | importado, **falta probar y activar**       |

### 2.5 Credenciales n8n

- `Supabase UFLO PPS` (`supabaseApi`) — id `4DiJjkrk4UphpsnF`
- `Supabase PostgREST (apikey)` (`httpHeaderAuth`) — id `hJGG3rIntFd0J3UA` — la que usan los workflows
- `Hermes-PPS Token` (`httpHeaderAuth`) — id `gFp9uRkrXVHk7EEs`
- `Gmail PPS (blas.rivera@uflouniversidad.edu.ar)` (`gmailOAuth2`) — id `hkyG2g0VcR6ryzjN`

### 2.6 Vault Obsidian — `/opt/obsidian-pps/`

```
obsidian-pps/
├── README.md
├── agent/
│   ├── decisiones.md
│   ├── prompts.md
│   ├── exploracion-2026-05-27.md     ← primera exploración real, generada por Hermes
│   └── aprendizajes.md                ← vacío todavía; se llena con learn_from_feedback
├── templates/
│   ├── daily.md
│   └── institucion.md
└── tuyas/
    ├── criterios.md                    ← criterios personales de Blas (EDITAR A MANO)
    └── contexto-uflo.md                ← contexto UFLO (EDITAR A MANO)
```

El contenedor lee `tuyas/criterios.md` + `tuyas/contexto-uflo.md` al arrancar y los
inyecta como sufijo del system prompt. Eso es lo que hace que Hermes sea **tuyo**, no
un asistente genérico.

### 2.7 VPS — env vars agregadas

Al stack `/opt/n8n-traefik/`:

- `HERMES_INTERNAL_TOKEN` en `n8n-main` y `n8n-main-worker` (para que los workflows
  llamen a `hermes-pps`).
- `N8N_PROTOCOL=https`, `N8N_PROXY_HOPS=1` (n8n detecta correctamente HTTPS de Traefik).
- `N8N_SECURE_COOKIE=false` (revertido — `true` rompía el login porque n8n no recibe
  HTTPS directo).

### 2.8 SSH al VPS

Mi clave SSH (`claude-code@hermes-pps-deploy`) está en `/root/.ssh/authorized_keys`.
Para revocar acceso una vez que se termine la asistencia:

```bash
sed -i '/claude-code@hermes-pps-deploy/d' /root/.ssh/authorized_keys
```

`fail2ban` ya estaba andando con 589 IPs baneadas históricas — el VPS está protegido.

---

## 3. Hallazgos de la primera exploración (2026-05-27)

Hermes leyó 80 instituciones, 58 lanzamientos activos y solicitudes recientes.
Detectó cosas concretas y procesables:

- **Backlog real**: 8 solicitudes `Pendiente` hace >15 días. La más vieja es Lincon Sosa (15/abr).
- **Contaminación del catálogo**: 13 instituciones con prefijo `UFLO -` son
  actividades internas (jornadas, expo vocacional), no instituciones externas. Mezclan
  la base.
- **Duplicados conceptuales**:
  - `Asociación Civil Pensar - AYUN` y `Asociación Civil Pensar - Barriletes` — misma entidad, dos líneas.
  - `Ministeriode Deporte, Juventud y Cultura` (id fc571) y `Ministerio de Juventud, Deportes y Cultura` (id 8bfc9) — mismo ministerio, misma dirección/tel.
- **Solicitudes a instituciones no cataloguadas**: 6 recientes apuntan a instituciones
  que no figuran en el panel (Hospital Joaquín Castellanos, Fundación Makarios, CIAM,
  CPEM 62, Hospital Picún Leufú, Hospital Plottier).
- **Cupos sospechosos**: Fundación Tiempo con 250 cupos parece carga errónea.
- **Estados inconsistentes**: lanzamientos con `estado_gestion=No se Relanza` que aún
  tienen cupos disponibles positivos (Clínica Fava 2, Colegio Virgen de Luján 4,
  Centro Salud Parque Industrial 5).
- **Datos antiguos de prueba**: ~20 solicitudes con nombres `recXXXX` (migración Airtable)
  todavía vivas en producción.

El archivo completo está en `obsidian-pps/agent/exploracion-2026-05-27.md` con
preguntas explícitas para Blas y aprendizajes que Hermes ya propuso.

---

## 4. Cómo Hermes aprende (loop de feedback)

Cuando el panel tenga la UI de bandeja de suggestions, cada vez que Blas resuelva una:

1. UI llama `POST /tasks/learn_from_feedback` con:
   ```json
   {
     "suggestion_id": "uuid",
     "accion": "approved" | "edited" | "discarded",
     "payload_original": {...},
     "payload_final": {...},
     "motivo": "opcional"
   }
   ```
2. Hermes lee `criterios.md` + `contexto-uflo.md` y compara `original` vs `final`.
3. Si hay lección concreta, la appendea a `agent/aprendizajes.md` con tag
   (`tono`, `criterio`, `contenido`, `prioridad`).
4. Si no hay nada que aprender (aprobado tal cual), devuelve `tag=sin_aprendizaje` y
   NO escribe. Esto evita ruido acumulado.

En la próxima iteración de cualquier tarea, Hermes lee `aprendizajes.md` antes de
proponer. Así se afina con el tiempo sin requerir fine-tuning.

---

## 5. Costos reales

- OpenRouter / DeepSeek: ~$0.0004 USD por llamada (medido).
- Para el flujo previsto (1 daily brief + ~5 drafts + 1 explore = 7 calls/día), el
  consumo mensual es del orden de **$0.10 USD/mes**.
- Subkey `pps-hermes` con límite de $5 USD/mes en OpenRouter — más que suficiente.

---

## 6. Pendientes infraestructura (no bloqueantes)

- [ ] **Rotar secretos pegados en chat** (OpenRouter subkey, Supabase service_role, pass del root del VPS, Basic Auth pass).
- [ ] **Cerrar password-auth de SSH del VPS** (dejar solo key-based) — requiere generar key propia del usuario.
- [ ] **Activar workflow `02 Gmail Sync`** después de probarlo manualmente.
- [ ] **Limpiar suggestions de prueba** (5-6 filas de test del 2026-05-27).
- [ ] **Borrar `n8n-workflows/.env.txt`** del disco del operador (secretos en cleartext, gitignored pero presente).
- [ ] **Syncthing** entre VPS y compu del operador para editar `tuyas/criterios.md` y `tuyas/contexto-uflo.md` desde la app Obsidian local.

---

## 7. Próximos pasos sugeridos (orden recomendado)

1. **UI en el panel actual `consulta-pps-uflo`** (en construcción aparte por el operador).
2. **Loop de aprendizaje activo**: una vez que la UI llame a `learn_from_feedback`,
   Hermes empieza a acumular criterio real.
3. **Integración con la página nueva `Pagina PPS/`** — ver [integracion-pagina-pps.md](integracion-pagina-pps.md).
4. **Fase 4 — WhatsApp**: bloqueada por activación del backup E2E con llave de 64 dígitos.
5. **Workflow `03-on-suggestion-approved`** (Fase 6 del plan): cuando un draft se aprueba,
   crear borrador en Gmail vía API (no enviar — dejarlo en borradores).
