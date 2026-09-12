# Pendientes de integridad de PPS

Fecha: 11/09/2026. Base de la revisión: commit `37b5c97` y verificaciones de la
conversación. Este documento planifica trabajo; no aplica migraciones, despliega
la aplicación ni crea automatizaciones. Antes de ejecutar, actualizar el estado
del repositorio y de la base para evitar repetir cambios de otros colaboradores.

## Lo que ya está cerrado en la revisión

- Eliminación del identificador ficticio y reparación puntual del Ministerio.
- Corrección de paginación del cliente Python, con pruebas.
- Resoluciones por RPC con atomicidad, control de estado, idempotencia,
  conflicto de decisiones y trazabilidad básica; protección de UPDATE directo
  y del INSERT con campos de resolución falsificados.
- FK nullable mediante `institucion_uuid`, sincronización compatible y CHECK
  validado que exige coherencia con la columna anterior.
- Migración de los lectores identificados a la columna nueva.
- Consulta del formulario sin la columna inexistente; horas editables,
  referencia institucional explícita, espera de carga y respeto a la edición.
- Tres pruebas del formulario revisadas y ejecutadas: pasan.

Esto no certifica despliegue, recorrido completo en navegador, concurrencia real
ni todos los objetivos del plan original. Las pruebas por mutación fueron
informadas por la otra IA; esta revisión no las repitió.

## 1. Cerrar la entrega actual — prioridad inmediata

Estado más reciente (`bad3f06`, corrida `f90ad170`): los siete escenarios ya
pasan, incluido rechazo con `45001` ante horas vistas obsoletas y confirmación
con el valor actualizado. El parámetro sigue siendo opcional por compatibilidad;
queda migrar consumidores antiguos y verificar el panel en navegador antes de
dar por cerrado ese contrato para todos los clientes.

Actualización de ejecución local: el arnés ya corrió y los seis escenarios
asertivos pasaron después de preparar una corrección de la RPC de baja. El
séptimo demostró competencia entre solicitudes distintas y queda como decisión
de contrato. Ver [evidencia y ejecución local](pps-concurrency-local.md).
La corrección equivalente de baja `20260911232920` fue desplegada por otra
sesión y se verificó su presencia mediante lectura; se retiró el parche local
duplicado. El recorrido en navegador continúa pendiente.

### 1A. Verificación del formulario y despliegue

Responsable de ejecución: desarrollo. Validación académica: coordinación.

- Identificar el commit que está efectivamente publicado y conservar la versión
  anterior para una reversión compatible con la base.
- Probar en un entorno de prueba el formulario completo con un estudiante:
  institución con varias convocatorias, carga lenta, edición antes y después
  del autocompletado, cambio de institución, institución sin referencia,
  error de consulta y cierre/reapertura del modal.
- Enviar una solicitud con horas mayores que la referencia y verificar que
  llega pendiente con el valor solicitado. Aprobar con otro valor y comprobar
  que la práctica recibe las horas decididas por coordinación.
- Si falla la consulta, comprobar que la pantalla comunica el problema y no
  presenta la ausencia de datos como una referencia académica válida.
- Mantener los controles existentes de tipos, tests, lint y build. Desplegar
  el frontend compatible y realizar una comprobación de lectura en producción.
  Las solicitudes sintéticas y sus resoluciones se ensayan fuera de producción.

Cierre: evidencia del recorrido completo, commit publicado identificado y
valores solicitado/aprobado conservados correctamente. Corregir únicamente los
fallos que impidan ese contrato; no abrir un rediseño visual en esta entrega.

### 1B. Concurrencia reproducible entre dos conexiones

- Usar Postgres de prueba con esquema y permisos equivalentes; fixtures
  sintéticos independientes de solicitudes pendientes reales.
- Ejecutar las operaciones con rol `authenticated` e identidades de prueba.
  Coordinar ambas conexiones para garantizar solapamiento, con tiempos límite.
- Cubrir: dos aprobaciones idénticas; aprobaciones diferentes; aprobación contra
  rechazo; dos rechazos; y resolución de bajas concurrente.
- Verificar: una sola práctica por solicitud nueva, una decisión final,
  trazabilidad consistente, reintento idéntico según contrato y conflicto
  explícito para decisiones incompatibles. Ninguna práctica residual ni
  acreditación duplicada después de un fallo.
- Separar el caso de dos solicitudes distintas que modifican la misma práctica:
  definir si la segunda debe detectar una versión obsoleta antes de implementar
  ese control. No confundirlo con la idempotencia de una misma solicitud.

Cierre: script o suite versionada que fuerza la competencia y verifica los
resultados. Dos llamadas consecutivas no demuestran concurrencia.

## 2. Completar la transición de institución — después del despliegue

- Inventariar referencias restantes a la columna de lanzamientos en frontend,
  funciones SQL, vistas, triggers, scripts y automatizaciones. No reemplazar
  `institucion_id` de otras tablas por coincidencia de nombre.
- Establecer un mecanismo verificable de actualización del cliente, incluyendo
  pestañas abiertas y caché/PWA si corresponde. El tiempo transcurrido desde el
  despliegue no demuestra que todos los clientes se hayan actualizado.
- Si no se puede asegurar esa actualización, conservar la compatibilidad y
  documentar cuándo se revisará su retirada. Mantenerla no bloquea la entrega 1.
