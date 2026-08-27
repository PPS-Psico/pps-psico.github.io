# Contratos activos · Moodle Task Automation v2

Fecha de verificación: 27 de agosto de 2026
Estado: fundación productiva; escritor Moodle todavía no conectado

Este documento describe lo que existe en el repositorio y en Supabase. Las
propuestas futuras permanecen en
[moodle-task-automation-v2-plan.md](../moodle-task-automation-v2-plan.md) y no
deben confundirse con capacidades productivas.

## 1. Unidad y convivencia

- La unidad canónica es `(lanzamiento_id, orientacion_key)`.
- `legacy_shared`: vínculos confirmados anteriores a 2027. Se observan, pero
  jamás se crean, adoptan por nombre ni reconfiguran automáticamente.
- `dedicated`: lanzamientos desde 2027, activos o archivados. Tendrán una tarea
  exclusiva cuyo `ID number` de Moodle debe coincidir exactamente con
  `stable_key`.
- Las orientaciones admitidas son `clinica`, `laboral`, `comunitaria`,
  `educacional` y `otra`. La normalización vive en
  `private.moodle_orientation_key(text)`.

### PPS especiales sin lanzamiento

`relevamiento_profesional` y `entrevistas_profesionales` se asignan desde el
Taller admin y no crean una intención de lanzamiento. La asignación crea una
`practicas` de tipo `actividad_especial`, sin fechas, y un vínculo confirmado en
`practica_moodle_tareas`. La tarea se elige por actividad, año y grupo de
orientación: `clinica`, `laboral_comunitaria` o `educacional`.

Entrevistas 2026 usa los CMID verificados `1224814` (Clínica), `1097090`
(Laboral/Comunitaria) y `1224816` (Educacional). Son tareas compartidas anuales,
sin vencimiento; los estudiantes sólo acceden a la que coordinación les asignó.

## 2. Tablas

### `public.moodle_task_intents`

Declara la configuración deseada de la tarea. Claves y controles relevantes:

- PK `id uuid`;
- FK `lanzamiento_id uuid`;
- unicidad `(lanzamiento_id, orientacion_key)` y `stable_key`;
- `aula_entrega_id bigint`, nullable hasta verificar una tarea dedicada;
- `mode`: `legacy_shared | dedicated`;
- `provisioning_status`: `pending | claimed | reconciling | verified |
needs_attention | error | disabled | cancelled`;
- `monitoring_status`: `not_started | hot | cold | settled |
needs_attention`;
- configuración material completa: nombre, HTML, apertura, vencimiento, corte,
  modo/escala de nota, sección, visibilidad y versión de plantilla;
- `desired_grading_due_at timestamptz`: el `gradingduedate` de Moodle
  ("Recordarme calificar en"), con invariante
  `desired_grading_due_at >= desired_due_at`. Se calcula como vencimiento + 30
  días, que es el plazo de corrección en término. **No es opcional**: Moodle
  rechaza el guardado si falta o si es anterior al vencimiento, y el rechazo no
  se muestra arriba del formulario. Todavía no participa de
  `private.moodle_v2_config_hash` ni de `confirm_moodle_task_intent_v1`;
- `desired_config_hash`, `observed_config_hash`, evidencia, errores, lease y
  timestamps de reconciliación/lectura.

Un estado `verified` exige `aula_entrega_id`. El lease exige token y vencimiento
juntos.

### `public.moodle_task_expected_participants`

Padrón histórico que define el denominador real por unidad:

- FK a intención, práctica y estudiante;
- una membresía activa por `(intent_id, practica_id)`;
- `membership_status`: `expected | withdrawn | institution_failed | waived |
replaced`;
- ventana `active_from/active_to`, fuente, motivo, reemplazo y auditoría.

`withdrawn` y `replaced` no cuentan en los agregados activos; la fila no se
borra.

### PPS especiales

- `public.special_pps_task_catalog`: una tarea por actividad, grupo de
  orientación y año.
- `public.special_pps_assignments`: relación auditable entre estudiante,
  práctica especial y tarea anual; conserva las orientaciones Laboral y
  Comunitaria por separado aunque compartan tarea.

### Auditoría privada

`private.moodle_agent_runs` y `private.moodle_agent_run_items` registran
corridas y pasos. Tienen RLS habilitado, no poseen grants para `anon` ni
`authenticated`, y están reservadas a `service_role`.

## 3. RPC públicas activas

Todas las wrappers públicas son `SECURITY INVOKER`, sin acceso `anon`. La lógica
privilegiada equivalente vive en `private`, usa `SECURITY DEFINER` y
`search_path = ''`.

