# Integración — Página PPS nueva ↔ Hermes-PPS

> Análisis del prototipo de la página nueva (`Pagina PPS/`), de los puntos de integración
> con Hermes ya diseñados, de lo que le falta a la página para usarse en producción, y
> de oportunidades adicionales para aprovechar la infraestructura del agente.
>
> Fecha: 2026-05-27.

---

## 1. Qué es la página nueva

Está en `Pagina PPS/` y es un **prototipo de redesign del panel** — HTML + JSX
suelto (React vía `<script>`, sin bundle), pensado como diseño y prueba de UX
antes de migrarlo al proyecto React real.

Es **el target architecture**: el rediseño asume que Hermes ya existe y lo integra
en la UI desde el día uno.

### Surfaces principales

| Surface      | Archivos                                                                                                                                 | Rol                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inicio**   | `Inicio.html`, `Inicio v2.html`, `Admin Inicio v2.html`, `app.jsx`, `app-v2.jsx`, `data.jsx`, `data-v2.jsx`, `parts.jsx`, `parts-v2.jsx` | "Qué hacer ahora": briefing matutino que muestra lo prioritario del día. **Es la superficie del `daily_brief`**.                                         |
| **Gestión**  | `Gestion.html`, `gestion-app.jsx`, `gestion-data.jsx`, `gestion-views.jsx`                                                               | Workspace de tres paneles: rail de categorías \| bandeja de instituciones \| ficha viva. Estilo cliente de mail. Acá vive la gestión institucional real. |
| **Lanzador** | `Lanzador.html`, `lanzador-*.jsx`, `v3/`                                                                                                 | Wizard para crear convocatorias: borrador → abierta → cerrada → seleccionada → activa → archivada.                                                       |

### Estado de los datos en el prototipo

**Todo mock.** Cada archivo `*-data.jsx` define `INSTITUCIONES`, `CONVOCATORIAS`,
`TEMPLATES` etc. como objetos JS literales. No hay conexión a Supabase ni a Hermes
todavía. Lo emite todo en memoria de sesión.

### Schema propuesto

El operador ya escribió `v3/SCHEMA_PERSISTENCIA.md` con la propuesta de tablas
nuevas (`gestion_log`, `gestion_recordatorios`). Son **append-only** y registran
cada acción del operador con la institución: enviar mensaje, cambiar estado,
editar ficha, crear recordatorio. Esa tabla es alimento crítico para Hermes
(ver §3).

---

## 2. Puntos de integración con Hermes **ya diseñados** en la página

El prototipo ya pintó tres lugares donde Hermes aparece. Cada uno mapea limpio
a un endpoint actual o cercano.

### 2.1 `hermesNote` — "Hermes sugiere" en la ficha de institución

**Dónde**: `gestion-data.jsx` línea ~60 (campo `hermesNote` por institución),
renderizado en `gestion-views.jsx` ~320-326 como caja morada con icono
`auto_awesome`.

**Ejemplo del mock**:

> _"Manantiales: La última respuesta a un mail tardó 5 días. Ya pasaron 7. Pinto reinsistir hoy con plantilla 'recordatorio cortés'."_

**Cómo se conecta a Hermes hoy**: este texto es el output del task
`/tasks/institucion_resumen` o de un nuevo `/tasks/institucion_sugerencia`. Va a
la tabla `institucion_resumen.resumen` (ya existe) o como suggestion tipo nuevo
(`hint_institucion`).

**Lo que falta**: workflow n8n que para cada institución activa llame periódicamente
a Hermes pidiendo una sugerencia corta y la persista en `institucion_resumen`. La UI
lee de esa tabla por `institucion_id`.

### 2.2 Botón "Pedirle a Hermes" + modal `HermesRewrite`

**Dónde**: `gestion-views.jsx` líneas 105 (botón), 553 (montaje), 713-805 (componente).

**Qué hace en el mock**: abre un modal con templates ("recordatorio cortés", "consulta directa", "agradecimiento") y un area "Hermes está reescribiendo..." con un loader.

**Cómo se conecta a Hermes hoy**: el modal hace `POST /tasks/draft_reply` con:

```json
{
  "source": "gmail",
  "institucion_id": "borda",
  "mensaje_original": "<texto del operador o último mensaje recibido>",
  "contexto_extra": "<tono/objetivo elegido>"
}
```

Hermes devuelve el borrador. UI lo muestra en el textarea. Operador acepta/edita.

**Lo que falta**: cablear el `fetch` real al endpoint en el handler del componente.
El endpoint y el shape ya están listos (probados con curl).

### 2.3 Chip de estado `pendienteDecision` con tono "ai"

