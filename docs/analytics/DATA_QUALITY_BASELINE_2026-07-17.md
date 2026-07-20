# Línea de base de calidad de datos — 17 de julio de 2026

## Alcance

Auditoría agregada y de sólo lectura sobre el proyecto Supabase
`qxnxtnhtbpsgzprqtrjl`. No se extrajeron nombres, correos, documentos ni otros
datos personales. Esta línea de base debe repetirse después de cada backfill o
cambio de definición.

## Volumen y estado general

| Entidad                     | Filas |
| --------------------------- | ----: |
| Estudiantes                 |   393 |
| Lanzamientos PPS            |   196 |
| Postulaciones               | 2.270 |
| Prácticas                   | 1.542 |
| Solicitudes de finalización |    90 |
| Solicitudes de nueva PPS    |    65 |

Estados actuales de estudiantes: 236 `Activo`, 116 `Finalizado`, 36
`Nuevo (Sin cuenta)` y 5 `Inactivo`. Los 36 estudiantes sin cuenta deben
permanecer separados de la matrícula activa hasta acordar una regla de inclusión.

## Hallazgos críticos

### 1. Capacidad inflada en 2026

La suma bruta de `cupos_disponibles` para PPS iniciadas hasta el 17 de julio de
2026 es 1.323. Cuatro lanzamientos de Fundación Tiempo tienen `250` como valor
operativo, aunque registran 50, 51, 32 y 47 estudiantes seleccionados.

Manteniendo Fundación Tiempo y Fernando Ulloa como PPS reales, pero usando
seleccionados para las modalidades de capacidad realizada, `analytics-v1`
reconcilia una capacidad operativa de 492: 243 cupos fijos y 249 plazas realizadas.

Impacto: `cupos_ofrecidos`, ocupación, presión por orientación y comparaciones
interanuales están materialmente sesgadas si se suma el campo bruto.

### 2. Tiempo de selección sin historia comparable

De 1.029 postulaciones actualmente seleccionadas, 830 no tienen `selected_at`.
La cobertura es 0% para lanzamientos 2024/2025 y 43,8% para 2026. Los 199 casos
2026 con espera válida tienen una mediana provisional de 1,1 días, pero no son
representativos de toda la cohorte.

Impacto: la métrica puede publicarse sólo como experimental, con `n` y cobertura.
No debe mostrar comparación interanual ni objetivo hasta superar el umbral de
calidad acordado.

### 3. Migración de Airtable contaminó `created_at`

La primera postulación tiene `created_at` de febrero de 2025. Existen 52
postulaciones de lanzamientos 2024 creadas técnicamente en 2025. También hay 101
postulaciones creadas en 2025 para lanzamientos 2026.

Impacto: `created_at` no sirve como año histórico de la postulación. Para volumen
por ciclo se debe usar el lanzamiento; para espera individual se conserva
`created_at`, pero sólo desde que la instrumentación es confiable.

### 4. Vínculos históricos incompletos

La cobertura de `practicas.lanzamiento_id` es 0,6% en 2024, 7,7% en 2025 y 98,8%
en 2026. La cobertura de `lanzamientos_pps.institucion_id` es 0% en 2024/2025 y
95,2% en 2026.

Impacto: los análisis históricos por institución requieren backfill o una tabla
controlada de equivalencias. No deben resolverse con `split_part` o coincidencias
de nombres permanentes.

### 5. Solicitud y finalización son eventos diferentes

Hay 116 estudiantes con estado `Finalizado` y fecha de finalización. Hay 89
estudiantes con solicitud de finalización. En 2024 se registran 32 finalizados y
0 solicitudes; en 2026, 28 finalizados y 34 solicitantes.

De los 116 finalizados, 81 tienen también solicitud y 35 no. Ocho solicitantes no
tienen todavía una finalización efectiva.

Impacto: el KPI de acreditación debe usar `estudiantes.estado = 'Finalizado'` y
`estudiantes.fecha_finalizacion`. La solicitud se reporta como etapa previa.

### 6. Actividades especiales mezcladas con PPS

En 2025 existen tres lanzamientos identificables como Jornadas o Relevamientos.
Uno de los relevamientos tiene 21 cupos y 54 seleccionados; la Jornada registra
28 filas de práctica para 25 estudiantes.

Impacto: deben conservarse para reconocer actividad académica, pero fuera de los
KPIs de oferta, capacidad, conversión y trayectoria de PPS.

## Hallazgos altos y medios