| RPC                                                                                                                                                     | Contrato                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reconcile_moodle_task_intents_v1(p_launch_id uuid default null)`                                                                                       | Reconcilia unidades y padrón de forma idempotente; sólo coordinación o `service_role`.                                                                                 |
| `claim_moodle_task_intent_lease_v1(p_batch_size integer default 5, p_lease_seconds integer default 300, p_worker_token uuid default gen_random_uuid())` | Reclama sólo `dedicated`; lote 1–20, lease 30–1800 s y `FOR UPDATE SKIP LOCKED`.                                                                                       |
| `confirm_moodle_task_intent_v1(...)`                                                                                                                    | Exige lease vigente, `stable_key` exacta y hash de toda la configuración. Deriva produce `needs_attention`; coincidencia crea/actualiza catálogo y vínculo confirmado. |
| `request_moodle_task_reconcile_v1(p_intent_id uuid)`                                                                                                    | Reencola una intención `dedicated` en `error` o `needs_attention`.                                                                                                     |
| `set_moodle_expected_participant_exception_v1(...)`                                                                                                     | Cambia una membresía con motivo obligatorio para excepciones.                                                                                                          |
| `get_moodle_task_unit_summaries_v1(p_launch_id uuid default null, p_orientation text default null)`                                                     | Read model con esperados, entregados, faltantes, corrección, reentrega, aprobados, desaprobados, exceptuados y resueltos. Respeta RLS.                                 |
| `set_special_pps_task_v1(...)`                                                                                                                          | Configura la tarea anual exacta de una PPS especial; sólo coordinación o `service_role`.                                                                               |
| `assign_special_pps_v1(...)`                                                                                                                            | Crea atómicamente práctica, vínculo Moodle confirmado y asignación especial sin fecha límite.                                                                          |
| `cancel_special_pps_assignment_v1(...)`                                                                                                                 | Cancela la asignación, retira el vínculo visible y conserva la práctica como `No se pudo concretar`.                                                                   |

La confirmación no está autorizada para `legacy_shared`; tampoco se adopta una
tarea por semejanza de nombre.

## 4. Creación transaccional

Tres triggers intentan reconciliar después de cambios relevantes:

- estado/orientación/fechas de `lanzamientos_pps`;
- lanzamiento, orientación, estado, estudiante o fin de `practicas`;
- tarea/orientación/validación en `lanzamiento_moodle_tareas`.

Los triggers no llaman a Moodle. Sólo materializan o actualizan intención y
padrón cuando la operación fue realizada por coordinación; el flujo académico
no queda atado a la disponibilidad del Campus.

## 5. Seguridad y lectura

- Tablas públicas: RLS activa y escritura directa revocada a usuarios.
- Coordinación de escritura: `SuperUser`, `AdminTester` o `service_role`.
- Lectura: coordinación, directivos, jefe de la orientación y el estudiante de
  sus propias unidades/participaciones.
- Una jefatura o simulación admin puede observar Moodle; eso no otorga permiso
  para provisionar tareas.

## 6. Estados y escalas

- `percentage`: se normaliza con `grade_value / grade_max * 10`.
- `direct_10`: el valor ya está en escala 0–10, aunque Moodle informe `/100`.
- `pass_fail`: cualquier valor positivo es aprobado.
- Nota insuficiente implica `revision_required`, no `failed_final` automático.
- Una aprobación sólo vuelve terminal a la práctica después de su fecha de
  finalización.
- `submitted_at` real inicia el SLA de corrección de 30 días corridos;
  `observed_at` sólo expresa frescura de lectura.

## 7. Límites actuales, sin ambigüedad

- El planificador TypeScript es puro: decide `create`, `verify`, `repair_drift`
  o `needs_attention`, pero todavía no maneja el navegador.
- El observador TypeScript arma la cola y resuelve participantes de forma
  estricta, pero todavía no tiene scheduler/checkpoints persistentes propios.
- No existe una tabla de feature flags v2. Los nombres del plan son propuestas,
  no controles productivos.
- El flujo de jefatura 2026 sí está integrado: obtiene las tareas anuales de su
  orientación y las solicita secuencialmente en lotes de 4.

## 8. Evidencia verificable

- Schema: `supabase/migrations/20260820100000_create_moodle_task_intents_and_participants.sql`.
- Backfill: `supabase/migrations/20260820101000_backfill_legacy_moodle_task_intents.sql`.
- Hardening: `supabase/migrations/20260820110500_harden_moodle_v2_advisors.sql`.
- Contrato SQL: `supabase/tests/moodle_v2_schema_contract.sql`.
- PPS especiales: `supabase/tests/special_pps_assignments_contract.sql`.
- Tipos: `src/types/supabase.ts`, siempre regenerados con `npm run gen-types`.
