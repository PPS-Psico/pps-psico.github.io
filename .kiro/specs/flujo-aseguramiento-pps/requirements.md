# Requirements Document

## Introduction

Esta funcionalidad define cómo el panel de coordinación de PPS (UFLO) detecta que el **flujo de aseguramiento** de una convocatoria/lanzamiento ya se gestionó, para sacarla de la categoría "A asegurar" del sidebar del Lanzador y avanzarla a la categoría siguiente.

Hoy la categoría "A asegurar" (bucket `asegurar`) se calcula en tiempo de ejecución en `LanzadorView.tsx`: un lanzamiento cae en `asegurar` cuando tiene estudiantes seleccionados (`totalSel > 0`) y su estado de base (`estado_convocatoria`) todavía no es `Activa` ni `Archivada`. Como no existe ninguna marca persistente de "seguro gestionado", el lanzamiento **nunca sale** de "A asegurar" hasta que su `estado_convocatoria` pasa a `Activa` por otra vía. El `Generador de seguros` (`SeguroGenerator.tsx`) ejecuta sus pasos (descargar plantilla, copiar datos, abrir correo a administración, descargar listado) de forma totalmente local: nada de eso queda registrado.

El alcance de este spec es el **comportamiento y las reglas de negocio** del flujo de aseguramiento, el **modelo de datos mínimo** necesario para persistir la completitud, y el **rediseño del Generador_De_Seguros** en el sistema visual "Paper & Ink" v3 (incluyendo entrar directo desde la PPS, sin el paso de "seleccionar convocatoria").

> **Nota:** Las decisiones de negocio ya fueron confirmadas por el usuario y están marcadas como **[DECIDIDO POR EL USUARIO]**. Quedan un par de bloques **[DECISIÓN PENDIENTE]** de menor impacto (persistencia del detalle de pasos parciales y tabla de auditoría completa), que se tratan como mejoras opcionales no bloqueantes.

## Glossary

- **Lanzador**: Vista de coordinación (`LanzadorView.tsx`) que organiza los lanzamientos de PPS en categorías operativas (buckets) dentro de un sidebar.
- **Lanzamiento**: Registro de la tabla `lanzamientos_pps` que representa una convocatoria de PPS publicada por la coordinación. Es la unidad sobre la que operan los buckets del Lanzador.
- **Convocatoria**: Registro de la tabla `convocatorias` que vincula un estudiante a un Lanzamiento mediante `lanzamiento_id` y `estudiante_id`, con un `estado_inscripcion` (por ejemplo `seleccionado`).
- **Estudiante_Seleccionado**: Estudiante cuya Convocatoria para un Lanzamiento tiene `estado_inscripcion = "seleccionado"`.
- **Bucket**: Categoría operativa del sidebar del Lanzador. Valores definidos: `borrador`, `abierta`, `seleccionar`, `asegurar`, `activa`, `archivada`.
- **Bucket_A_Asegurar**: El bucket `asegurar`, etiquetado "A asegurar", que agrupa los Lanzamientos con Estudiantes_Seleccionados cuyo seguro todavía no fue gestionado.
- **Bucket_Activas**: El bucket `activa`, etiquetado "Activas", que agrupa los Lanzamientos cuyas prácticas ya están en curso.
- **Generador_De_Seguros**: Componente `SeguroGenerator.tsx` que asiste al Coordinador en los pasos del aseguramiento (descargar plantilla, copiar datos, enviar a administración, descargar listado).
- **Coordinador**: Usuario administrador que opera el panel de PPS y gestiona el aseguramiento.
- **Administración**: Área que recibe la planilla de seguro por correo (destinatario `mesadeayuda.patagonia@uflouniversidad.edu.ar`, referido informalmente como "Sergio").
- **Paso_De_Aseguramiento**: Cada una de las 4 acciones del flujo de aseguramiento, en este orden: (1) `plantilla_descargada` (descargar seguro), (2) `datos_copiados` (copiar datos), (3) `enviado_a_administracion` (enviar a Sergio), (4) `listado_descargado` (descargar lista para las instituciones).
- **Paso_Final**: El cuarto Paso_De_Aseguramiento, `listado_descargado` (descargar lista). Su ejecución es el disparador que cierra el aseguramiento.
- **Aseguramiento_Completado**: Condición que el Sistema reconoce como "el seguro de este Lanzamiento ya se gestionó". Se alcanza cuando se ejecutan los 4 Pasos_De_Aseguramiento y, en particular, al completarse el Paso_Final (descargar lista).
- **Marca_De_Aseguramiento**: Dato persistente en la base que registra que un Lanzamiento alcanzó el estado Aseguramiento_Completado, incluyendo la marca temporal y el autor.
- **Seguro_Gestionado_At**: Campo de marca temporal (timestamp) propuesto para persistir el momento del Aseguramiento_Completado a nivel Lanzamiento.
- **Registro_De_Aseguramiento**: Registro de auditoría que documenta los Pasos_De_Aseguramiento ejecutados y la confirmación de completitud de un Lanzamiento.
- **Sistema**: El conjunto del panel de PPS (frontend React + backend Supabase) cuando no se requiere distinguir un componente específico.