- Ensayar la retirada del CHECK de convivencia, trigger y columna vieja en
  una copia de prueba. Conservar la FK nueva. Evitar DROP CASCADE indiscriminado.
- Preparar reversión: recrear y rellenar la columna compatible desde el UUID y
  restaurar sincronización antes de volver a servir un frontend que la necesite.
- Aplicar la migración cuando se cumplan las condiciones; regenerar tipos con
  `npm run gen-types`, ejecutar `npm run type-check` y comprobar consumidores.

Cierre: columna nueva como única referencia, dependencias resueltas y ausencia
de errores por clientes antiguos. No forzar este cierre por estética del esquema.

## 3. Completar el contrato académico — siguiente entrega funcional

- Conservar tres conceptos separados: horas solicitadas, referencia consultada
  y horas aprobadas. Las horas sugeridas siguen siendo editables.
- Permitir identificar la convocatoria realizada cuando exista; si hay varias
  candidatas, pedir selección/verificación. Mantener una procedencia externa
  legítima sin inventar una convocatoria ni elegir automáticamente la última.
- Incorporar un vínculo nullable en la solicitud si sigue faltando, con FK y
  verificación de institución, orientación y pertinencia al resolver. Preservar
  el vínculo verificado en la práctica resultante.
- Mostrar a coordinación pedido, referencia, diferencia, fechas y documentos.
  Guardar la referencia utilizada como evidencia histórica de la decisión,
  junto con actor, fecha y motivo de excepción. No recalcular decisiones viejas
  cuando cambie una convocatoria.
- Confirmar con coordinación las reglas de referencia por orientación y cohorte
  antes de codificarlas; no deducirlas de nombres o coincidencias numéricas.
- Hacer que panel y automatización consuman la misma validación del backend.
  Una diferencia de horas requiere revisión del respaldo; no implica fraude
  ni autoriza una corrección automática.
- Verificar también la regla pendiente del plan original: una nueva publicación,
  reapertura o activación institucional no debe eludir la institución válida
  mediante API. Diseñar excepciones para borradores e históricos explícitos.

Cierre: una solicitud ambigua permanece identificada como tal; cada aprobación
puede explicar qué se pidió, qué referencia se usó y por qué se acreditó ese valor.

## 4. Reconciliar históricos — sin frenar las protecciones nuevas

- Actualizar el inventario de ausencias y discrepancias mediante lectura actual.
  Los 88 NULL del diagnóstico inicial son una referencia histórica, no un conteo
  vigente garantizado. No repetir la reparación del Ministerio ya realizada.
- Priorizar casos operativos pendientes, incluidos los de Fundación Tiempo si
  siguen sin resolver, y después las cohortes históricas relevantes.
- Preparar una propuesta por registro: valor anterior, vínculo propuesto,
  evidencia y ambigüedades. Aplicar sólo correspondencias respaldadas, con
  actualización condicionada al valor previo y registro de la reparación.
- Preservar IDs, horas, notas y estados. Revisar efectos sobre Moodle antes de
  cambiar vínculos; no adoptar ni reconfigurar tareas históricas por esta limpieza.
- Clasificar toda ausencia restante; no imponer NOT NULL global a borradores
  o procedencias que legítimamente no necesitan lanzamiento.

Cierre: registros reparados reconciliados y ausencias restantes documentadas.
Las decisiones de identidad ambiguas quedan a coordinación.

## 5. Evitar regresiones — trabajo de mantenimiento

- Integrar en CI las pruebas de permisos, atomicidad, concurrencia, FK y
  contratos de consultas contra un Postgres de prueba reconstruible. El control
  de nombres de migraciones no sustituye reconstruir el esquema.
- Versionar los ensayos de convivencia de columnas mientras exista la transición.
  Mantener pruebas de paginación con más de 1000 filas y fallo intermedio.
- Consolidar un diagnóstico de sólo lectura para detectar relaciones inválidas,
  resoluciones sin efecto académico y excepciones nuevas. Diseñar alertas sobre
  cambios accionables; configurar su frecuencia y destinatario al implementarlo.
- Documentar escritores autorizados, despliegue, restauración y reparación.
  Ensayar recuperación de base en entorno aislado y registrar el resultado.
- Si las resoluciones disparan correos, verificar su acoplamiento antes de
  proponer una cola transaccional: un reintento de correo no debe acreditar otra vez.
- Proponer a coordinación la FAQ sobre horas de referencia, horas solicitadas
  y decisión final. Según AGENTS.md, no agregar contenido sin aprobación previa.

Cierre: fallos críticos detectables por pruebas o diagnóstico, con responsable
y procedimiento de recuperación; no depender de revisiones ocasionales de IA.

## Secuencia y límites

Primero 1A y 1B. Luego retirar compatibilidad sólo si se cumple la condición de
clientes de la entrega 2. La entrega 3 puede avanzar sin esperar ese retiro;
la 4 se aborda por lotes. Las pruebas de la 5 acompañan cada entrega.

No se requiere reescribir la aplicación ni cambiar el stack. El cierre inmediato
es la entrega actual funcionando y la concurrencia demostrada; el cierre del
plan completo incluye trazabilidad académica, históricos clasificados y controles
repetibles. Ninguno equivale a prometer ausencia absoluta de futuros errores.
