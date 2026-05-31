# Plan de implementación — Hermes-PPS

> Documento de trabajo para la integración del agente Hermes al panel `consulta-pps-uflo`, con tres fuentes de datos (panel/Supabase, Gmail PPS, backups de WhatsApp) y Obsidian como bitácora viva.
>
> Última actualización: 2026-05-26

---

## 1. Visión y principios

### Visión

El panel actual es **sistema de registro y operación**. Hermes es **capa de inteligencia** que lee contexto desde tres fuentes, prioriza, redacta borradores y propone acciones. Obsidian es **memoria narrativa** de largo plazo. Supabase es la base de datos compartida.

### Principios duros (no negociables)

1. **Agente asistivo y supervisado.** Nada de enviar correos, cambiar estados sensibles o modificar datos sin revisión humana, salvo reglas declaradas explícitas y muy acotadas.
2. **Claves de IA y tokens OAuth nunca en el frontend.** Viven en el VPS, en variables de entorno.
3. **Toda acción del agente queda auditada** en `agent_audit_log`: qué leyó, qué herramienta usó, qué propuso, quién aprobó.
4. **Gmail empieza por borradores**, no envío automático. Cuenta institucional separada, etiquetas/casilla específica.
5. **WhatsApp: solo lectura**, vía backups locales/Drive desencriptados con llave E2E del usuario. Nunca conexión activa a WhatsApp Web ni APKs modificados.
6. **Minimizar datos personales** de estudiantes enviados a APIs externas de IA. Mascarillas y resúmenes antes que payloads crudos.

---

## 2. Arquitectura

### Diagrama

```
┌────────────────────────────────────────────────────────────────┐
│                  Tu compu / browser                             │
│              Panel React (consulta-pps-uflo)                    │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                          Supabase                               │
│   Tablas existentes del panel (instituciones, lanzamientos,     │
│   estudiantes, solicitudes, ...)                                │
│   + tablas nuevas para el agente:                               │
│     - whatsapp_mensajes                                         │
│     - gmail_hilos                                               │
│     - agent_suggestions                                         │
│     - agent_audit_log                                           │
│     - institucion_resumen                                       │
└──────────────────────────────────────────────┬─────────────────┘
                                                │ service role
                                                ▼
┌────────────────────────────────────────────────────────────────┐
│                       VPS (existente)                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  Hermes      │  │     n8n      │  │  hermes-pps        │   │
│  │  (existente) │  │  (compartido)│  │  (NUEVO container) │   │
│  └──────────────┘  └──────┬───────┘  └────────┬───────────┘   │
│                            │                   │                │
│                            │ orquesta          │ razona/redacta │
│                            ▼                   ▼                │
│           ┌─────────────────────────────────────────────┐      │
│           │       Vault Obsidian (en disco)             │      │
│           │   /opt/obsidian-pps/                         │      │
│           └─────────────────────────────────────────────┘      │
│                            ▲                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │ Syncthing
                             ▼
                  Obsidian local (tu compu)
```

### Decisión clave: Hermes lee todo desde Supabase, no de las fuentes directas

- Solo **n8n** habla con Gmail API y con Google Drive (para backups WhatsApp).
- n8n normaliza los datos y los persiste en Supabase.
- Hermes lee de Supabase + Obsidian.
- Beneficio: aislamiento de credenciales, caché gratis, auditabilidad total.

### ¿Mismo Hermes que el existente, o uno nuevo?

**Contenedor nuevo: `hermes-pps`.** Misma máquina, mismo n8n compartido, pero contenedor propio. Razones:

| Razón                 | Detalle                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Identidad distinta    | Este Hermes "es" el copiloto de coordinación PPS; system prompt y memoria propios.                |
| Frontera de seguridad | Tokens de Gmail PPS, llave WhatsApp, service role del panel — no se mezclan con el otro proyecto. |
| Aislamiento de fallas | Si uno se cuelga o spike-ea RAM, el otro sigue.                                                   |
| Trazabilidad limpia   | Logs específicos de PPS sin ruido del otro proyecto.                                              |