## Requirements

### Requirement 1: Definición de "Aseguramiento Completado"

**User Story:** Como Coordinador, quiero que el Sistema reconozca cuándo el seguro de un Lanzamiento ya se gestionó, para que ese Lanzamiento deje de aparecer en "A asegurar".

> **[DECIDIDO POR EL USUARIO] El aseguramiento se cierra al completar el 4º paso (descargar lista).**
> El flujo tiene 4 Pasos_De_Aseguramiento en orden: (1) descargar seguro/plantilla, (2) copiar datos, (3) enviar a Sergio (administración), (4) descargar lista para las instituciones. Cuando el Coordinador ejecuta el Paso_Final (descargar lista), el Sistema considera el Lanzamiento como Aseguramiento_Completado y lo saca del Bucket_A_Asegurar. No se requiere una acción de confirmación adicional separada: completar el paso 4 ES la confirmación.

#### Acceptance Criteria

1. WHEN el Coordinador ejecuta el Paso_Final (descargar lista) de un Lanzamiento, THE Sistema SHALL registrar ese Lanzamiento como Aseguramiento_Completado.
2. THE Sistema SHALL habilitar el Paso_Final (descargar lista) únicamente cuando el Lanzamiento tiene al menos un Estudiante_Seleccionado.
3. WHILE un Lanzamiento tiene cero Estudiantes_Seleccionados, THE Sistema SHALL mantener deshabilitado el flujo de aseguramiento.
4. WHEN el Sistema registra un Lanzamiento como Aseguramiento_Completado, THE Sistema SHALL guardar la marca temporal del momento y el identificador del Coordinador que ejecutó el Paso_Final.
5. IF el registro del Aseguramiento_Completado falla al persistirse en la base, THEN THE Sistema SHALL informar el error al Coordinador y conservar el Lanzamiento en el Bucket_A_Asegurar.

### Requirement 2: Nivel de granularidad del estado de aseguramiento

**User Story:** Como Coordinador, quiero que el estado "asegurado" se administre a la misma granularidad que la categoría "A asegurar", para que la lógica del sidebar sea consistente.

> **[DECIDIDO POR EL USUARIO] Granularidad por Lanzamiento.** El Bucket_A_Asegurar opera por Lanzamiento y el seguro se gestiona por convocatoria/institución como una unidad.

#### Acceptance Criteria

1. THE Sistema SHALL administrar la Marca_De_Aseguramiento a nivel Lanzamiento.
2. WHEN se evalúa si un Lanzamiento pertenece al Bucket_A_Asegurar, THE Lanzador SHALL usar la Marca_De_Aseguramiento del Lanzamiento como único determinante de la completitud del aseguramiento.
3. WHERE un Lanzamiento incorpora o da de baja Estudiantes_Seleccionados después de haber sido marcado como Aseguramiento_Completado, THE Sistema SHALL conservar la Marca_De_Aseguramiento existente del Lanzamiento.

