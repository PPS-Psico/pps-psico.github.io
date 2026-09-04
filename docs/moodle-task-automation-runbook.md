# Runbook · Tareas e informes Moodle v2

Vigencia: 3 de septiembre de 2026
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

## 3. Barrido de correo

El barrido automático sólo ve lo que ya está vinculado. Hay dos fallas que no
puede detectar por definición y que llegan únicamente por correo, así que esta
revisión es parte de la rutina y no una tarea administrativa aparte.

**Informe entregado que nadie leyó.** La tarea existe y el alumno subió el
informe, pero la fila nunca entró en la ventana del barrido, así que jefatura
no la vio nunca. Detectado el 2026-09-02 por el correo de Florencia Garcia
Panetta (29259): dos informes de 2025 sin corregir porque la ventana gastaba
sus lugares en tareas del año en curso.

**No existe dónde entregar.** El caso no encaja en ningún lanzamiento y no hay
actividad creada en Moodle, así que el alumno no tiene lugar donde subir nada
y el barrido no tiene qué encontrar. Detectado el 2026-09-03 por Lara Petit
(33374), informe de un proyecto de investigación.

### Cadencia

Semanal, y siempre antes de contestarle a un alumno que su caso está resuelto.

### Búsqueda

```
in:inbox -in:sent (informe OR entrega OR corregir OR nota OR campus OR tarea)
in:inbox -in:sent ("no me aparece" OR "no puedo subir" OR "donde entrego"
  OR "dónde entrego" OR "no figura" OR "sin corregir" OR "sigo sin")
```

Un alumno que escribió dos o más veces sin obtener respuesta es la señal más
fuerte que hay: revisar primero los hilos sin contestar y recién después por
fecha. Los dos casos de arriba habían escrito tres y dos veces.

### Triage

| Síntoma en el correo                             | Causa a verificar                                           | Dónde                                     |
| ------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------- |
| "subí el informe y no me lo corrigieron"         | la tarea nunca entró en la ventana del barrido              | `unswept_pending_tasks` del catálogo      |
| "no me aparece la tarea" / "no sé dónde subirlo" | falta el vínculo confirmado, o falta la actividad en Moodle | `practica_moodle_tareas`, `aula_entregas` |
| "me figuran menos horas de las que hice"         | práctica duplicada, o vínculo al lanzamiento equivocado     | `practicas` del legajo                    |
| nota que no corresponde a lo corregido           | `grade_conversion_mode` contra el máximo real de la tarea   | `aula_entregas.grade_conversion_mode`     |

Una tarea que califica sobre 10 registrada como `percentage` hace que un 9 se
lea como 9%. Cotejar el máximo real de Moodle, no el que se asume.

### Reglas

1. No contestar "ya está resuelto" sin haberlo verificado contra la base. La
   verificación cambia la respuesta con frecuencia suficiente como para que no
   valga la pena saltearla.
2. Un correo sin responder hace más de cinco días hábiles se trata como
   incidente abierto, no como pendiente administrativo.
3. Toda corrección que salga de un correo se aplica por migración, con legajo,
   motivo y evidencia en el encabezado.
4. Si el correo afirma un dato académico que la base contradice —horas,
   orientación, cantidad de comisiones—, no se toca nada hasta confirmarlo con
   Coordinación. El caso Latrichiana en
   `20260903130000_dedupe_all_and_relink_lara.sql` parecía un duplicado obvio y
   no lo era.
5. Un correo puede pedir algo que el panel todavía no sabe hacer. Si es así,
   corresponde ampliar el panel y no resolverlo sólo a mano: el pedido de Petit
   derivó en el tipo `proyecto_investigacion`.

## 4. Backfill 2026

El backfill sólo usa vínculos confirmados exactos. Resultado inicial productivo:

- 212 intenciones `legacy_shared`;
- 1.409 participantes esperados/históricos;
- 0 cruces de orientación;
- 0 asignaciones ambiguas;
- 3 prácticas contradictorias pendientes de revisión manual.

No volver a ejecutar una heurística amplia para “completar” esos tres casos.
Toda excepción debe conservar evidencia y motivo.

## 5. Reconciliación local

`reconcile_moodle_task_intents_v1(launch_id)` es idempotente. Se puede solicitar
para un lanzamiento desde coordinación, pero sólo cambia Supabase: no crea una
tarea en Moodle.

Los triggers la ejecutan después de cambios relevantes de lanzamiento,
práctica o vínculo. Si Moodle está caído, la activación de la PPS sigue siendo
válida.

## 6. Futuro worker dedicado

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

## 7. Rollback

- Deshabilitar el worker, no borrar intenciones ni snapshots.
- No eliminar una actividad Moodle que ya recibió entregas.
- Mantener `legacy_shared` como sólo lectura.
- Ante una tarea dedicada incorrecta sin entregas, marcar la intención para
  atención manual y conservar la evidencia antes de cualquier corrección.
- La UI debe poder seguir mostrando los snapshots y vínculos legacy aunque el
  aprovisionamiento esté detenido.

## 8. Validación de release

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

## 9. Piloto de acreditación híbrida

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