**Comparte:** Docker host, red, n8n, reverse proxy, modelo de IA si es local.

---

## 3. Las tres fuentes de datos

| Fuente                       | Cómo llega a Supabase                                                                                                   | Frecuencia       | Workflow n8n        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------- |
| **Panel admin (Supabase)**   | Ya está ahí. Hermes hace queries directas con role read-only.                                                           | Tiempo real      | —                   |
| **Gmail PPS**                | OAuth → Pub/Sub o polling 5 min → normaliza → `gmail_hilos`, linkea `institucion_id`.                                   | Casi tiempo real | `pps-gmail-sync`    |
| **WhatsApp (backups Drive)** | Cron 4 AM → descarga backup → desencripta con llave E2E → exporta JSON → filtra allowlist → upsert `whatsapp_mensajes`. | Diaria           | `pps-whatsapp-sync` |
| **Obsidian**                 | Hermes lee/escribe filesystem directo (no Supabase).                                                                    | On-demand        | —                   |

---

## 4. Stack tecnológico

| Componente        | Tecnología                                                        | Notas                                                                                                |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Frontend          | React + Vite (existente)                                          | Componentes nuevos en `src/components/admin/agent/`                                                  |
| Base de datos     | Supabase Postgres (existente)                                     | Nuevas migrations en `supabase/migrations/`                                                          |
| Orquestación      | n8n (existente en VPS)                                            | Workflows nuevos con tag/folder `pps`                                                                |
| Agente            | Servicio propio FastAPI (`hermes-pps`)                            | Implementación propia, **no** el framework Hermes Agent de Nous Research (comparte nombre); ver nota |
| LLM               | DeepSeek V4 Flash vía OpenRouter (fallback Claude Haiku 4.5)      | Subkey dedicada `pps-hermes`                                                                         |
| Memoria narrativa | Obsidian vault en disco del VPS                                   | Sync con tu compu vía Syncthing                                                                      |
| WhatsApp ingest   | `whatsapp-backup-downloader-decryptor` + `WhatsApp-Chat-Exporter` | Open source, sin riesgo de ban                                                                       |
| Gmail ingest      | Gmail API vía nodo n8n                                            | OAuth con scope `gmail.modify` (no `gmail.send` hasta Fase 6)                                        |

