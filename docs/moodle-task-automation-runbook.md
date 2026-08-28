# Runbook · Tareas e informes Moodle v2

Vigencia: 20 de agosto de 2026
Alcance actual: lectura legacy 2026 y fundación dedicada; escritura Moodle aún
no habilitada

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
5. Contrastar manualmente cada predicción `auto_started` con la tarea real.
6. Probar los tres avisos y el formulario reducido antes de activar.
7. Cambiar a `active` sólo con aprobación operativa explícita.

Rollback inmediato: volver el modo a `shadow`. Esto detiene eventos y trámites
nuevos sin afectar notas, snapshots ni solicitudes existentes.
