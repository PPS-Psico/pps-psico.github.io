---
name: tareas-campus-pps
description: Revisa la cola de informes PPS, recupera tareas existentes por su ID estable y confirma cada tarea mediante relectura bajo lease
---

Trabajás en `C:\Users\Blas_\Downloads\Mi Panel Antigravity\consulta-pps-moodle-automation`.
Antes de ejecutar, cambiá explícitamente a esa carpeta y volvé a leer este
archivo desde disco. No reutilizar instrucciones cargadas por una corrida
anterior. Contrato vigente: `moodle-writer/v2`. Los scripts de esta carpeta
están versionados juntos; no ejecutar desde el checkout de desarrollo `consulta-pps-uflo`.
La automatización controla Moodle con Claude in Chrome y usa los scripts del
proyecto para reclamar y verificar trabajo. Curso autorizado: **3615**. Para
2027 se usa **Tareas 2027 dentro del mismo curso**.

Decisión vigente desde el 7/9/2026: cada lanzamiento nuevo usa tareas
exclusivas, también durante 2026. La política `moodle_task_policy` conserva
los históricos como `legacy_shared` y nace `dedicated` en los nuevos.
No esperar al año 2027 ni reutilizar tareas de otra cohorte de la institución.
Dos tareas con el mismo nombre pueden corresponder a lanzamientos diferentes:
el ID estable es la identidad; una coincidencia sin ID válido requiere revisión.

## Leer la cola

Ejecutá `node scripts/moodle-provisioner-dry-run.mjs`. El resultado es JSON.
Sólo permanecé en silencio si terminó con código 0, `status: idle` y
`attention: []`. Informá las intenciones de `attention` aunque no haya trabajo
reclamable. Un error de consulta nunca significa que no hay trabajo.

Las intenciones `legacy_shared` son exclusivamente de lectura: nunca crearlas,
adoptarlas por nombre ni reconfigurarlas. No activar lanzamientos, cambiar el
modo de una intención, reencolar casos bloqueados ni modificar participantes.

## Inventario antes de crear

Usá Claude in Chrome (`mcp__claude-in-chrome__*`), que conserva la sesión del
usuario. Si aparece el acceso y ya está autocompletado, podés pulsar Acceder.
Si los campos están vacíos, pedí que Blas inicie sesión. No busques credenciales.

Antes de reclamar, enumerá las tareas del curso completo, incluidas ocultas y
stealth y todas las pestañas anuales. Para cada tarea leé su `Número ID` real
en el formulario de edición; no guardes esos formularios. Una búsqueda por
nombre o el catálogo de Mi Panel no sustituyen este inventario. Si falta una
lectura o página, detené la creación y explicá qué faltó.

Guardá un inventario observado en JSON con `courseId: 3615`, `complete: true`,
`observedAt` ISO UTC, `courseAssignmentCmids` (CMID numéricos enumerados) y
`activities` (una entrada por tarea con `cmid`, `idNumber` y `name` leídos).
Sólo declarar `complete: true` después de leer todas las tareas. No incluir
datos de estudiantes, entregas ni contraseñas en esos archivos.

## Reclamar y verificar antes de escribir

Ejecutá `node scripts/moodle-provisioner-apply.mjs claim`. Reclama una sola
intención por 30 minutos y devuelve `leaseFile`. Conservá esa ruta exacta.
Cada corrida tiene su propio directorio; nunca reemplaces otro lease ni
muestres su token. Si se cortó después de reclamar, usá
`node scripts/moodle-provisioner-apply.mjs resume <lease.json>`.

Ejecutá `node scripts/moodle-provisioner-apply.mjs preflight <lease.json> <inventario.json>`.
El comando comprueba inventario reciente y lease vivo. Sólo continuar con código 0:

- `verify_existing`: abrir exactamente ese CMID, aunque el nombre haya cambiado.
- `create`: crear una tarea nueva con el ID estable indicado en `intent.expected`.
- Error: detenerse; no interpretar el error como ausencia de tarea.

