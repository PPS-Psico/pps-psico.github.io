# Requisitos — Mejoras de UX para la bandeja "Hoy" de Gestión

## Introducción

La bandeja unificada "Hoy con Hermes" (vista de Gestión) muestra todo lo accionable del
día: correos a responder, solicitudes a gestionar y el ciclo de vida de las instituciones.
Hoy el coordinador puede **abrir** cada acción, pero no tiene forma rápida de **sacar del
camino** lo que no corresponde, ni de **enseñarle a Hermes** cuando algo se coló mal en el
plan o en la bandeja de correos.

El filtrado de correos hoy es estático (una heurística de listas fijas `_es_correo_pps` en
el backend). Esta feature agrega un lazo de feedback: cuando el coordinador marca algo como
irrelevante, Hermes lo registra y lo usa para afinar el filtro con el tiempo (mismo
mecanismo que `aprendizajes.md`), de modo que el filtro deje de ser estático.

Esta feature cubre cinco mejoras de UX, todas dentro de la pestaña "Hoy" y el panel de
correo, manteniendo el modo sombra de Hermes (solo propone / registra; el envío de mensajes
sigue siendo manual).

### Glosario

- **Acción del día**: tarjeta de la bandeja "Hoy". Puede ser de tipo correo
  (`responder_mail`), solicitud (`mover_solicitud`), egreso (`verificar_finalizacion`) o
  institución (ciclo de vida derivado de lanzamientos).
- **Descartar**: sacar una acción de la lista de hoy sin tocar el dato de origen (no
  archiva el correo ni cambia el estado de la solicitud).
- **Archivar correo**: acción de Gmail (vía Hermes/n8n) que saca el hilo de la bandeja
  activa. Ya existe en el backend (`modifyThread`).
- **Irrelevante / "No es PPS"**: marca que indica que ese elemento no pertenece al dominio
  PPS. Se registra como feedback para que Hermes mejore su filtro.

---

## Requisito 1 — Descartar una acción del día (con deshacer)

**Historia de usuario:** Como coordinador, quiero descartar rápidamente una acción de la
bandeja "Hoy" que no voy a hacer hoy, sin que eso modifique el correo o la solicitud de
origen, para limpiar mi vista del día y enfocarme en lo que importa.

### Criterios de aceptación

1. CUANDO el coordinador pulsa "Descartar" en una tarjeta de la bandeja "Hoy", ENTONCES el
   sistema DEBE quitar esa tarjeta de la lista visible de inmediato (optimista).
2. CUANDO una acción proviene del plan de Hermes (`agent_suggestions` tipo `accion_dia`),
   ENTONCES descartarla DEBE marcar esa suggestion con estado `discarded` en la base.
3. CUANDO una acción proviene del ciclo de vida de instituciones (derivada de lanzamientos,
   sin fila propia en `agent_suggestions`), ENTONCES el descarte DEBE persistirse de forma
   que esa tarjeta no reaparezca el resto del día, sin alterar el lanzamiento.
4. CUANDO el coordinador descarta una acción, ENTONCES el sistema DEBE mostrar un aviso
   temporal con la opción "Deshacer" durante al menos 5 segundos.
5. CUANDO el coordinador pulsa "Deshacer" dentro de la ventana del aviso, ENTONCES el
   sistema DEBE restaurar la acción a la lista y revertir el cambio de estado en la base.
6. CUANDO descartar falla (error de red o de base), ENTONCES el sistema DEBE volver a
   mostrar la tarjeta y avisar que no se pudo descartar.
7. CUANDO el coordinador descarta una acción, ENTONCES el descarte NO DEBE archivar el
   correo, ni cambiar el estado de la solicitud, ni el estado de gestión de la institución.

---

## Requisito 2 — "No es PPS / Archivar" en correos

**Historia de usuario:** Como coordinador, quiero archivar de un toque un correo que no
tiene nada que ver con PPS desde la bandeja "Hoy" y desde el panel del correo, para sacarlo
de mi camino sin abrir Gmail.

### Criterios de aceptación

1. CUANDO una tarjeta de la bandeja "Hoy" es de tipo correo (`responder_mail`), ENTONCES el
   sistema DEBE ofrecer una acción rápida "No es PPS / Archivar" además de "Responder".
2. CUANDO el coordinador pulsa "No es PPS / Archivar" en un correo, ENTONCES el sistema DEBE
   archivar el hilo (vía `modifyThread` → Hermes/n8n) y quitar la tarjeta de la lista.
3. CUANDO el kill-switch de Gmail está activo o el webhook no está configurado, ENTONCES la
   acción DEBE degradar de forma segura (dry-run) y avisar que no se archivó realmente, sin
   romper la UI.
4. CUANDO el archivado se ejecuta correctamente, ENTONCES el hilo NO DEBE volver a aparecer
   en los filtros activos de la bandeja de correos.
5. CUANDO el coordinador archiva un correo desde "Hoy", ENTONCES el sistema DEBE ofrecer
   marcar además ese correo como "irrelevante" para enseñar a Hermes (ver Requisito 3), sin
   obligarlo a hacerlo.
6. CUANDO el archivado falla, ENTONCES el sistema DEBE mantener la tarjeta visible y avisar
   del error.

---

## Requisito 3 — Marcar como irrelevante que enseña a Hermes

**Historia de usuario:** Como coordinador, quiero indicarle a Hermes que un correo o una
sugerencia no tiene nada que ver con PPS, para que el agente aprenda y deje de proponer cosas
parecidas, de modo que el filtro mejore con el tiempo en vez de ser estático.

