# Puente de sesión Moodle → Mi Panel

Estado: implementado y probado de punta a punta en aplicación, base, Moodle y Edge Function. Desde el 2026-08-11 la sincronización se inicia en segundo plano al montar la sesión estudiantil dentro del iframe del Campus y aplica automáticamente las calificaciones detectadas.

## Instalación en Moodle

El código completo que debe reemplazar el contenido de la Etiqueta **Inicio** está en [`moodle-label-inicio-bridge.html`](./moodle-label-inicio-bridge.html).

1. Activar edición en el curso `3615`.
2. Editar la Etiqueta que contiene el iframe de Mi Panel.
3. Pegar el archivo completo en el editor de código y elegir **Formato HTML**.
4. Guardar y abrir el curso con rol estudiante.

La etiqueta conserva el iframe y el ajuste automático de altura. Además responde únicamente a pedidos autenticados del iframe, consulta como máximo 20 tareas confirmadas y nunca acepta URLs arbitrarias.

## Qué se comprobó

Dentro de una Etiqueta Moodle en formato HTML, el script del documento padre puede consultar páginas del mismo dominio usando la sesión Moodle activa. En la tarea `946366` del curso `3615` se detectaron correctamente:

- finalización de la actividad;
- entrega existente;
- calificación `83,00 / 100,00`;
- fecha de calificación.

Esto permite una primera integración sin token: Moodle obtiene la información con sus propios permisos y se la entrega al iframe de Mi Panel.

## Límite de confianza

El resultado es una **observación proveniente de una sesión Moodle**, no una prueba criptográfica emitida por el servidor. Un estudiante con conocimientos avanzados puede modificar JavaScript o falsificar un mensaje en su navegador.

Por eso:

- reemplaza con mucha ventaja la nota escrita libremente en un selector;
- debe guardar procedencia y evidencia;
- no debe presentarse como equivalente a una integración REST servidor-a-servidor;
- la integración definitiva sigue siendo un servicio web Moodle de mínimo privilegio.

## Contrato de mensajes

Versión inicial propuesta: `pps-moodle-bridge/v1`.

### Panel → Moodle

```json
{
  "type": "PPS_MOODLE_TASKS_REQUEST",
  "version": 1,
  "requestId": "uuid-aleatorio",
  "courseId": 3615,
  "cmids": [946366]
}
```

### Moodle → Panel

```json
{
  "type": "PPS_MOODLE_TASKS_RESULT",
  "version": 1,
  "requestId": "uuid-aleatorio",
  "courseId": 3615,
  "observedAt": "2026-08-10T14:09:00.000Z",
  "tasks": [
    {
      "cmid": 946366,
      "status": "graded",
      "submitted": true,
      "gradeValue": 83,
      "gradeMax": 100,
      "gradeDisplay": "83,00 / 100,00",
      "gradedAtDisplay": "lunes, 10 de agosto de 2026, 11:09",
      "submittedAt": "2026-07-21T04:12:00.000Z",
      "submittedAtDisplay": "martes, 21 de julio de 2026, 01:12"
    }
  ]
}
```

Estados permitidos: `no_access`, `not_submitted`, `submitted`, `graded`, `parse_error`.

### Barrido anual de jefatura

El panel de Jefe usa un mensaje separado. El iframe sólo envía los `cmid`
devueltos por `get_jefe_moodle_sync_tasks_v1()` o, dentro del simulador Admin,
por `get_jefe_moodle_sync_tasks_preview_v1(preview_key)`; el documento padre abre
`action=grading&perpage=-1&status=submitted`, extrae únicamente las columnas
necesarias de la tabla y nunca devuelve archivos ni HTML completo.

```json
{
  "type": "PPS_MOODLE_JEFE_TASKS_REQUEST",
  "version": 1,
  "requestId": "uuid-aleatorio",
  "courseId": 3615,
  "cmids": [1109159, 1110106]
}
```