> **[DECIDIDO POR EL USUARIO] (relacionado con 2.3)** No se genera un seguro nuevo cuando cambian los alumnos. Si un alumno se da de baja, el Coordinador edita la lista de alumnos pero **siempre se conserva el primer seguro generado**: la Marca_De_Aseguramiento persiste y el Lanzamiento NO vuelve a "A asegurar" de forma automática.

### Requirement 3: Persistencia del estado de aseguramiento

**User Story:** Como Coordinador, quiero que la marca de "seguro gestionado" quede guardada de forma persistente, para que el Lanzamiento no reaparezca en "A asegurar" al recargar el panel.

> **[DECIDIDO POR EL USUARIO] Opción (A): campos en `lanzamientos_pps`.** Se agrega `seguro_gestionado_at` (timestamp, nullable: NULL = no asegurado, fecha = asegurado) y `seguro_gestionado_por` (identificador del Coordinador). Es la opción más simple y robusta, alineada con campos existentes como `plantilla_seguro_url` y `estado_gestion`. La tabla de auditoría detallada queda como mejora futura (Requirement 8), no como requisito mínimo.

#### Acceptance Criteria

1. WHEN el Coordinador confirma la gestión del seguro, THE Sistema SHALL persistir el campo Seguro_Gestionado_At del Lanzamiento con la fecha y hora de la confirmación.
2. WHILE el campo Seguro_Gestionado_At de un Lanzamiento contiene una fecha, THE Lanzador SHALL excluir ese Lanzamiento del Bucket_A_Asegurar.
3. WHILE el campo Seguro_Gestionado_At de un Lanzamiento es nulo y el Lanzamiento tiene al menos un Estudiante_Seleccionado y su estado no es Activa ni Archivada, THE Lanzador SHALL incluir ese Lanzamiento en el Bucket_A_Asegurar.
4. WHEN el Coordinador recarga el Lanzador, THE Sistema SHALL determinar la pertenencia al Bucket_A_Asegurar a partir del valor persistido de Seguro_Gestionado_At.

### Requirement 4: Progreso de pasos parciales

**User Story:** Como Coordinador, quiero ver el avance de los 4 pasos del aseguramiento sin que el Lanzamiento desaparezca antes de tiempo, para no perder de vista las gestiones a medio terminar.

> **[DECIDIDO POR EL USUARIO]** Los Pasos_De_Aseguramiento 1 a 3 (descargar seguro, copiar datos, enviar a Sergio) se muestran como progreso y NO sacan al Lanzamiento del Bucket_A_Asegurar. Solo el Paso_Final (paso 4, descargar lista) cierra el aseguramiento (ver Requirement 1).
>
> **[DECISIÓN PENDIENTE] ¿El progreso de los pasos 1 a 3 debe persistirse (sobrevivir a recargas y a cambios de dispositivo) o alcanza con mostrarlo dentro de la sesión actual del Generador_De_Seguros?** El **[SUPUESTO]** mínimo es **mostrarlo en la sesión actual**; persistir el detalle de cada paso requeriría la tabla de auditoría de la opción (B) del Requirement 3.

#### Acceptance Criteria

1. WHILE el Coordinador completa los Pasos_De_Aseguramiento 1 a 3 sin haber ejecutado el Paso_Final, THE Lanzador SHALL mantener el Lanzamiento dentro del Bucket_A_Asegurar.
2. WHEN el Coordinador ejecuta un Paso_De_Aseguramiento, THE Generador_De_Seguros SHALL indicar visualmente qué pasos fueron ejecutados y cuáles quedan pendientes.
3. THE Generador_De_Seguros SHALL presentar los 4 pasos en orden (descargar seguro, copiar datos, enviar a Sergio, descargar lista), señalando el Paso_Final como el que cierra el aseguramiento.
4. IF el Coordinador intenta ejecutar el Paso_Final (descargar lista) sin haber ejecutado los pasos previos, THEN THE Generador_De_Seguros SHALL permitirlo igualmente, ya que descargar la lista cierra el flujo (los pasos previos son asistencia, no requisitos bloqueantes).

### Requirement 5: Reversión del estado de aseguramiento

**User Story:** Como Coordinador, quiero poder revertir la marca de "seguro gestionado" si la confirmé por error, para que el Lanzamiento vuelva a aparecer en "A asegurar".