- 1.071 de 1.542 prácticas no tienen `lanzamiento_id`; la concentración es histórica.
- 156 de 196 lanzamientos no tienen `institucion_id`; casi todos son anteriores a 2026.
- 51 prácticas no tienen fecha de finalización y 11 no tienen fecha de inicio.
- 12 prácticas tienen horas nulas o cero; no hay horas negativas ni mayores a 500.
- Los 30 cierres históricos `No se pudo concretar` quedaron como `Histórico sin clasificar`; los nuevos cierres exigen motivo y detalle cuando se elige `Otro`.
- Existen lanzamientos de capacidad fija con más seleccionados que cupos: 13 en 2025 y 2 en 2026. Deben revisarse antes de usar la ocupación como guardrail.

## Métricas confiables obtenidas

Finalizados reales y trayectoria desde la primera PPS estándar:

| Año de finalización | Finalizados | Mediana meses |  P25 |  P75 | Promedio de registros de práctica | Promedio horas registradas |
| ------------------- | ----------: | ------------: | ---: | ---: | --------------------------------: | -------------------------: |
| 2024                |          32 |          14,3 |  8,6 | 16,5 |                               5,4 |                      267,7 |
| 2025                |          56 |          15,0 | 12,5 | 17,6 |                               5,7 |                      263,4 |
| 2026                |          28 |          15,5 | 11,2 | 19,3 |                               5,3 |                      263,7 |

Flujos acumulados al 17 de julio de cada año:

| Año  | Estudiantes que iniciaron PPS | Finalizados reales | Ofertas/filas al corte | Capacidad publicada | Fuente de capacidad               |
| ---- | ----------------------------: | -----------------: | ---------------------: | ------------------: | --------------------------------- |
| 2024 |                            71 |                  1 |                     24 |                 118 | mínimo documental, `analytics-v2` |
| 2025 |                           105 |                 17 |                     35 |                 195 | lanzamientos operativos           |
| 2026 |                           190 |                 28 |                     41 |                 492 | 243 fija + 249 realizada          |

## Criterio de publicación

- **Confiable:** fechas de inicio/finalización de prácticas, finalización efectiva 2024–2026 y stock actual por estado.
- **Con cautela:** capacidad ajustada 2025/2026 y trayectoria por cantidad de registros.
- **Experimental:** tiempo de selección 2026.
- **No comparable:** demanda 2024 por `created_at`, stocks históricos sin snapshots y capacidad histórica por institución sin backfill.

## Estado posterior a la implementación

- 193 lanzamientos quedaron clasificados como `pps` y 3 como `actividad_especial`.
- 185 lanzamientos usan capacidad `fijo` y 11 `realizado`.
- 1.424 prácticas quedaron como `pps` y 118 como `actividad_especial`.
- `selection_decided_at` conserva 199 timestamps reales; el resto no se rellenó.
- El snapshot inicial guardó 236 estudiantes activos y 187 activos con PPS en curso.
- El cron `analytics-v1-daily-snapshot` quedó activo a las 09:00 UTC.

## Addendum posterior al backfill 2024 y `analytics-v2`

La línea de base inicial detectó el problema; los siguientes valores describen el
estado productivo después de aplicar sólo coincidencias determinísticas y la capa
histórica privada:

| Control 2024                      | Antes | Después |
| --------------------------------- | ----: | ------: |
| Lanzamientos con institución      |     0 |      68 |
| Cobertura lanzamiento–institución |    0% |   98,6% |
| Prácticas con lanzamiento         |     2 |     319 |
| Cobertura práctica–lanzamiento    |  0,6% |   87,9% |
| Unidad visible de oferta anual    |    69 |      42 |
| Capacidad anual visible           |   332 |     270 |

Los dos últimos cambios no representan pérdida de datos. Las 69 filas y la
capacidad legacy siguen disponibles como diagnóstico; la vista pública usa el
grano correcto de oferta publicada. Las 44 prácticas ambiguas, una institución
duplicada y 20 ofertas con observaciones se mantienen pendientes de revisión, sin
imputación automática.

## Addendum final de la limpieza 2024

La tabla anterior conserva el estado del lote determinístico inicial. La revisión
posterior, aprobada por Coordinación y aplicada mediante migraciones con aserciones,
cerró el remanente:

| Control 2024                      | Estado final |
| --------------------------------- | -----------: |
| Lanzamientos PPS con institución  |        80/80 |
| Cobertura lanzamiento–institución |         100% |
| Prácticas PPS con lanzamiento     |      363/363 |
| Cobertura práctica–lanzamiento    |         100% |
| Ofertas conciliadas con legacy    |        42/42 |
| Ofertas pendientes de revisión    |            0 |

Se reconstruyeron 11 lanzamientos legacy ocultos, se consolidaron los duplicados
maestros y se preservaron las excepciones históricas de SAU e Investigación sin
reinterpretarlas como prácticas vigentes.
