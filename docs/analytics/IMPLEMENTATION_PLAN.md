# Plan de implementación de analítica confiable

## Objetivo

Reemplazar cálculos ambiguos por una capa versionada, comparable y auditable sin
perder el trabajo visual ya realizado. El despliegue se hace por fases para no
congelar métricas defectuosas en snapshots ni mezclar actividades especiales con PPS.

## Estado de ejecución al 17 de julio de 2026

| Fase                       | Estado                          | Evidencia                                                                                                                     |
| -------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0. Contención              | Completada                      | Reporte sin exclusiones por institución, finalización efectiva, capacidad operativa y cobertura visible.                      |
| 1. Clasificación y motivos | Completada                      | Migraciones aplicadas; formulario de lanzamiento y solicitud actualizados; propagación automática a prácticas.                |
| 2. Capa semántica          | Completada en `analytics-v2`    | Oferta histórica canónica, capacidad con procedencia y bloqueo explícito de comparaciones incompatibles.                      |
| 3. Cierre de selección     | Completada                      | RPC atómico `close_selection`, timestamps y bitácoras de decisiones/reaperturas.                                              |
| 4. Backfill histórico      | Completada para 2024            | 363/363 prácticas y 80/80 lanzamientos vinculados; 42 ofertas verificadas y conciliadas con 60 filas legacy.                  |
| 5. Snapshots               | Completada para stocks v1       | Cron diario 09:00 UTC, dos stocks normalizados y bitácora de ejecución.                                                       |
| 6. Validación y rollout    | Completada para el alcance 2024 | Contratos SQL, cierre/reapertura transaccional, notificaciones simuladas, tipos, tests, lint y build aprobados.               |
| 7. Reporte profesional     | Completada y refinada           | Modelo único, informe anual y de gestión, PDF vectorial, reporte anterior preservado, anexo técnico opcional y anexo mensual. |
| 8. Informe para Dirección  | Completada                      | RPC nominal restringida, criterios 230/250/70/3, presión actual, vista separada, PDF vectorial y contrato de privacidad.      |

## Fase 0 — Contención y correcciones visibles

1. Eliminar la exclusión permanente por nombre de Fundación Tiempo/Ulloa.
2. Comparar YTD usando la misma definición en ambos años.
3. Usar finalización efectiva, no solicitud, para finalizados y trayectoria.
4. Eliminar el porcentaje de cobertura que se limita artificialmente a 100%.
5. Cambiar “rotaciones” por “registros de práctica” y “horas acreditadas” por
   “horas registradas”.
6. Mostrar `n`, cobertura y estado experimental en tiempo de selección.

**Aceptación:** ninguna tarjeta compara poblaciones diferentes; no hay exclusiones
por institución; un error de consulta no se representa como cero silencioso.

## Fase 1 — Clasificación explícita y razones de no concreción

Crear migraciones separadas:

- `lanzamientos_pps.tipo_actividad`: `pps | actividad_especial`;
- `lanzamientos_pps.modalidad_cupo`: `fijo | realizado`;
- `practicas.tipo_actividad`: `pps | actividad_especial`;
- `solicitudes_pps.motivo_no_concrecion` con vocabulario controlado;
- `solicitudes_pps.motivo_no_concrecion_detalle` para `Otro`.

El backfill puede usar nombres una única vez dentro de la migración. La aplicación
y los reportes no deben conservar reglas por texto.

**Aceptación:** Jornadas/Relevamientos quedan fuera de PPS; Tiempo/Ulloa siguen
contando como PPS; no se puede guardar `Otro` sin detalle ni cerrar una solicitud
sin motivo.

## Fase 2 — Capa semántica versionada

`analytics-v1` estableció la base. `analytics-v2` agrega procedencia y oferta
histórica sin cambiar silenciosamente el significado anterior. Las funciones de
lectura devuelven:

- flujos YTD con fecha de corte explícita;
- stocks actuales separados de flujos;
- capacidad fija, realizada y operativa;
- métricas de trayectoria con cobertura;
- indicadores de calidad junto a cada resultado.

Las funciones privilegiadas internas vivirán en un esquema no expuesto, con
`search_path = ''` y objetos totalmente calificados. El RPC público será mínimo y
protegido para roles staff.

**Aceptación:** frontend y reporte consumen una sola definición; la salida incluye
`metric_version`, `as_of` y `quality`.

## Fase 3 — Instrumentación del cierre de selección

- agregar `selection_closed_at` al lanzamiento;
- agregar `selection_decided_at` a cada postulación;
- extender el cierre existente del Lanzador, sin crear otro botón;
- convertir pendientes finales en `No Seleccionado` dentro de una operación atómica;
- registrar reaperturas y cambios posteriores.

**Aceptación:** toda decisión nueva tiene timestamp; seleccionados y no
seleccionados reconcilian con el total al cerrar; reaperturas no borran historia.

## Fase 4 — Backfill y reconciliación