**Dónde**: `gestion-data.jsx` ~13 (estado `pendienteDecision: { tone: 'pendienteDecision'... }`) y `gestion-views.jsx` ~184 (rendering del chip con dot `ai`).

**Qué insinúa**: este estado se asigna cuando la institución respondió pero requiere decisión humana. Es exactamente el output que Hermes marca como `requiere_decision_humana=true` en `draft_reply`.

**Lo que falta**: cuando Hermes responde con `requiere_decision_humana=true`, el panel debería transicionar la institución a `pendienteDecision` automáticamente. Hoy nada lo hace.

---

## 3. Lo que la página necesita para usarse en producción

Por orden de importancia. Items con ⚡ son los que mejoran inmediatamente el flujo con Hermes.

### 3.1 Conectar la data real

- [ ] Reemplazar todos los `data.jsx` mock por **fetches reales a Supabase**.
  - `INSTITUCIONES` → `select * from instituciones` (mapear campos: `tutor`, `convenio_nuevo`, `orientaciones[]`, `direccion`, `telefono`, `email_institucion`).
  - `CONVOCATORIAS` (lanzador) → `lanzamientos_pps` (el shape es muy distinto al mock; hay campos que no existen como `iaUsed`, `completion`, `cierreEn` — habría que computarlos o derivarlos).
  - `ITEMS` (bandeja de gestión) → query custom que cruza `lanzamientos_pps` + `gestion_log` y deriva la categoría (`porContactar`, `reinsistir`, etc.).

### 3.2 Aplicar la migration `gestion_log` y `gestion_recordatorios`

- [ ] Crear migration `supabase/migrations/YYYYMMDDhhmmss_create_gestion_tables.sql`
      con las tablas del `v3/SCHEMA_PERSISTENCIA.md`. ⚡ **Es lo que hace al sistema
      trazable** — Hermes va a leerla para inferir patrones de respuesta, tiempos,
      qué plantillas funcionan.

### 3.3 Wiring de Hermes ⚡

- [ ] **`hermesNote` por institución**:
  - Backend: nuevo workflow n8n (`03-institucion-resumen` daily 6am) que itera
    instituciones activas y llama `POST /tasks/institucion_resumen` (endpoint
    ya existe). Persiste en `institucion_resumen.resumen` + `pendientes_concretos`.
  - Frontend: la ficha lee `institucion_resumen` por `institucion_id` y muestra
    el campo `resumen` en la caja morada.
- [ ] **Modal `HermesRewrite`**:
  - Backend: ya está (`/tasks/draft_reply`).
  - Frontend: implementar el fetch real con header `X-Hermes-Token` (vía un endpoint
    proxy en el backend del panel para no exponer el token al cliente — o usar
    Supabase Edge Function que valida sesión admin y luego llama a hermes-pps).
- [ ] **Bandeja de suggestions**:
  - Nueva vista que lee `agent_suggestions where estado='pending'` y muestra cada
    una con botones **Aprobar / Editar / Descartar**.
  - Al resolver, llama a `/tasks/learn_from_feedback` con el diff. Esto es lo
    que **activa el loop de aprendizaje** — sin esto, Hermes nunca se afina.
- [ ] **Brief diario en Inicio**:
  - La sección "Qué hacer ahora" del Inicio lee `agent_suggestions where tipo='daily_brief' order by created_at desc limit 1`.
  - Renderiza los bullets del `payload.bullets` con colores según `prioridad`.

### 3.4 Cosas estructurales de la página

- [ ] Migrar de JSX suelto a TSX dentro del proyecto React real (`src/views/admin/`).
      Las páginas como las dejó el prototipo no se pueden montar directo en el panel
      porque cada `.html` levanta su propio React desde CDN.
- [ ] Diseñar la navegación entre Inicio / Gestión / Lanzador / Bandeja-Hermes dentro
      del `AdminDashboard` existente.
- [ ] Definir si el "Admin Inicio v2" reemplaza al `AdminDashboard.tsx` actual o
      coexisten (la rama actual de modificaciones del operador toca varios componentes
      admin que ya están vivos).

### 3.5 Higiene de UX

- [ ] La página asume un sistema de **plantillas guardadas** (TEMPLATES). Si se va
      a usar de verdad, las plantillas deberían vivir en Supabase (tabla
      `plantillas_mensajes`) editables desde la UI, no hardcodeadas.
- [ ] La página asume **categorías derivadas** (`porContactar`, `reinsistir`, etc.)
      con lógica de fechas. Hay que escribir esa derivación en un view SQL o en un
      hook React que sea source-of-truth — hoy el mock las trae pre-clasificadas.