### Criterios de aceptación

1. CUANDO el coordinador marca un elemento como "irrelevante / No es PPS", ENTONCES el
   sistema DEBE registrar ese feedback en el backend de Hermes (no solo en el frontend).
2. CUANDO se registra un feedback de irrelevancia, ENTONCES Hermes DEBE persistir la señal
   (remitente/dominio, asunto y/o patrón) de modo que pueda usarla para afinar el filtro
   `_es_correo_pps` en corridas futuras.
3. CUANDO Hermes arma el plan del día o genera borradores, ENTONCES DEBE consultar las
   señales de irrelevancia acumuladas y excluir (o despriorizar) lo que coincida.
4. CUANDO el coordinador marca un remitente/dominio como irrelevante, ENTONCES futuros
   correos del mismo remitente NO DEBEN entrar al plan del día por defecto.
5. CUANDO el registro de feedback falla, ENTONCES la acción de UI (archivar/descartar) DEBE
   completarse igual y el sistema DEBE avisar que el aprendizaje no se guardó, sin bloquear.
6. CUANDO el coordinador marca algo como irrelevante por error, ENTONCES DEBE poder
   deshacerlo dentro de la misma ventana de "Deshacer" del descarte/archivado.
7. CUANDO Hermes registra el feedback, ENTONCES NO DEBE eliminar datos de origen (el correo
   sigue en Gmail; el aprendizaje es aditivo y reversible a nivel de señal).

---

## Requisito 4 — Buscar y filtrar dentro de "Hoy"

**Historia de usuario:** Como coordinador, quiero buscar por texto y filtrar por tipo dentro
de la bandeja "Hoy", para encontrar rápido una acción puntual cuando la lista es larga.

### Criterios de aceptación

1. CUANDO la bandeja "Hoy" tiene acciones, ENTONCES el sistema DEBE ofrecer filtros por tipo:
   Todo, Correos, Solicitudes, Instituciones (y Egresos si los hay).
2. CUANDO el coordinador selecciona un filtro de tipo, ENTONCES la lista DEBE mostrar solo
   las acciones de ese tipo y el conteo DEBE reflejar lo filtrado.
3. CUANDO el coordinador escribe en el buscador de "Hoy", ENTONCES la lista DEBE filtrarse
   por coincidencia de texto en el título y el motivo de cada acción (sin distinción de
   mayúsculas/acentos).
4. CUANDO un filtro o búsqueda no arroja resultados, ENTONCES el sistema DEBE mostrar un
   estado vacío claro que invite a limpiar el filtro.
5. CUANDO el coordinador limpia el buscador y los filtros, ENTONCES la lista DEBE volver al
   orden priorizado completo.
6. CUANDO se aplica un filtro o búsqueda, ENTONCES NO DEBE alterar el orden de prioridad
   relativo de las acciones visibles.

---

## Requisito 5 — Acciones en lote

**Historia de usuario:** Como coordinador, quiero seleccionar varias acciones a la vez y
descartarlas o archivarlas juntas, para limpiar la bandeja de forma eficiente cuando hay
mucho ruido acumulado.

### Criterios de aceptación

1. CUANDO el coordinador activa el modo selección en "Hoy", ENTONCES cada tarjeta DEBE
   mostrar un control de selección (checkbox).
2. CUANDO hay una o más tarjetas seleccionadas, ENTONCES el sistema DEBE mostrar una barra de
   acciones en lote con la cantidad seleccionada y las acciones disponibles (Descartar y, si
   todas son correos, Archivar).
3. CUANDO el coordinador ejecuta "Descartar" en lote, ENTONCES el sistema DEBE descartar
   todas las acciones seleccionadas aplicando la lógica del Requisito 1 a cada una.
4. CUANDO el coordinador ejecuta "Archivar" en lote sobre correos, ENTONCES el sistema DEBE
   archivar cada hilo aplicando la lógica del Requisito 2.
5. CUANDO una acción en lote termina, ENTONCES el sistema DEBE ofrecer "Deshacer" para
   revertir el conjunto completo dentro de la ventana temporal.
6. CUANDO parte de un lote falla, ENTONCES el sistema DEBE informar cuántas se procesaron y
   cuántas fallaron, y dejar visibles las que fallaron.
7. CUANDO el coordinador sale del modo selección, ENTONCES la selección DEBE limpiarse.

---

## Fuera de alcance (esta iteración)

- Envío automático de correos o WhatsApp (sigue siendo manual, modo sombra).
- Reglas de filtro editables a mano por el coordinador (lo maneja Hermes vía aprendizaje).
- Cambios en las pestañas Seguimiento, Instituciones, Calendario o Contactos.
- Reentrenamiento del modelo LLM (el aprendizaje es por señales/contexto, no fine-tuning).

## Notas técnicas (contexto, no requisitos)

- El estado `discarded` ya existe en el CHECK de `agent_suggestions.estado`.
- `modifyThread(threadId, "archive")` ya está implementado en `gmailService`.
- El backend ya tiene `learn_from_feedback` y `_es_correo_pps`; el aprendizaje de
  irrelevancia debería apoyarse en estos mecanismos existentes.
- Las acciones de ciclo de vida (instituciones) no tienen fila en `agent_suggestions`, así
  que su "descarte" necesita una estrategia de persistencia propia (a definir en diseño).