- completar clasificaciones históricas;
- vincular instituciones/lanzamientos cuando la coincidencia sea inequívoca;
- producir tabla de casos ambiguos para revisión humana;
- no inventar `selected_at` histórico; marcarlo como no disponible;
- reconciliar una muestra de estudiantes y lanzamientos por año.

**Aceptación:** cada backfill informa filas actualizadas, omitidas y ambiguas; se
puede repetir sin cambiar resultados.

El lote determinístico 2024 y su limpieza operativa posterior fueron aplicados con
guardas de conteo. La coincidencia por nombre no quedó como regla permanente: los
casos ambiguos se resolvieron con evidencia documental o decisiones de dominio
explícitas y auditadas.

### Avance de reconstrucción 2024 con fuente documental

La exportación del grupo institucional de WhatsApp permitió convertir una parte
del backfill 2024 en evidencia auditable:

- 40 anuncios iniciales, 2 relanzamientos y 42 ofertas candidatas;
- 36 ofertas con cupo finito, por 270 vacantes publicadas;
- 42 ofertas conciliadas con 60 filas legacy;
- 9 ofertas inicialmente ausentes reconstruidas como lanzamientos ocultos;
- 80 de 80 lanzamientos PPS 2024 vinculados a una institución;
- 363 de 363 prácticas PPS 2024 vinculadas a un lanzamiento;
- cobertura final: 100% lanzamiento–institución y 100% práctica–lanzamiento.

La Fase 4 se divide desde ahora en tres lotes:

1. `4A — vínculos determinísticos` — **completado**: 68 instituciones y 317
   prácticas, con guardas de conteo e idempotencia;
2. `4B — capa canónica histórica` — **completado**: 42 ofertas, 31 slots, fuente,
   eventos y relación con 50 filas legacy sin borrar historia;
3. `4C — revisión humana` — **completado**: 9 ofertas reconstruidas, 44 prácticas
   conciliadas, duplicados maestros consolidados y 20 observaciones cerradas.

`analytics-v2` ya publica esta capa. La decisión, el contrato y la validación se
documentan en [ANALYTICS_V2_2024_RELEASE.md](./ANALYTICS_V2_2024_RELEASE.md).

El informe, la matriz y el SQL en modo `ROLLBACK` están en
[`reconstruction/`](./reconstruction/WHATSAPP_2024_RECONSTRUCTION_REPORT.md).

## Fase 5 — Snapshots

Recién con `analytics-v1` estable, crear snapshots de métricas de stock con:

- fecha/hora y zona de referencia;
- clave y versión de métrica;
- valor, numerador, denominador y calidad;
- idempotencia diaria;
- cron monitoreado y runbook de recuperación.

No se almacenará el JSON completo del RPC legado.

## Fase 6 — Pruebas, rollout y documentación operativa

- tests unitarios de definiciones y percentiles;
- tests SQL de unicidad, estados, rangos, RLS y reconciliación;
- comparación diagnóstica entre legacy, `analytics-v1` y `analytics-v2`;
- contrato funcional de cierre/reapertura con fixtures aislados y `ROLLBACK`;
- prueba de notificaciones con dependencias simuladas, sin emails ni push reales;
- `npm run gen-types` después de cada migración;
- `npm run type-check`, tests, lint y build;
- actualización de este diccionario y changelog de métricas.

El FAQ estudiantil sólo requiere cambios si la instrumentación modifica una
acción o mensaje visible para estudiantes.

## Fase 7 — Reporte ejecutivo profesional

- incorpora una edición nueva sin borrar ni modificar el reporte anterior;
- comparte un único `ExecutiveReportModel` entre la vista y el PDF;
- ofrece informe anual por ciclo e informe integral de gestión 2024–actualidad;
- marca el 1 de septiembre de 2024 y conserva el 31 de agosto como línea de base;
- impide porcentajes cuando fuente, base temporal o corte no son homogéneos;
- genera PDF A4 vectorial con fuentes locales, texto seleccionable y anexo de ofertas;
- excluye información personal de estudiantes por contrato y prueba automatizada;
- documenta operación, reglas, firma, identidad y validación visual.
- declara una sola base temporal por página y conserva unidad y porcentaje junto
  a cada KPI en tamaño legible;
- reemplaza el timestamp de selección por esfuerzo hasta el primer acceso;
- deja calidad y metodología en un anexo técnico optativo, apagado por defecto;
- agrupa ofertas por mes y diferencia sólo las propuestas sin cupo prefijado;
- presenta convenios con orientación, ofertas y capacidad registrada.
- pagina la secuencia completa de postulaciones antes de calcular el acceso en
  primera postulación y omite el indicador cuando el ciclo no es reconstruible;
- reutiliza los colores de orientación de Mi Panel y la paleta institucional como
  acento, sin convertir el informe en una plantilla corporativa genérica.

**Aceptación:** `type-check`, prueba del modelo y build aprobados; PDF anual y de
gestión renderizados página por página; cifras principales reconciliadas contra
Supabase productivo con los mismos cortes del informe.