El nombre por sí solo nunca permite adoptar. Dos ID estables iguales, un
nombre coincidente sin ID estable o un CMID diferente al vínculo confirmado
requieren revisión. Un lease vencido requiere retomar con una nueva reclamación
y nuevo inventario, nunca crear a ciegas otra tarea.

## Configurar y releer

Abrí la pestaña exacta `intent.sectionTitle` y ubicá `intent.areaBanner`.
Las áreas son banners dentro de la sección anual, no secciones Moodle separadas.
Si falta la pestaña o el banner, informá el faltante. No crear en General ni
inventar una sección de destino. Usá Añadir actividad después de la última
tarea del área correcta.

Cargá los valores exactos de `intent.expected`: nombre, Número ID, HTML,
apertura, entrega, fecha límite, **Recordarme calificar en**, escala y visibilidad.
Usá Formato HTML en el editor. Respetá fechas nulas deshabilitando su control.
`stealth` significa disponible pero sin mostrar en la página; `hidden` es oculto.
Sólo envío de archivos; texto en línea desactivado. Configurá Intentos
permitidos en Ilimitado y Conceder intentos en Manual, para que el docente
pueda habilitar una reentrega. No agregar restricciones de acceso por perfil.
Las fechas ISO están en UTC:
convertí para el huso horario mostrado por Moodle, con precisión de minutos.

En una tarea existente sin descripción declarada (`descriptionHtml: null`),
conservá el texto docente. No modificar tareas con entregas existentes para
resolver desvíos: informar y conservar el checkpoint para revisión.

Después de guardar, abrí de nuevo `/course/modedit.php?update=<cmid>`. Moodle
puede devolver el formulario porque Recordarme calificar en precede a la
entrega: ver el formulario no demuestra un guardado exitoso.

Guardá `observado.json` con valores **releídos**, nunca copiados del plan:
`cmid`, `courseId`, `sourceUrl` del editor, `observedAt` ISO UTC,
`sectionId` real (ID de sección, no índice de pestaña), `sectionTitle`,
`areaBanner` comprobado en la ubicación de la actividad, `stableKey`, `name`,
`descriptionHtml`, `openAt`, `dueAt`, `cutoffAt`, `gradingDueAt`, `gradeMode`,
`gradeMax`, `sectionKey`, `visibility`, `fileSubmissions`, `onlineText`.
`sectionKey` se deriva del área observada: informes-clinica, informes-laboral,
informes-comunitaria o informes-educacional; no es el ID de la sección Moodle.

Actualizá el inventario completo después de la relectura y guardalo como
`inventario-final.json`. Debe existir exactamente una tarea con ese Número ID.
Confirmá con:

`node scripts/moodle-provisioner-apply.mjs confirm <lease.json> <observado.json> <inventario-final.json>`

Sólo código 0 y `verified: true` confirman el trabajo. Un rechazo no se reintenta
creando otra tarea: guardá los archivos, CMID y motivo y avisá a Blas. Si se
cortó antes de confirmar, la próxima corrida recupera por ID estable.

Después de cada confirmación exitosa, volvé a leer la cola y procesá la siguiente
intención reclamable con el mismo procedimiento. Una corrida no se considera
terminada por haber creado una sola tarea si todavía hay trabajo reclamable.
Si la sesión se corta o el tiempo disponible no alcanza, conservá los recibos
y reportá cuántas quedaron pendientes; la próxima corrida recupera por ID.

## Resultado

Informá tareas verificadas con sus CMID y cualquier bloqueo concreto. No
presentes una lectura como creación ni una tarea guardada como verificada
antes de la confirmación. Los archivos locales contienen checkpoints del
worker; la evidencia de confirmación queda en la intención. No afirmar que
existe un historial central completo de todas las etapas del navegador.

La habilitación general de creación 2027 depende del piloto real de creación,
repetición sin duplicados, entrega, corrección y reentrega. Este procedimiento
no declara ese piloto completado ni autoriza cambios sobre tareas históricas.
