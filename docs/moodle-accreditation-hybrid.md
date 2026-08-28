# Acreditación híbrida desde Moodle

Fecha: 27 de agosto de 2026

Estado: implementación en `shadow`; sin trámites automáticos ni avisos reales

## Objetivo

Eliminar la carga duplicada de informes y planillas cuando la entrega de Moodle
ya aporta evidencia suficiente, sin convertir una heurística en una afirmación
académica. El flujo manual continúa existiendo como respaldo y se reduce a las
PPS cuya planilla de asistencia no puede confirmarse con seguridad.

## Experiencia final

La transición nace cuando una observación nueva deja **todos** los informes
computables del estudiante en estado `calificado`.

La regla es fail-closed: `NULL`, `entregado`, `sin_entrega` y cualquier valor
distinto de `calificado` cuentan como informe pendiente. La agregación no puede
omitir estados nulos.

1. El panel felicita al estudiante por la aprobación de su último informe.
2. Si cumple horas, orientación, rotación y no tiene PPS activas:
   - documentación completa y segura: se inicia `finalizacion_pps`
     automáticamente;
   - documentación parcial o dudosa: se abre el formulario asistido y sólo se
     piden las planillas de las PPS inciertas.
3. Si todavía faltan requisitos académicos, el aviso lleva al detalle de esos
   requisitos y no crea un trámite.
4. El aviso se muestra una sola vez. El evento persiste para que el formulario
   asistido siga disponible aunque el estudiante lo cierre y vuelva más tarde.

Las PPS online requieren informe aprobado, pero nunca planilla de asistencia.

## Fuente de evidencia

El puente HTML de Moodle lee, dentro de cada tarea vinculada, los nombres
visibles en la fila o columna `Archivos enviados / File submissions`. Los
nombres son transitorios: la sesión estudiantil los lleva al Edge Function y
el barrido anual a un clasificador privado SQL; en ambos caminos se descartan
antes de persistir. Supabase conserva sólo:

- cantidad física y lógica de archivos;
- tipos/extensiones agregados;
- resultado de evidencia de asistencia;
- confianza y razones estructuradas;
- versión del clasificador.

El clasificador `submission-files/v1` colapsa copias obvias (`(1)`, `copia`,
misma base con otra extensión) para que dos versiones del informe no parezcan
dos documentos distintos.

### Decisión conservadora vigente

| Patrón observado                         | Evidencia                        | Confianza | Inicio automático con umbral `0.900` |
| ---------------------------------------- | -------------------------------- | --------: | ------------------------------------ |
| nombre explícito de asistencia/planilla  | `detected`                       |    `0.99` | sí                                   |
| informe/documento + conjunto de imágenes | `assumed`                        |    `0.92` | sí                                   |
| varias imágenes sin nombres útiles       | `assumed`                        |    `0.85` | no; formulario asistido              |
| varios archivos genéricos                | `assumed`                        |    `0.65` | no; formulario asistido              |
| un solo archivo o duplicados del informe | `single_file` / `duplicate_only` |      baja | no                                   |
| sólo archivos con aspecto de informe     | `needs_review`                   |    `0.25` | no                                   |
| PPS online                               | `not_required`                   |    `1.00` | sí                                   |

El umbral vive en `app_config.moodle_attendance_auto_threshold`. Subirlo reduce
automatizaciones; bajarlo exige una decisión operativa respaldada por el piloto.

## Persistencia e idempotencia

- `moodle_grade_observations` y `moodle_grade_snapshots` conservan la evidencia
  derivada, nunca los nombres.
- `private.accreditation_automation_evaluations` registra la predicción de cada
  disparador en modo sombra o activo.
- `accreditation_transition_events` contiene el aviso único del estudiante y
  las PPS que requieren planilla.
- La evaluación usa un advisory lock transaccional por estudiante.
- Un evento es único por estudiante y por observación disparadora.
- El origen de `finalizacion_pps` es `manual`, `moodle_assisted` o
  `moodle_automatic`.
- Triggers de base impiden que un cliente se autodeclare como Moodle: el modo
  asistido exige el evento calculado por servidor y valida cada planilla dudosa;
  el automático queda reservado al worker.

El formulario asistido guarda en `detalle_practicas` una referencia de evidencia
Moodle para documentos confirmados y URLs sólo para archivos realmente subidos
por el estudiante. Las columnas legacy agregan exclusivamente estos últimos,
por lo que no se generan objetos duplicados en Storage.

## Rollout

`app_config.accreditation_automation_mode` acepta:

- `off`: no evalúa;
- `shadow`: registra predicciones sin crear eventos ni trámites;
- `active`: habilita el flujo híbrido y el inicio automático.

La secuencia de release es obligatoria:

1. desplegar Edge Function y puente HTML con modo `shadow`;
2. reunir una muestra real de entregas presenciales y online;
3. revisar falsos positivos y falsos negativos contra las tareas de Moodle;
4. exigir cobertura suficiente de nombres/tipos observables y cero falsos
   positivos críticos en la muestra revisada;
5. probar el cartel, el formulario reducido y la bandeja admin con datos de
   prueba;
6. cambiar a `active` sólo por migración/operación explícita;
7. revisar diariamente la primera semana y volver a `shadow` ante cualquier
   discrepancia.

En `shadow` la función `get_moodle_submission_evidence_health_v1()` ofrece el
resumen agregado para coordinación. Las evaluaciones pueden agruparse por
`predicted_outcome` sin leer nombres ni archivos.

## Fallos y fallback

- Si la lectura de archivos no está disponible, la evidencia queda incierta y
  se conserva el flujo manual.
- Un error al evaluar acreditación nunca revierte la nota ni falla la
  sincronización de Moodle.
- Si la evidencia cambia, una observación nueva vuelve a evaluar el caso de
  forma idempotente.
- Desactivar automatización no elimina snapshots, auditoría ni trámites ya
  creados.
- Nunca se borra ni reconfigura una tarea histórica `legacy_shared`.

## Evidencia técnica

- Clasificador: `src/domain/moodle/moodleSubmissionEvidence.ts`.
- Puente: `docs/moodle-label-inicio-bridge.html`.
- Ingesta: `supabase/functions/ingest-moodle-grade-observation/index.ts`.
- Schema de evidencia:
  `supabase/migrations/20260827200000_add_moodle_submission_evidence.sql`.
- Transición híbrida:
  `supabase/migrations/20260827201000_create_hybrid_accreditation_transition.sql`.
- Protección de origen:
  `supabase/migrations/20260827202000_guard_hybrid_finalization_origin.sql`.
- Guardia de informes pendientes/nulos:
  `supabase/migrations/20260828114200_fix_accreditation_report_null_guard.sql`.
- Evidencia del barrido anual:
  `supabase/migrations/20260828180536_capture_jefe_submission_evidence.sql`.
- Corrección de equivalencia para copias `(1)`:
  `supabase/migrations/20260828180630_fix_jefe_classifier_extension_stem.sql`.
- Contrato de regresión:
  `supabase/tests/accreditation_transition_contract.sql`.

## FAQ pendiente de autorización

El cambio impacta la experiencia estudiantil. Antes de activar el flujo debe
actualizarse la FAQ “¿Cómo solicito la acreditación?” para explicar inicio
automático, formulario asistido y fallback manual. No se modifica
`StudentAulaView.tsx` sin aprobación explícita del responsable.