> **[DECIDIDO POR EL USUARIO]** La reversión está permitida para el Coordinador (con confirmación) y devuelve el Lanzamiento al Bucket_A_Asegurar, siempre que siga teniendo Estudiantes_Seleccionados y no esté Archivado.

#### Acceptance Criteria

1. WHEN el Coordinador solicita revertir el aseguramiento de un Lanzamiento marcado como Aseguramiento_Completado, THE Sistema SHALL borrar el valor de Seguro_Gestionado_At de ese Lanzamiento.
2. WHEN el Sistema borra el valor de Seguro_Gestionado_At de un Lanzamiento con al menos un Estudiante_Seleccionado y estado distinto de Activa y Archivada, THE Lanzador SHALL volver a incluir ese Lanzamiento en el Bucket_A_Asegurar.
3. WHEN el Coordinador solicita revertir el aseguramiento, THE Sistema SHALL pedir una confirmación explícita antes de borrar la Marca_De_Aseguramiento.
4. WHEN el Sistema ejecuta una reversión de aseguramiento, THE Sistema SHALL registrar la marca temporal y el identificador del Coordinador que la realizó.

> **[DECIDIDO POR EL USUARIO] (relacionado con 5.2)** Como un Lanzamiento asegurado pasa a "Activas" (Requirement 6), revertir el aseguramiento lo devuelve desde "Activas" a "A asegurar" (borrando `seguro_gestionado_at`). La reversión es la única vía para que vuelva a "A asegurar".

### Requirement 6: Destino del Lanzamiento tras el aseguramiento

**User Story:** Como Coordinador, quiero que un Lanzamiento asegurado pase a la categoría siguiente del flujo, para que la lista "A asegurar" muestre solo lo que falta gestionar.

> **[DECIDIDO POR EL USUARIO] El Lanzamiento pasa a "Activas" al completar el aseguramiento (paso 4).** Gestionado el seguro y aceptados los consentimientos, las prácticas pueden arrancar. En "Activas" el Coordinador puede editar la lista de alumnos (por ejemplo, dar de baja a alguno) sin regenerar el seguro.
>
> **[DECIDIDO POR EL USUARIO] (modelo de datos)** La transición a "Activa" se **deriva en el Lanzador** a partir de `seguro_gestionado_at` (si tiene fecha → bucket `activa`), sin tocar `estado_convocatoria`, para no acoplar el aseguramiento con otras automatizaciones que dependen de `estado_convocatoria`.

#### Acceptance Criteria

1. WHEN un Lanzamiento queda marcado como Aseguramiento_Completado, THE Lanzador SHALL clasificar ese Lanzamiento en el Bucket_Activas.
2. THE Lanzador SHALL asignar cada Lanzamiento a exactamente un Bucket en un momento dado.
3. WHILE un Lanzamiento está marcado como Aseguramiento_Completado y no está Archivado, THE Lanzador SHALL clasificarlo en el Bucket_Activas en lugar del Bucket_A_Asegurar.
4. WHEN un Lanzamiento marcado como Aseguramiento_Completado se Archiva, THE Lanzador SHALL clasificarlo en el Bucket_Archivadas.

### Requirement 7: Visibilidad del estado de aseguramiento

**User Story:** Como Coordinador, quiero ver claramente si el seguro de un Lanzamiento ya se gestionó y cuándo, para confiar en la información del panel sin revisar el correo.

#### Acceptance Criteria

1. WHILE un Lanzamiento está marcado como Aseguramiento_Completado, THE Lanzador SHALL mostrar un indicador de "seguro gestionado" junto a ese Lanzamiento.
2. WHEN el Coordinador abre un Lanzamiento marcado como Aseguramiento_Completado, THE Sistema SHALL mostrar la fecha de gestión registrada en Seguro_Gestionado_At.
3. WHILE un Lanzamiento pertenece al Bucket_A_Asegurar, THE Lanzador SHALL mostrar el estado de avance del consentimiento digital de los Estudiantes_Seleccionados.

### Requirement 8: Trazabilidad de la gestión de seguros (opcional)

