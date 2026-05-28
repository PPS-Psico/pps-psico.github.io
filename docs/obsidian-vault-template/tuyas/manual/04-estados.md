# 04 — Vocabulario de estados

> Cada estado tiene **un significado operativo** específico. Hermes los reconoce y
> los usa para priorizar / sugerir acciones.

## Estados de `solicitudes_pps.estado_seguimiento`

Vistos en datos reales 2026-05-27:

| Estado                 | Significado                                                  | Qué hace Hermes                                                         |
| ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `Pendiente`            | Solicitud recién creada por el alumno, sin tocar             | **ALERTA si >48hs sin acción** — entra al daily brief                   |
| `En proceso`           | Coordinador contactó institución, esperando respuesta        | Monitorea tiempos de respuesta                                          |
| `Realizada`            | Alumno fue asignado a una PPS                                | Caso cerrado positivo                                                   |
| `No se pudo concretar` | No hubo institución compatible                               | Caso cerrado negativo. Revisar si la institución pedida debería sumarse |
| `Archivada`            | Solicitud sin relevancia (alumno se fue, datos viejos, etc.) | Hermes ignora                                                           |

> TODO operador: agregar otros estados que uses + cuándo aplicarlos.

## Estados de `lanzamientos_pps.estado_gestion`

Vistos en datos reales:

| Estado                     | Significado                                           | Qué hace Hermes              |
| -------------------------- | ----------------------------------------------------- | ---------------------------- |
| `Activo`                   | PPS en curso, alumnos asistiendo                      | Seguimiento periódico        |
| `Relanzada`                | Próxima cohorte ya confirmada                         | Verifica que fechas estén ok |
| `Relanzamiento Confirmado` | Institución confirmó cupos siguiente cohorte          | Activar inscripciones        |
| `Esperando Respuesta`      | Coordinador escribió a institución, sin respuesta aún | **ALERTA si >5 días**        |
| `En Conversación`          | Charla activa con institución sobre próximos pasos    | Monitorea                    |
| `No se Relanza`            | Institución no continúa con UFLO esta vez             | Validar antes de archivar    |
| `Archivado`                | Fuera de gestión activa                               | Hermes ignora                |

## Estados de `lanzamientos_pps.estado_convocatoria`

> TODO operador: relevar valores reales. Los que vi en datos: `Oculto`, `Activa`,
> y probablemente más.

| Estado   | Significado                              |
| -------- | ---------------------------------------- |
| `Oculto` | No visible para alumnos en panel público |
| `Activa` | Inscripciones abiertas                   |
| TODO     | TODO                                     |

## Estados del Lanzador (prototipo página nueva)

| Estado         | Step | Acción             |
| -------------- | ---- | ------------------ |
| `borrador`     | 1    | Continuar editando |
| `abierta`      | 2    | Ver inscriptos     |
| `cerrada`      | 3    | Seleccionar        |
| `seleccionada` | 4    | Generar seguro     |
| `activa`       | 5    | Ver en gestión     |
| `archivada`    | 6    | Reabrir o duplicar |

## Estados de la bandeja de Gestión (prototipo página nueva)

Categorías derivadas (no son columnas — se calculan):

| Categoría            | Cómo se deriva                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `porContactar`       | Lanzamiento finalizado sin gestión posterior                                                      |
| `reinsistir`         | `Esperando Respuesta` con >5 días                                                                 |
| `esperandoRespuesta` | `Esperando Respuesta` con <5 días                                                                 |
| `pendienteDecision`  | Institución respondió, hay que definir (mapea a output `requiere_decision_humana=true` de Hermes) |
| `confirmada`         | `Relanzamiento Confirmado` o `Activa`                                                             |
| `porFinalizar`       | `Activa` con `fecha_finalizacion` ≤30 días                                                        |
| `faltaDato`          | Institución sin tutor/tel/mail                                                                    |
| `archivada`          | `estado_gestion='Archivado'`                                                                      |

## Estados de `gmail_hilos.estado`

| Estado                | Significado                        |
| --------------------- | ---------------------------------- |
| `nuevo`               | Recién ingresado, sin clasificar   |
| `respondido_por_nos`  | Vos mandaste el último mensaje     |
| `esperando_respuesta` | El otro mandó el último mensaje    |
| `cerrado`             | Conversación terminó positivamente |
| `archivado`           | Sin acción pendiente               |

## Estados de `agent_suggestions.estado`

| Estado      | Significado                      |
| ----------- | -------------------------------- |
| `pending`   | Esperando que el operador revise |
| `approved`  | Vos aprobaste tal cual           |
| `edited`    | Vos editaste antes de aprobar    |
| `discarded` | Vos descartaste                  |
| `expired`   | Pasó el `expires_at` sin acción  |
