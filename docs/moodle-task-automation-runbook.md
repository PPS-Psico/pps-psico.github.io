# Runbook · Tareas e informes Moodle v2

Vigencia: 7 de septiembre de 2026.
Alcance actual: lectura histórica y creación dedicada autorizada por lanzamiento,
también en 2026. El worker de Claude completó la cola de nueve unidades de 2026:
seis creaciones y tres recuperaciones por ID estable, auditadas en base y Campus.
La prueba de entrega, corrección y reentrega de estudiante sigue siendo un
piloto separado; no se declara completada por la creación de tareas.

## Procedimiento vigente del escritor

Usar [claude-task-writer.md](moodle-v2/claude-task-writer.md), que define
`claim`, `preflight` y `confirm <lease.json> <observado.json> <inventario-final.json>`.
No usar el contrato antiguo `confirm <intentId>` ni crear manualmente omitiendo
el writer. La carpeta operativa de Claude es `../consulta-pps-moodle-automation`;
el checkout principal del desarrollo puede contener cambios ajenos a esta rutina.
Las migraciones aplicadas se verifican en el ledger vivo; un archivo sin seguimiento
en otro checkout no demuestra que la migración esté pendiente de aplicar.

Estado auditado al cierre del 7/9: nueve unidades verificadas, cola `idle` sin
alertas, inventario final de 121 tareas. No reencolar ni recrear esas unidades.
El verificador ahora exige también `maxAttempts`, `attemptReopenMethod` y el
objeto completo `availabilityConditions`, y los guarda en la evidencia enviada
a la base. Las confirmaciones nuevas requieren una relectura con esos campos;
los recibos anteriores se conservan sin inventar evidencia retrospectiva.