**User Story:** Como Coordinador, quiero un registro de cuándo y quién gestionó cada seguro, para auditar el flujo y resolver dudas posteriores.

> **[DECISIÓN PENDIENTE]** Este requisito depende de adoptar la opción (B) del Requirement 3 (tabla de auditoría `aseguramiento_pps`). Si se adopta solo la opción (A) (campos en `lanzamientos_pps`), la trazabilidad se limita a la última confirmación/reversión. **[SUPUESTO]** Para la versión mínima, alcanza con registrar `seguro_gestionado_at` y `seguro_gestionado_por`; la tabla de auditoría completa queda como mejora futura.

#### Acceptance Criteria

1. WHEN el Coordinador confirma o revierte el aseguramiento de un Lanzamiento, THE Sistema SHALL conservar la marca temporal y el identificador del Coordinador asociados a la acción más reciente.
2. WHERE está habilitada la tabla de auditoría de aseguramiento, THE Sistema SHALL registrar cada Paso_De_Aseguramiento ejecutado con su marca temporal.
3. WHERE está habilitada la tabla de auditoría de aseguramiento, THE Sistema SHALL conservar el historial de confirmaciones y reversiones de cada Lanzamiento.

### Requirement 9: Generador de seguros rediseñado, accedido desde la PPS

**User Story:** Como Coordinador, quiero entrar al generador de seguros directamente desde la PPS que estoy mirando y seguir 4 pasos claros, sin tener que volver a elegir la convocatoria de una lista.

> **[DECIDIDO POR EL USUARIO] Se rediseña el Generador_De_Seguros desde cero (Paper & Ink v3) y se elimina el paso de "Seleccionar convocatorias".** Como se accede desde el estado "A asegurar" de una PPS puntual, el Lanzamiento (institución + fecha + alumnos seleccionados) ya está determinado por contexto. El generador arranca directo en los 4 pasos.

#### Acceptance Criteria

1. WHEN el Coordinador abre el Generador_De_Seguros desde un Lanzamiento del Bucket_A_Asegurar, THE Generador_De_Seguros SHALL precargar ese Lanzamiento (institución, fecha de inicio y Estudiantes_Seleccionados) sin pedir selección de convocatoria.
2. THE Generador_De_Seguros SHALL omitir el paso previo de "Seleccionar convocatorias" cuando se accede con un Lanzamiento ya determinado por contexto.
3. THE Generador_De_Seguros SHALL presentar los 4 Pasos_De_Aseguramiento en orden: (1) Descargar seguro, (2) Copiar datos, (3) Enviar a Sergio, (4) Descargar lista.
4. THE Generador_De_Seguros SHALL mostrar el encabezado con el nombre de la institución del Lanzamiento, la fecha y la cantidad de Estudiantes_Seleccionados.
5. WHEN el Coordinador ejecuta el Paso 1 (Descargar seguro), THE Generador_De_Seguros SHALL descargar la plantilla de seguro y marcar el paso como ejecutado.
6. WHEN el Coordinador ejecuta el Paso 2 (Copiar datos), THE Generador_De_Seguros SHALL copiar al portapapeles los datos de los Estudiantes_Seleccionados en el formato esperado por la planilla y marcar el paso como ejecutado.
7. WHEN el Coordinador ejecuta el Paso 3 (Enviar a Sergio), THE Generador_De_Seguros SHALL iniciar el envío a Administración y marcar el paso como ejecutado.
8. WHEN el Coordinador ejecuta el Paso 4 (Descargar lista), THE Generador_De_Seguros SHALL descargar el listado para las instituciones y disparar el registro de Aseguramiento_Completado (Requirement 1).
9. THE Generador_De_Seguros SHALL adherir al sistema visual "Paper & Ink" v3 (tokens, tipografía Hanken/JetBrains Mono, chips y dots de estado), sin estilos del diseño anterior.
10. WHERE el Lanzamiento ya está marcado como Aseguramiento_Completado, THE Generador_De_Seguros SHALL mostrar el estado "seguro gestionado" con su fecha y ofrecer la acción de reversión (Requirement 5) en lugar de repetir el flujo como pendiente.