Cada fila de `PPS_MOODLE_JEFE_TASKS_RESULT` incluye el `cmid`, DNI/usuario
Moodle del estudiante, estado, nota bruta y la fecha real de última modificación
de la entrega. El resultado identifica además al usuario Moodle que realizó la
lectura. `sync_jefe_moodle_reports_v1` verifica la identidad de la jefatura real.
En el simulador, `sync_jefe_moodle_reports_preview_v1` exige un rol
`SuperUser`/`AdminTester`, vuelve a resolver la clave opaca seleccionada y limita
el lote a sus áreas y tareas antes de persistir. Ambos caminos comparten la misma
resolución cerrada por `cmid + DNI`; una coincidencia ambigua no se aplica.

## Reglas del documento padre Moodle

- Aceptar mensajes sólo si `event.origin === "https://pps-psico.github.io"` y `event.source` es el iframe esperado.
- Responder únicamente a `https://pps-psico.github.io`; no usar `"*"`.
- Aceptar sólo cmids numéricos presentes en la solicitud.
- Construir internamente la URL `/mod/assign/view.php?id=CMID`; nunca aceptar una URL arbitraria desde el iframe.
- Consultar con `credentials: "same-origin"`.
- Limitar concurrencia y tiempo de espera.
- No enviar HTML completo, cookies, `sesskey` ni datos de otros participantes.
- Mantener el código de la Etiqueta versionado en este repositorio.

## Reglas del iframe Mi Panel

- Aceptar resultados sólo desde `https://campus.uflo.edu.ar` y desde `window.parent`.
- Correlacionar cada respuesta con un `requestId` vigente.
- Pedir únicamente los cmids confirmados en `lanzamiento_moodle_tareas` o en
  `practica_moodle_tareas` para excepciones legacy sin lanzamiento confiable.
- Validar forma, rangos y tipos antes de mostrar o persistir.
- Fallar cerrado: si falta vínculo, acceso o parsing, mostrar “Consultar en Moodle” sin inventar un estado. El último estado confiable se conserva con su fecha y se distingue de la última lectura fallida.
- Separar valor bruto Moodle de la conversión al esquema 1–10 de Mi Panel.

## Persistencia implementada

La observación debe ser append-only e incluir como mínimo:

- estudiante, práctica, lanzamiento y cmid;
- Moodle user id observado;
- estado de entrega;
- fecha real de entrega mostrada por Moodle y su texto original;
- `grade_value`, `grade_max` y texto original;
- fecha de calificación;
- `observed_at`;
- versión del puente;
- huella del payload y datos de parsing;
- nivel de confianza `moodle_session_observed`.

`lanzamiento_id` es nullable de forma intencional en el ledger y el snapshot:
cuando una práctica legacy tiene una relación confirmada en
`practica_moodle_tareas`, el servidor valida esa relación directa y conserva
`NULL` en lugar de inventar un lanzamiento. Una observación inválida se rechaza
de manera individual para que no bloquee las restantes del mismo lote.

La sincronización no depende de abrir **Entregas**: `MoodleGradeSyncProvider` envuelve todo el panel estudiantil y solicita las tareas confirmadas apenas terminaron de cargar la identidad, las PPS y sus vínculos. Esto ocurre en segundo plano desde Inicio. La limitación técnica se mantiene: la lectura sólo puede ejecutarse cuando Mi Panel está dentro del iframe de `campus.uflo.edu.ar`, porque el documento padre es quien posee la sesión Moodle.

Cada snapshot conserva dos vistas: el mejor estado académico confirmado y la última observación real (`last_*`). De ese modo, un timeout o un cambio transitorio de Moodle queda visible para soporte sin borrar una entrega o nota previamente confirmada. Cada ejecución también queda resumida en `moodle_sync_runs`, con cantidades aceptadas, rechazadas, preservadas, resultado y duración.

Cuando una observación validada llega con estado `graded`, un trigger privado actualiza los campos académicos separados de la práctica (`informe_estado`, `nota_moodle`, `nota_fuente`, `nota_actualizada_at` y `nota_moodle_cmid`) dentro de la misma transacción. `practicas.nota` se conserva sólo por compatibilidad con pantallas legacy. El antes/después queda en `private.moodle_grade_applications` y el frontend estudiantil nunca obtiene permiso de escritura sobre la nota.

