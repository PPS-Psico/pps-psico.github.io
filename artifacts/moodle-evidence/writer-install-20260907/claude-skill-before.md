---
name: tareas-campus-pps
description: Crea en el Campus las tareas de informe que falten para las PPS lanzadas, y verifica que hayan quedado bien
---

Revisá si hay PPS esperando su tarea de informe en el Campus y, si las hay, crealas.

Trabajás en `C:\Users\Blas_\Downloads\Mi Panel Antigravity\consulta-pps-uflo`.

## Primero: ¿hay algo que hacer?

```bash
node scripts/moodle-provisioner-dry-run.mjs
```

No escribe nada: solo dice qué haría. **Si dice que no hay nada que aprovisionar, terminá ahí sin decir nada.** Es el caso normal y no hace falta avisar. Solo hablá si hiciste trabajo o si algo necesita a Blas.

## Si hay trabajo

El dry-run imprime, por unidad, los valores exactos a cargar. Reclamá el lease:

```bash
node scripts/moodle-provisioner-apply.mjs claim
```

Después, para cada intención, en el Campus (`campus.uflo.edu.ar`, curso 3615):

**Usá el navegador Claude in Chrome (`mcp__claude-in-chrome__*`), no el Claude Browser (`mcp__Claude_Browser__*`).** Chrome tiene guardado el usuario y contraseña de Blas con autocompletado; el Claude Browser es un perfil limpio sin esas credenciales, así que ahí la pantalla de acceso siempre aparece vacía. Si esas tools están en la lista de deferred, cargalas primero con ToolSearch (`select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__form_input`).

1. **Creá la tarea desde adentro de la pestaña del año que corresponda**, no
   desde una URL con `section=0`. Entra al curso 3615 con el modo de edicion
   activado, abri la pestaña "Tareas <año de inicio de la PPS>" y usa ahi
   "Añadir una actividad". Si la creas fuera de su pestaña queda en General y
   despues hay que moverla a mano, que es incomodo.

   Dentro de la pestaña, esa "actividad" no es una seccion Moodle aparte por
   orientacion: las tres areas conviven en la misma seccion, separadas
   visualmente por un banner "SECCIÓN DE TAREAS". Usá el botón **+** que
   aparece justo despues del **ultimo item** del area que corresponda (antes
   del banner siguiente), para que quede agrupada con las de su area:

   | orientacion_key       | Banner en Moodle           |
   | --------------------- | -------------------------- |
   | clinica               | Área Clínica               |
   | laboral / comunitaria | Área Laboral / Comunitaria |
   | educacional           | Área Educacional           |

   Si la orientación no está en esa tabla, no la ubiques a ojo: preguntale a
   Blas donde va antes de crear nada. Si igual termina mal ubicada (por
   ejemplo, quedo al final de toda la pestaña en vez de bajo su area), se
   reubica despues con el menu **⋮ → Mover** de la tarjeta de la tarea: se
   abre un arbol de secciones, expandi la pestaña del año y hace clic en el
   ultimo item del area correcta para insertarla justo despues.

2. Cargá **exactamente** los valores que imprimió el dry-run: nombre,
   `Número ID`, apertura, fecha de entrega, calificación máxima y descripción.
3. **Disponibilidad: "Hacerlo disponible pero no mostrarlo en la página del
   curso".** Es la convencion del curso: todas las tareas de PPS estan asi. El
   alumno no las encuentra navegando, llega por el link de su tarjeta en Mi
   Panel. No la dejes en "Mostrar" ni en "Ocultar": son cosas distintas y el
   dry-run va a marcar la diferencia como desviacion.
4. En la descripción, poné el selector de formato en **Formato HTML** antes de pegar el bloque. Es un textarea plano, no hay editor que lo reformatee.
5. Dejá **Fecha límite deshabilitada**. Se aceptan entregas tarde a propósito.
6. Seteá **Recordarme calificar en** en la fecha que indica el dry-run. **Esto no es opcional.**
7. Guardá.

### La trampa que tenés que conocer

Moodle **rechaza el guardado si "Recordarme calificar en" es anterior a la fecha de entrega**, y el rechazo es indistinguible del éxito: vuelve a mostrar el formulario, sin cartel arriba, con el mensaje escondido al pie del bloque Disponibilidad. Si eso pasa, la tarea **no existe** aunque parezca que guardaste.

Por eso, después de guardar, **siempre**:

1. Volvé a abrir la tarea (`/course/modedit.php?update=<cmid>`).
2. Leé de vuelta nombre, `Número ID`, las tres fechas, la escala y la visibilidad.
3. Escribí lo que **leíste** (no lo que quisiste escribir) en un JSON y confirmá:

```bash
node scripts/moodle-provisioner-apply.mjs confirm <intentId> observado.json
```

El JSON lleva: `cmid`, `stableKey`, `name`, `descriptionHtml`, `openAt`, `dueAt`, `cutoffAt`, `gradeMode`, `gradeMax`, `sectionKey`, `visibility`.

La base recompara todo bajo el lease y es la autoridad final. Si rechaza la confirmación, la intención queda sin verificar: no la des por hecha.

## Reglas

- **Antes de crear, fijate si la tarea ya existe.** Un duplicado es peor que una
  tarea faltante. Moodle **no tiene busqueda por `Número ID`**, asi que no
  intentes buscar por ahi: no vas a encontrar nada y podes terminar creando una
  segunda. Lo que si funciona:
  1. Si el dry-run dice "adoptar existente", la tarea ya esta vinculada: abrila
     y verificala, no crees nada.
  2. Si dice "crear desde plantilla", buscá en la pagina del curso una tarea
     con el **nombre exacto** que imprimio el dry-run. El nombre lleva
     institucion, orientacion y mes/año, asi que es unico. Si aparece, abrila
     y comproba su `Número ID`: si coincide, adoptala en vez de crear otra.
     Ese es el caso de una corrida anterior que creo la tarea y se corto antes
     de confirmar.
- **Si aparecen dos tareas con el mismo nombre o `Número ID`, frená** y avisale a Blas. No elijas una.
- **Acceso al Campus.** Usá Claude in Chrome (no el Claude Browser): ahí el navegador de Blas autocompleta usuario y contraseña. Si la pantalla de acceso ya viene con los campos llenos, apretá **Acceder** y seguí. Si están **vacíos** incluso en Chrome, no los completes: frená y pedile a Blas que entre.
- **No toques las tareas del modelo viejo** (las compartidas entre varios lanzamientos). El dry-run nunca te las va a proponer; si igual te tienta una, no es tu trabajo.
- Ante una duda real, frená y decí exactamente qué te falta.

- **Una confirmacion rechazada NO se reintenta sola.** La intencion queda en
  `needs_attention`, y el worker solo puede reclamar `pending` o `error`. El
  dry-run las lista aparte bajo "ATENCION": si ves alguna, no la ignores y no
  intentes crear la tarea de nuevo. Contale a Blas cual es y por que fallo; se
  reabre a mano con `request_moodle_task_reconcile_v1(<intentId>)`.

## Al terminar

Contale a Blas qué tareas creaste, con qué `cmid` quedaron, y cualquier cosa que no cerró. Si algo quedó a medias, dejá claro en qué punto se cortó para que se pueda retomar.
