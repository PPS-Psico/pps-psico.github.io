# Puente de sesión Moodle → Mi Panel

Estado: implementado en aplicación, base y Edge Function el 2026-08-10; pendiente de pegar la etiqueta versionada en Moodle y ejecutar la prueba integrada con un alumno real.

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
      "gradedAtDisplay": "lunes, 10 de agosto de 2026, 11:09"
    }
  ]
}
```

Estados permitidos: `no_access`, `not_submitted`, `submitted`, `graded`, `parse_error`.

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
- Pedir únicamente los cmids confirmados en `lanzamiento_moodle_tareas`.
- Validar forma, rangos y tipos antes de mostrar o persistir.
- Fallar cerrado: si falta vínculo, acceso o parsing, mostrar “Consultar en Moodle”; no conservar una nota anterior como si fuera actual.
- Separar valor bruto Moodle de la conversión al esquema 1–10 de Mi Panel.

## Persistencia implementada

La observación debe ser append-only e incluir como mínimo:

- estudiante, práctica, lanzamiento y cmid;
- Moodle user id observado;
- estado de entrega;
- `grade_value`, `grade_max` y texto original;
- fecha de calificación;
- `observed_at`;
- versión del puente;
- huella del payload y datos de parsing;
- nivel de confianza `moodle_session_observed`.

`practicas.nota` no se actualiza desde el mensaje. Las observaciones se guardan en `moodle_grade_observations` y la última lectura por práctica en `moodle_grade_snapshots`. La actualización del legado ocurrirá sólo desde un lote de conciliación aprobado y auditable.

El formulario estudiantil de acreditación tampoco solicita ni escribe una nota. La base bloquea cambios estudiantiles sobre `practicas.nota` y elimina cualquier nota autodeclarada que intentara entrar dentro de `finalizacion_pps.detalle_practicas`.

## Conciliación masiva

El puente de navegador es oportunista: recoge información cuando cada estudiante abre el panel dentro de Moodle. Para completar el universo histórico existen dos caminos:

1. exportación CSV/XLSX del libro de calificaciones e importación en modo dry-run;
2. servicio web Moodle restringido, consumido por una Edge Function.

El segundo es el objetivo definitivo y debe mantener el token fuera del frontend.

### Reporte previo a cualquier actualización

Coordinación puede consultar `get_moodle_grade_discrepancies()` para ver, sin escribir nada:

- estudiante, PPS y orientación;
- nota legacy;
- estado, nota y escala cruda de Moodle;
- una referencia matemática en escala 1–10;
- fecha de observación y estado de comparación.

El estado `requires_scale_decision` es intencional: hasta aprobar formalmente cómo convertir `83/100`, el reporte no lo declara igual ni distinto de una nota legacy `8`.