Actualización operativa del 6/9/2026: consultar primero el
[corte del tablero](moodle-v2/workboard.md#corte-operativo-del-6-de-septiembre).
El puente vigente está instalado en la **descripción de General, sección
50889**, no en una actividad Etiqueta independiente. No agregar otro puente
siguiendo la ubicación histórica de este documento.

## 1. Comprobación rápida

1. Verificar que la intención/unidad existe en el Lanzador y que los conteos no
   aparecen inventados durante carga o error.
2. Para jefatura, abrir el panel dentro del iframe del Campus. Fuera de Moodle la
   lectura nueva debe quedar `unavailable` y conservar el último snapshot.
3. Con 13 tareas se esperan cuatro llamadas secuenciales: `4 + 4 + 4 + 1`.
4. Un timeout aislado debe producir estado parcial; los lotes ya persistidos no
   se descartan.
5. Los casos críticos se ordenan antes que los próximos/en plazo y se calculan a
   30 días corridos desde `submitted_at`, nunca desde `observed_at`.

## 2. Incidente de sincronización de jefatura

### No disponible

Confirmar que Mi Panel está embebido en `campus.uflo.edu.ar`. El puente depende
de la sesión Moodle del documento padre; abrir la URL standalone no puede leer
actividades.

### Timeout o resultado parcial

Usar **Reintentar**. La lectura vuelve a ejecutar los lotes, pero no elimina el
último estado confirmado. Revisar `failedTasks`, coincidencias ambiguas y no
encontradas antes de atribuir el problema a la cantidad total.

### Datos de una persona no coinciden

Resolver en este orden:

1. `course_id + cmid` exactos y vínculo confirmado;
2. usuario Moodle exacto para esa tarea;
3. DNI normalizado no vacío;
4. una sola práctica compatible con tarea, estudiante, año y orientación.

Si hay dos candidatas, fallar cerrado y corregir el vínculo/padrón. No elegir por
nombre de institución.

## 3. Backfill 2026

El backfill sólo usa vínculos confirmados exactos. Resultado inicial productivo:

- 212 intenciones `legacy_shared`;
- 1.409 participantes esperados/históricos;
- 0 cruces de orientación;
- 0 asignaciones ambiguas;
- 3 prácticas contradictorias pendientes de revisión manual.

No volver a ejecutar una heurística amplia para “completar” esos tres casos.
Toda excepción debe conservar evidencia y motivo.

## 4. Reconciliación local

`reconcile_moodle_task_intents_v1(launch_id)` es idempotente. Se puede solicitar
para un lanzamiento desde coordinación, pero sólo cambia Supabase: no crea una
tarea en Moodle.

Los triggers la ejecutan después de cambios relevantes de lanzamiento,
práctica o vínculo. Si Moodle está caído, la activación de la PPS sigue siendo
válida.

## 5. Futuro worker dedicado

### Regla de fechas que no se puede omitir

Antes de guardar cualquier tarea, el worker debe setear **Recordarme calificar
en** (`gradingduedate`) en una fecha **posterior o igual a la fecha de entrega**.
Moodle valida las fechas entre sí y rechaza el guardado si no se cumple, pero
el rechazo es indistinguible del éxito para un agente: el formulario se vuelve
a mostrar sin cartel arriba y el mensaje queda al pie del bloque
Disponibilidad. El campo trae un default cercano al día de creación, así que
cualquier tarea con entrega a meses vista lo viola por defecto.

Verificado a mano en el curso 3615 el 2026-08-20. De ahí salen dos reglas:

1. `planTaskProvisioning` devuelve `needs_attention` con
   `grading_due_before_due` o `missing_grading_due_at` antes de intentar un
   guardado que Moodle no puede aceptar.
2. Nunca marcar una tarea como creada sin releerla y confirmar `cmid`, nombre y
   fechas. "Hice clic en Guardar" no es evidencia de nada.

Antes de habilitar escrituras reales, el worker debe:

1. reclamar como máximo 20 intenciones con token propio;
2. trabajar sólo sobre `mode = dedicated`;
3. buscar exclusivamente por `stable_key`/`ID number`;
4. crear o reparar desde una plantilla validada;
5. volver a leer todos los campos materiales;
6. confirmar con el mismo token antes de vencer el lease;
7. registrar corrida, paso, duración, evidencia y error;
8. reejecutarse sin crear duplicados.

Una coincidencia sólo por nombre, dos claves iguales, lease vencido o hash
distinto termina en `needs_attention`.

## 6. Rollback

- Deshabilitar el worker, no borrar intenciones ni snapshots.
- No eliminar una actividad Moodle que ya recibió entregas.
- Mantener `legacy_shared` como sólo lectura.
- Ante una tarea dedicada incorrecta sin entregas, marcar la intención para
  atención manual y conservar la evidencia antes de cualquier corrección.
- La UI debe poder seguir mostrando los snapshots y vínculos legacy aunque el
  aprovisionamiento esté detenido.

## 7. Validación de release

El worker externo vigente es la tarea de Claude Code `tareas-campus-pps`.
Su procedimiento instalable está en
[moodle-v2/claude-task-writer.md](moodle-v2/claude-task-writer.md).
Usa los scripts del checkout principal y una carpeta privada por corrida en
`.moodle-worker-runs/`; estos archivos no se publican. Una cola sin intenciones
puede tener lanzamientos activos fuera del circuito: el dry-run debe informar
`ACTIVE_LAUNCH_OUTSIDE_QUEUE`, nunca ocultarlos como inactividad normal.

Desde el endurecimiento del 7/9, la confirmación incluye `gradingDueAt` en
`p_evidence` y un hash suplementario del servidor. El hash histórico no cambia.
El hash TypeScript es una huella diagnóstica local, no se compara con el MD5
del servidor. Los timestamps de configuración se comparan por minuto, como
los controles de Moodle. Los valores observados provienen del worker; no son
una certificación independiente de una API de Moodle.

```bash
npm run gen-types
npm run type-check
npm run lint
npm test
npm run build
npm run check:migrations
```

Además ejecutar `supabase/tests/moodle_v2_schema_contract.sql`, revisar los
advisors de seguridad/performance y probar el simulador admin en el Campus. No
marcar el writer como productivo hasta completar el piloto end-to-end.

## 8. Piloto de acreditación híbrida

1. Confirmar que `accreditation_automation_mode = 'shadow'`.
2. Instalar la versión vigente de `docs/moodle-label-inicio-bridge.html` en la
   etiqueta de Inicio del Campus.
3. Ingresar con estudiantes de prueba que tengan entregas online y presenciales
   con uno, varios, duplicados e imágenes.
4. Revisar el agregado de `get_moodle_submission_evidence_health_v1()` y las
   predicciones privadas; no inspeccionar ni persistir nombres de archivos.
5. Ejecutar `private.backfill_moodle_accreditation_evaluations_v1()` únicamente
   en `shadow` después del reescaneo. Si el modo no es `shadow`, la función debe
   fallar sin procesar estudiantes.
6. Confirmar que toda tarea compartida por más de una PPS presencial del mismo
   estudiante se prediga como `manual_required`, aun cuando tenga dos o más
   adjuntos.
7. Contrastar manualmente cada predicción `auto_started` con la tarea real.
8. Probar los tres avisos y el formulario reducido antes de activar.
9. Cambiar a `active` sólo con aprobación operativa explícita.

Rollback inmediato: volver el modo a `shadow`. Esto detiene eventos y trámites
nuevos sin afectar notas, snapshots ni solicitudes existentes.

## Cobertura de prácticas (8/9/2026)

El worker ejecuta `moodle-provisioner-apply.mjs reconcile` antes del dry-run.
Reconcile es idempotente y sólo procesa la política dedicated. La elegibilidad
incluye prácticas reales aunque el lanzamiento siga Cerrado; no convierte
históricos ni escribe Moodle. Los triggers usan la misma regla.

Desde el 12/09/2026, los destinos faltantes de estudiantes con
`estado = Finalizado` y `fecha_finalizacion` registrada se archivan como
`archivedCoverage` / `STUDENT_FINALIZED`. Se cuentan en
`coverage.archivedFinalizedPractices`, no en las incidencias activas. No se
modifican ni borran prácticas, calificaciones o tareas Moodle. Una práctica
`Finalizada` o una cuenta inactiva no basta; un vínculo ambiguo tampoco se
archiva. Si el estudiante vuelve a Activo, el faltante reaparece. Decisión de
Blas: archivar las incidencias de quienes ya finalizaron las PPS y resolver
las de quienes siguen activos. El total en alcance se descompone en vinculadas,
sin cobertura y archivadas por finalización.

El dry-run pagina todas las tablas y agrega `coverage` y `coverage_gap` a
`attention`. Una cola vacía no equivale a cobertura completa. Audita PPS desde
2024 y sin fecha; contabiliza por separado anteriores a 2024, bajas y actividades
especiales. No usa notas manuales para ocultar faltantes. No resuelve por nombre.
Una incidencia histórica no impide completar otras intenciones aptas.

Remediación histórica: comprobar inventario y antecedentes; conservar cualquier
vínculo confirmado. Cuando se confirma ausencia y coordinación autoriza una tarea
exclusiva, cambiar únicamente la política de ese lanzamiento y ejecutar el mismo
worker con lease, preflight y confirm. No cambiar su estado administrativo ni
vincular una tarea de otra cohorte para forzar cobertura.

La cobertura verifica vínculos locales; no demuestra por sí sola disponibilidad
actual en Moodle. El writer exige relectura real antes de confirmar una creación.
Los fallos posteriores de lectura de Campus siguen visibles en la sincronización.