La conversión a la escala 0–10 del panel es explícita por tarea mediante `aula_entregas.grade_conversion_mode`; nunca se infiere a partir de que el número parezca bajo. Los modos admitidos son:

- `percentage`: normaliza matemáticamente la nota respecto de su máximo;
- `direct_10`: conserva una calificación ya cargada en escala 0–10 aunque Moodle muestre `/ 100`;
- `pass_fail`: conserva `Aprobado`/`Desaprobado` y no inventa una nota numérica.

La primera calificación completa cierra el escaneo de esa práctica+tarea. Si el docente cambia una nota ya publicada, coordinación debe usar **Reabrir lectura**: se registra quién y por qué la reabrió, se incrementa la revisión y se acepta exactamente una nueva calificación terminal. Una lectura demorada nunca puede pisar una observación más reciente, y la nota anterior se conserva hasta recibir la nueva lectura válida.

El formulario estudiantil de acreditación tampoco solicita ni escribe una nota. La base bloquea cambios estudiantiles sobre `practicas.nota` y elimina cualquier nota autodeclarada que intentara entrar dentro de `finalizacion_pps.detalle_practicas`. Las vistas administrativas de finalización resuelven la nota y el promedio en el servidor desde la práctica/snapshot vigente, sin confiar en el JSON enviado por el alumno.

El promedio para SAC sólo se informa cuando todas las PPS de la solicitud tienen una calificación numérica con procedencia Moodle o una corrección explícita de coordinación. Si falta una, el promedio queda vacío en vez de calcularse sobre un subconjunto.

### Lectura desde el panel administrativo

Al abrir `/admin/estudiantes/:legajo`, coordinación consulta
`moodle_grade_snapshots` por el `estudiante_id` resuelto en el servidor. La vista
de **Mis prácticas** muestra el último estado guardado de cada tarea, la nota si
existe y la hora más reciente de observación. También aclara que se trata de una
lectura histórica y cuántas tareas integran el registro.

Abrir el estudiante como administrador no intenta usar la sesión Moodle del
coordinador ni genera una observación nueva. La actualización ocurre únicamente
cuando el propio estudiante entra a Mi Panel dentro del iframe del Campus; hasta
entonces coordinación ve el último snapshot persistido. La consulta respeta RLS:
el alumno sólo puede leer sus filas y los roles autorizados por `is_admin()`
pueden leer el estudiante seleccionado.

## Conciliación masiva

La sesión estudiantil sigue siendo oportunista, pero la jefatura ya realiza un
barrido automático de las tareas únicas del año corriente de sus orientaciones.
Esto cubre relanzamientos que reutilizan la misma tarea sin repetir solicitudes:
el backend asocia cada entrega a su práctica mediante `cmid + DNI`. Las
coincidencias duplicadas se informan y quedan sin aplicar para evitar asignar
una entrega al relanzamiento equivocado.

Para completar años históricos o trabajar sin una sesión Moodle de jefatura se
mantienen dos caminos:

1. exportación CSV/TSV normalizada del libro de calificaciones e importación administrativa, primero en modo dry-run y luego en modo aplicar;
2. servicio web Moodle restringido, consumido por una Edge Function.

El primer camino ya está implementado en la pantalla de salud de Campus. El archivo debe contener `dni`, `cmid`, `status` y, para notas, `grade_value` y `grade_max`. El backend vuelve a resolver estudiante, práctica, vínculo y escala; no acepta esos datos como autoridad del archivo. Cada lote conserva conteos y rechazos, pero no guarda el archivo original. El segundo camino sigue siendo el objetivo definitivo y debe mantener el token fuera del frontend.

### Reporte previo a cualquier actualización

Coordinación puede consultar `get_moodle_grade_discrepancies()` para ver, sin escribir nada:

- estudiante, PPS y orientación;
- nota legacy;
- estado, nota y escala cruda de Moodle;
- una referencia matemática en escala 1–10;
- fecha de observación y estado de comparación.

El reporte usa la misma conversión que la escritura automática y devuelve `matches_moodle` o `different_from_moodle`. El ledger privado conserva `previous_note`, `applied_note`, nota y escala Moodle, regla de conversión, procedencia y fecha de observación para reconstruir cada cambio.