## Fase 8 — Informe restringido para Dirección

- agrega una tercera variante, **Para Dirección**, sin modificar ni reemplazar
  los informes anual y de gestión;
- combina los resultados generales del ciclo con una foto operativa actual;
- obtiene listados nominales mediante `director-report-v1`, restringido por
  `is_staff()` y sin datos de contacto;
- publica tres criterios deduplicados de proximidad: 230–249 horas; 250 horas con
  una orientación faltante; 250 horas y tres orientaciones con una brecha de
  hasta 20 horas de especialidad;
- separa estudiantes listos para solicitar, solicitudes ya iniciadas y criterios
  completos con una práctica todavía activa;
- mide presión sobre convocatorias abiertas de cupo fijo mediante postulaciones
  pendientes por lugar disponible;
- identifica en portada a Agostina Reale Berrueta y marca todas las páginas
  nominales como circulación interna;
- genera un PDF A4 vectorial con tipografía legible, colores de orientación y
  paginación estable de los listados.

**Aceptación:** conteos y detalle reconcilian; el payload no contiene DNI, correo,
teléfono ni domicilio; la RPC no es ejecutable por `anon`; tipos regenerados,
prueba del adaptador, `type-check`, build y revisión visual de todas las páginas
aprobados. El contrato completo está en
[DIRECTOR_REPORT_CONTRACT.md](./DIRECTOR_REPORT_CONTRACT.md).

## Fase 9 — Cohorte operativa para PPS de entrevistas

- convierte “Próximos a finalizar” en una KPI accionable del dashboard;
- reutiliza los tres criterios versionados del informe para Dirección;
- excluye estudiantes que ya registran Relevamiento del Ejercicio Profesional o
  Entrevista a Profesionales, sin confundir otras actividades de entrevista;
- muestra la composición por horas, orientación faltante y brecha de
  especialidad;
- abre un listado nominal con legajo, horas, orientaciones, motivo y prácticas
  activas para revisar cada caso antes de ofertar la PPS de 20 horas;
- mantiene la lectura como foto actual y no como flujo anual;
- restringe la RPC a personal autenticado autorizado y evita datos de contacto.

**Aceptación:** cada fila cumple uno de los tres criterios, no posee la práctica
excluida ni solicitud de finalización, y el total de la tarjeta coincide con el
listado. La definición completa está en
[INTERVIEW_COMPLETION_CANDIDATES.md](./INTERVIEW_COMPLETION_CANDIDATES.md).

## Fase 10 — Demanda activa entre estudiantes sin PPS

- refina el listado de Dirección para separar el padrón administrativo de la
  demanda operativa;
- incluye solamente estudiantes activos sin prácticas que registraron al menos
  una postulación a una oferta PPS durante el ciclo informado;
- usa la fecha real de creación de la postulación, desde el 1 de enero hasta el
  corte en ciclos abiertos y durante el año completo en ciclos cerrados;
- recalcula postulaciones totales y pendientes dentro de ese mismo período;
- excluye del KPI y del listado nominal a quienes no muestran actividad de
  búsqueda durante el ciclo;
- explicita la regla en la vista, el PDF, el payload y el contrato SQL.

**Aceptación:** el total coincide con el listado; todas las filas poseen una
postulación PPS fechada dentro del período y `application_count > 0`. La foto
productiva al 18/07/2026 pasa de 17 registros administrativos sin prácticas a 3
casos de demanda activa.

## Fase 11 — Reconciliación dashboard–informes

- usa `analytics-v2` como única fuente de los cuatro resultados primarios;
- construye la banda principal del dashboard con el mismo modelo semántico del
  informe profesional;
- elimina la comparación retrospectiva de stocks actuales;
- recorta gráficos, dinámica y anexos al mismo corte anual;
- usa `director-report-v1` para todos los estados operativos nominales;
- hace que Dirección y dashboard compartan exactamente los 13 estudiantes
  próximos a finalizar, incluida la exclusión por Relevamiento/Entrevista;
- conserva 2024 como cierre oficial y habilita el puente histórico revisado
  2025–2024 con su contexto documental.

**Aceptación:** valores, base comparativa, rótulos y listados coinciden entre
dashboard, informe web y PDF. Contrato completo en
[DASHBOARD_REPORT_CONTRACT.md](./DASHBOARD_REPORT_CONTRACT.md).

## Siguiente ciclo

El alcance 2024 queda cerrado. Los siguientes trabajos no corrigen la definición
estadística publicada y se gestionan como ciclos separados:

1. **completado:** observabilidad diaria y alertas internas sobre snapshots y
   regresiones de calidad;
2. endurecimiento de Auth, Storage, funciones privilegiadas y políticas RLS;
3. reconciliación histórica 2025 con el mismo método auditable;
4. uso de `selected_at` como control interno de proceso sólo después de superar
   90% de cobertura durante un ciclo completo; no reemplaza el indicador de
   postulaciones hasta la primera selección.