> **Nota sobre el nombre "Hermes".** El plan original contemplaba usar el
> framework open-source [Hermes Agent](https://hermes-agent.nousresearch.com/)
> de Nous Research. En la implementación se descartó: `hermes-pps` es un servicio
> propio en FastAPI + OpenRouter, con control fino del modo sombra y del loop de
> aprobación, que ese framework no daba listo. Comparten nombre pero no código.
> De las releases de Hermes Agent (v0.15.0, may-2026) solo portamos ideas
> puntuales cuando aplican — p. ej. la verificación de doble pasada en
> `verify_finalizacion` (ver `agent/hermes-pps/README.md`).

---

## 5. Decisiones pendientes

Antes de avanzar de la Fase 0, necesito confirmación sobre:

1. **Modelo de IA**: ¿Claude API (Sonnet 4.6), OpenAI (GPT-4.x), o local en VPS?
   - Recomendación: Claude API Sonnet 4.6 para arrancar. Costo estimado: USD 5–20/mes para tu volumen.
2. **Cuenta de Google**: ¿usás tu Google actual o creamos una nueva dedicada (`pps.coordinacion.uflo@gmail.com` o similar)?
   - Recomendación: cuenta nueva dedicada.
3. **VPS host**: ¿Docker + docker-compose? ¿Otro orquestador?
   - Necesario para escribir el `docker-compose.yml` adicional con `hermes-pps`.
4. **Repo del código del agente**: ¿dentro de `consulta-pps-uflo/agent/` o repo separado al lado?
   - Recomendación: dentro del mismo repo (`agent/`, `n8n-workflows/`) para que las migrations, componentes React y prompts del agente versionen juntos.

---

## 6. Plan de construcción por fases

### Fase 0 — Infraestructura (1–2 días)

**Bloqueado por:** decisiones pendientes 1–4.

- [ ] Activar backup E2E de WhatsApp con llave de 64 dígitos (lo hace el usuario).
- [ ] Crear cuenta Google dedicada (si se decide).
- [ ] Provisionar contenedor `hermes-pps` en el docker-compose del VPS.
- [ ] Crear carpeta `/opt/obsidian-pps/` con la estructura inicial (ver `docs/obsidian-vault-template/`).
- [ ] Setup Syncthing entre VPS y compu del usuario.
- [ ] Crear API keys / service accounts en Supabase para n8n y para `hermes-pps` (separadas).

### Fase 1 — Tablas y RLS en Supabase (medio día)

- [x] Diseñar tablas: `whatsapp_mensajes`, `gmail_hilos`, `agent_suggestions`, `agent_audit_log`, `institucion_resumen`.
- [x] Escribir migration con tablas + indices + RLS policies (`supabase/migrations/`).
- [ ] Aplicar migration al proyecto Supabase.
- [ ] Verificar policies con queries de prueba.

### Fase 2 — MVP: Brief diario (2–3 días)

> "Hermes diciéndote buen día" — sin Gmail ni WhatsApp todavía. Permite validar tono y arquitectura.

- [ ] Endpoint `POST /daily-brief` en `hermes-pps`.
- [ ] Workflow n8n `pps-daily-brief` (cron 6 AM):
  1. Recolecta señales (queries SQL ya conocidas del Centro de Acción).
  2. Llama a `hermes-pps /daily-brief` con el contexto.
  3. Guarda el resultado en `agent_suggestions` (tipo `daily_brief`).
  4. Hermes también escribe la nota diaria en `obsidian-pps/daily/YYYY-MM-DD.md`.
- [ ] Componente React `<DailyBrief />` en `src/components/admin/agent/`.
- [ ] Integrar en `AdminActionCenter` (sección "Brief de hoy").

### Fase 3 — Integración Gmail (3–4 días)

- [ ] OAuth Gmail PPS en n8n. Scopes: `gmail.readonly` + `gmail.modify`.
- [ ] Workflow `pps-gmail-sync`:
  1. Polling cada 5 min (o Pub/Sub si conviene).
  2. Filtra por etiqueta `PPS` o casilla específica.
  3. Normaliza hilos y mensajes.
  4. Linkea con `institucion_id` por matching de email/dominio.
  5. Upsert en `gmail_hilos`.
- [ ] Endpoint `POST /classify-email` en `hermes-pps` (categoría: interesado / sin cupo / pide convenio / requiere llamada / pendiente docs).
- [ ] Endpoint `POST /draft-reply` (genera borrador en base al hilo + ficha de institución).
- [ ] UI "Bandeja PPS" en el panel con lista de hilos clasificados y borradores listos.

### Fase 4 — Integración WhatsApp (2–3 días)

**Bloqueado por:** llave E2E activada y primer backup E2E hecho.

- [ ] Workflow `pps-whatsapp-sync` (cron diario 4 AM):
  1. Baja último backup de Google Drive.
  2. Desencripta con la llave (variable de entorno del VPS).
  3. Corre `WhatsApp-Chat-Exporter` → JSON.
  4. Filtra por allowlist (teléfonos de `PHONE_DIRECTORY` / tabla `institucion_contactos`).
  5. Upsert idempotente en `whatsapp_mensajes`.
  6. Llama a `hermes-pps /summarize-institution` para cada institución con mensajes nuevos.
  7. Upsert en `institucion_resumen`.
- [ ] Componente "Memoria de conversación" en la ficha de institución del panel.

### Fase 5 — Obsidian profundo (1–2 días)

- [ ] Estructura final del vault (ver `docs/obsidian-vault-template/README.md`).
- [ ] Hermes escribe nota por institución (`instituciones/<slug>.md`) cuando hay actividad nueva.
- [ ] Hermes lee el vault como contexto extra cuando razona (ej. preferencias del usuario, criterios de selección guardados a mano).

### Fase 6 — Loop de aprobación y acciones (2–3 días)

- [ ] Botones "Aprobar / Editar / Descartar" en cada suggestion del panel.
- [ ] Workflow `pps-on-suggestion-approved`:
  - Si tipo = `email_draft` → crea borrador en Gmail (no envía aún).
  - Si tipo = `whatsapp_followup` → genera deep-link `wa.me` con texto, lo muestra en el panel.
  - Si tipo = `update_estado` → updatea estado en Supabase con `actor = 'agent_approved_by_<user>'`.
- [ ] Vista de auditoría: tabla `agent_audit_log` accesible desde el panel.

---

## 7. Estructura de archivos en el repo

```
consulta-pps-uflo/
├── agent/                              # NUEVO
│   ├── hermes-pps/                     # config + prompts del Hermes
│   │   ├── system_prompt.md
│   │   ├── tools/                      # MCP/tool definitions
│   │   └── docker-compose.yml          # solo el container nuevo
│   └── README.md
├── n8n-workflows/                      # NUEVO
│   ├── pps-daily-brief.json
│   ├── pps-gmail-sync.json
│   ├── pps-whatsapp-sync.json
│   └── pps-on-suggestion-approved.json
├── docs/
│   ├── plan_hermes_pps.md              # este archivo
│   ├── trabajo_pps_panel_web_y_agente_ia.docx (existente)
│   └── obsidian-vault-template/        # NUEVO: skeleton del vault
├── supabase/
│   └── migrations/
│       └── 20260526120000_create_agent_tables.sql   # NUEVO
└── src/
    └── components/
        └── admin/
            └── agent/                  # NUEVO
                ├── DailyBrief.tsx
                ├── SuggestionCard.tsx
                ├── InstitutionMemory.tsx
                └── GmailInbox.tsx
```

---

## 8. Modelo de datos del agente

### `agent_suggestions`

Cualquier cosa que Hermes propone y el humano puede aprobar/editar/descartar.

| Campo                               | Tipo        | Notas                                                                               |
| ----------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| id                                  | uuid        | pk                                                                                  |
| tipo                                | text        | `daily_brief`, `email_draft`, `whatsapp_followup`, `update_estado`, `clasificacion` |
| estado                              | text        | `pending`, `approved`, `edited`, `discarded`, `expired`                             |
| payload                             | jsonb       | contenido específico al tipo                                                        |
| contexto                            | jsonb       | qué datos vio Hermes para producirlo                                                |
| institucion_id                      | uuid?       | si aplica                                                                           |
| lanzamiento_id                      | uuid?       | si aplica                                                                           |
| created_at, expires_at, resolved_at | timestamptz |                                                                                     |
| resolved_by                         | uuid?       | quién aprobó/descartó                                                               |

### `agent_audit_log`

Append-only. Cada llamada a una tool del agente queda registrada.

| Campo         | Tipo        |
| ------------- | ----------- | --------------------------------------------- |
| id            | uuid        |
| timestamp     | timestamptz |
| invocation_id | uuid        | agrupa varias tool calls de una misma corrida |
| tool          | text        |
| input         | jsonb       |
| output        | jsonb       |
| suggestion_id | uuid?       |

### `whatsapp_mensajes`

| Campo          | Tipo        | Notas                                   |
| -------------- | ----------- | --------------------------------------- |
| id             | text        | pk = WhatsApp message ID                |
| chat_jid       | text        | JID del chat                            |
| institucion_id | uuid?       | matcheo por teléfono                    |
| from_me        | boolean     |                                         |
| autor          | text        |                                         |
| texto          | text        |                                         |
| media_tipo     | text?       |                                         |
| timestamp      | timestamptz |                                         |
| raw            | jsonb       | mensaje crudo de WhatsApp-Chat-Exporter |

### `gmail_hilos`

| Campo                                | Tipo        |
| ------------------------------------ | ----------- | --------------------------------------------------------------- |
| thread_id                            | text (pk)   |
| institucion_id                       | uuid?       |
| asunto                               | text        |
| participantes                        | jsonb       |
| primer_mensaje_at, ultimo_mensaje_at | timestamptz |
| ultimo_mensaje_de                    | text        |
| estado                               | text        | `nuevo`, `respondido_por_nos`, `esperando_respuesta`, `cerrado` |
| clasificacion                        | text        | sale de Hermes                                                  |
| raw_mensajes                         | jsonb       |                                                                 |

### `institucion_resumen`

Vista materializada por Hermes. Una fila por institución.

| Campo                | Tipo        |
| -------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| institucion_id       | uuid (pk)   |
| resumen              | text        | "Última vez que hablaron fue hace 6 días por WhatsApp. Te dijo X. Pendiente: enviar convenio." |
| ultimo_contacto_at   | timestamptz |
| ultimo_canal         | text        | `whatsapp`, `gmail`, `panel`                                                                   |
| pendientes_concretos | jsonb       |
| actualizado_at       | timestamptz |
| version_prompt       | text        | qué versión de prompt produjo este resumen                                                     |

---

## 9. Seguridad y privacidad

- **Service role keys**: una para n8n (full access), una para `hermes-pps` (subset). Nunca en el repo. `.env` en el VPS con permisos `600`.
- **OAuth Gmail**: refresh token guardado encriptado en n8n. Solo n8n lo lee.
- **Llave E2E WhatsApp**: variable de entorno del VPS. Backup en gestor de contraseñas del usuario. Nunca compartida por chat.
- **Mensajes en `whatsapp_mensajes`**: política de retención. Por default, borrar mensajes con más de 12 meses. El `institucion_resumen` queda; el mensaje crudo se va.
- **PII a la API de IA**: nunca enviar DNI, mails personales de estudiantes, teléfonos personales. Solo nombres + contexto académico. Pre-procesamiento que ofusca antes de invocar el modelo.
- **Auditoría**: `agent_audit_log` permite reconstruir qué datos vio Hermes en cada decisión.

---

## 10. Roadmap original del documento de trabajo

Mapeo entre el documento `trabajo_pps_panel_web_y_agente_ia.docx` y este plan:

| Fase del doc                                               | Fase de este plan                |
| ---------------------------------------------------------- | -------------------------------- |
| Fase 1 (Consolidar Centro de Acción y ficha institucional) | Ya completada (en código actual) |
| Fase 2 (Borradores inteligentes)                           | Fase 3 de este plan              |
| Fase 3 (Conectar Gmail)                                    | Fase 3 de este plan              |
| Fase 4 (Agente con herramientas)                           | Fases 2, 5 y 6 de este plan      |
| Fase 5 (Resumen diario + automatización)                   | Fases 2 y 6 de este plan         |

---

## 11. Referencias

- [WhatsApp-Chat-Exporter](https://github.com/KnugiHK/WhatsApp-Chat-Exporter)
- [whatsapp-backup-downloader-decryptor](https://github.com/giacomoferretti/whatsapp-backup-downloader-decryptor)
- [Hermes Agent docs](https://hermes-agent.nousresearch.com/docs/)
- [Gmail API — sending](https://developers.google.com/gmail/api/guides/sending)
- [Gmail API — push notifications](https://developers.google.com/workspace/gmail/api/guides/push)
- Documento de trabajo original: [trabajo_pps_panel_web_y_agente_ia.docx](./trabajo_pps_panel_web_y_agente_ia.docx)