- [ ] El estado `falta-dato` se muestra cuando una institución no tiene tutor/tel/mail.
      Es un **trigger natural** para Hermes: "ojo, esta institución te va a costar contactar".

---

## 4. Oportunidades nuevas que abre tener Hermes + página

Cosas que el operador todavía no diseñó en el prototipo pero que el stack soporta.

### 4.1 "Hermes me dijo, no le hagas caso porque..."

Cuando el operador descarte una suggestion con un motivo escrito ("ya hablé con esa
persona por WhatsApp ayer, está cubierto"), eso llega a `/tasks/learn_from_feedback`.
**Después de algunas iteraciones**, Hermes empieza a tener criterio sobre qué
canales prefiere el operador para qué interlocutor. Ese criterio se acumula en
`aprendizajes.md` y se inyecta al system prompt.

Esto solo funciona si la UI de descarte incluye un campo opcional "¿por qué?".
Ponerle dos botones: "Descartar" (rápido) y "Descartar con motivo" (abre prompt).

### 4.2 Briefing de cierre de día

Equivalente al `daily_brief` matinal pero a las 18hs:

- Qué pasó hoy (eventos en `gestion_log`).
- Qué quedó abierto.
- Qué Hermes vio del comportamiento del operador (ej: "respondiste 4 mails, todos
  fuera de horario laboral — ¿querés que mañana te los priorice antes?").

Workflow n8n `04-daily-wrap` con cron 18:30 L-V. Llama a un nuevo task
`/tasks/daily_wrap` (todavía no existe — habría que sumarlo).

### 4.3 Detección de instituciones "fantasma"

La exploración del 2026-05-27 detectó 6 solicitudes a instituciones no cataloguadas.
Hermes puede mantener una tabla `instituciones_candidatas` (auto-generada) y avisar
en el brief cuando una se repite ≥2 veces → "5 alumnos pidieron Fundación Makarios
pero no está en el catálogo. ¿La agregamos?".

### 4.4 Detector de duplicados

Hermes ya detectó 2 duplicados (Pensar AYUN/Barriletes, Ministerio fc571/8bfc9).
Endpoint `/tasks/detect_duplicates` que corre semanalmente y propone fusiones
como `agent_suggestions` tipo `merge_proposal`. El operador aprueba o descarta.

### 4.5 Memoria de conversación por institución

Cuando Gmail sync + WhatsApp sync estén ambos vivos, `institucion_resumen` puede
agregar un campo `linea_de_tiempo` con los últimos N eventos
multi-canal de la institución (mails, whatsapps, cambios de estado). Eso alimenta
la sección "Historial" de la ficha en Gestión, que hoy es mock.

### 4.6 Sugerencias en el Lanzador

Cuando el operador crea un convocatoria (state `borrador`):

- Hermes lee instituciones similares en el catálogo y propone valores razonables
  para `cupos`, `horas`, `horarios`, `requisitos`.
- Hermes detecta si la descripción es genérica y sugiere reescribirla para que
  filtre mejor a los inscriptos.

Esto es un task nuevo `/tasks/suggest_convocatoria` (no existe). Vale la pena
cuando el Lanzador esté en producción.

### 4.7 Auto-priorización en la bandeja de Gestión

La categoría `hoy` del rail dice "Lo que conviene hacer primero". Hoy es manual.
Hermes puede ordenar las instituciones del día por probabilidad de cierre /
urgencia institucional / tiempo desde último contacto. Output: campo
`prioridad_hermes` en `institucion_resumen` que la UI usa para ordenar.

### 4.8 Onboarding para coordinadores futuros

Cuando otra persona tome la coordinación de PPS, el vault `tuyas/` + `aprendizajes.md`
**ES la transferencia de conocimiento**. Hermes puede generar un onboarding doc
de 1 página: "esto es lo que importa de Blas según lo que aprendí". Task
`/tasks/generate_onboarding`.

---

## 5. Resumen accionable

**Para usar la página tal como está hoy + Hermes**: 4 cosas mínimas.

1. Aplicar migration de `gestion_log` y `gestion_recordatorios`.
2. Reemplazar `data.jsx` mocks por fetches a Supabase.
3. Cablear los 3 hooks de Hermes ya diseñados (`hermesNote`, `HermesRewrite`, chip `pendienteDecision`).
4. Construir la **bandeja de suggestions** con botones Aprobar/Editar/Descartar
   que llamen a `/tasks/learn_from_feedback`. Esto es lo que activa el aprendizaje.

Con esos 4 items la página + Hermes están en producción y mejorando solos cuatrimestre a cuatrimestre.

Las **oportunidades nuevas** (§4) son trabajos posteriores, todas viables con el
stack actual sin agregar infraestructura nueva.
