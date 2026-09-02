# Diccionario de métricas

Versión vigente: `analytics-v2` + `population-contract-v2` — 2026-07-30.
Versión base preservada: `analytics-v1`.

Contrato ejecutable de resultados: `public.get_analytics_v2(p_year, p_cutoff)`.
La salida incluye `metric_version`, `cutoff`, `as_of`, `flows`, `capacity`,
`stocks` y `quality`. V2 conserva los flujos y stocks de v1 y agrega fuente,
completitud y comparabilidad de la oferta.

Contrato poblacional:
[criterio-metricas-ingresantes.md](../criterio-metricas-ingresantes.md).
Contrato histórico:
[HISTORICAL_SCOPE_DECISIONS.md](./HISTORICAL_SCOPE_DECISIONS.md).

`analytics-v2` es autoritativo para resultados del período. No publica todavía
matrícula administrativa ni activación de cuentas. Esas poblaciones no deben
inferirse desde `estudiantes.cohorte`.

## Dimensiones canónicas

### Tipo de actividad

- `pps`: práctica profesional supervisada que participa del embudo de oferta,
  selección, cursada y finalización.
- `actividad_especial`: Jornada, Relevamiento u otra actividad reconocida, pero
  excluida de capacidad, conversión y trayectoria PPS.

### Modalidad de capacidad

- `fijo`: `cupos_disponibles` representa la oferta anunciada.
- `realizado`: no existe un cupo fijo confiable; se reportan seleccionados reales.

Fundación Tiempo y Fernando Ulloa son `pps`, no actividades especiales. Sus
lanzamientos pueden usar capacidad `realizado` cuando el cupo almacenado sea un
valor técnico y no una oferta real.

## Poblaciones canónicas

### Matriculados administrativamente en PPS

- **Definición:** estudiantes de Psicología, Sede Comahue, inscriptos
  administrativamente en la materia PPS al inicio del año.
- **Fuente:** padrón administrativo de la Facultad.
- **No implica:** cuenta creada, búsqueda activa, postulación ni PPS iniciada.
- **Comparación:** sólo contra la misma matrícula administrativa.
- **Estado:** serie externa disponible para 2022/1–2025/1; no integrada a
  `analytics-v2`.

### Cuentas de estudiantes creadas

- **Definición:** cuentas vinculadas a estudiantes cuya
  `auth.users.created_at`, interpretada en
  `America/Argentina/Buenos_Aires`, cae dentro del período.
- **Vínculo:** `estudiantes.user_id = auth.users.id`.
- **Exclusiones:** personal, cuentas sin perfil de estudiante y usuarios no
  vinculados.
- **No usar:** `estudiantes.created_at` ni `estudiantes.cohorte`.
- **Disponibilidad histórica:** el registro verificable actual de
  `auth.users.created_at` comienza el 29/11/2025. Los períodos anteriores se
  publican como `ND`, nunca como cero.
- **Estado:** implementada en `management-report-v1` con indicador explícito de
  disponibilidad.

### Nuevas cuentas activas

- **Definición:** cuentas de estudiantes creadas durante el año cuyos perfiles
  se encuentran actualmente en `estado = 'Activo'`.
- **Tipo:** cohorte de activación con estado actual.
- **Publicación:** valor, total de cuentas creadas y fecha de corte.
- **Disponibilidad:** hereda el inicio del historial de cuentas. Si la cohorte no
  puede observarse, tanto el total como el subconjunto activo se publican como
  `ND`.
- **Estado:** implementada en el informe de gestión. No es una serie histórica
  de estudiantes activos.

### Cohorte de primera actividad PPS

- **Definición:** año de la primera actividad PPS registrada en convocatoria o
  práctica.
- **Campo:** `estudiantes.cohorte`.
- **Etiqueta permitida:** `Cohorte de primera actividad` o
  `Debut en el circuito PPS`.
- **No equivale a:** matrícula, creación de cuenta, cuenta activa o primera PPS
  efectivamente iniciada.
- **Estado:** disponible como segmentación secundaria; no es KPI de activación.

### Regla de vocabulario

La etiqueta sin calificador **Ingresantes** queda desaconsejada. Toda superficie
debe elegir una de las poblaciones anteriores o usar los flujos
`Estudiantes postulados` y `Estudiantes que iniciaron PPS`.

No se calcula una tasa de activación con agregados de matrícula y cuentas. Se
requiere vinculación nominal por legajo. Tampoco se divide “iniciaron PPS” por
matrícula administrativa porque el numerador puede incluir arrastre de años
anteriores.

## KPIs primarios

### Estudiantes que iniciaron PPS — YTD

- **Tipo:** flujo.
- **Definición:** estudiantes distintos con al menos una práctica `pps` cuya
  `fecha_inicio` cae entre el 1 de enero y la fecha de corte.
- **Fuente:** `practicas` + clasificación de actividad.
- **Comparación:** mismo día y mes del año anterior.
- **Exclusiones:** actividades especiales y fechas inválidas.
- **Estado:** confiable desde 2024; 2024 debe conservar nota de transición.

### Estudiantes finalizados — YTD

- **Tipo:** flujo.
- **Definición:** estudiantes distintos con `estado = 'Finalizado'` y
  `fecha_finalizacion` dentro del período.
- **Fuente:** `estudiantes`.
- **Comparación:** mismo día y mes del año anterior.
- **No usar:** fecha de solicitud de `finalizacion_pps` como sustituto.
- **Estado:** confiable desde 2024.

### Estudiantes con PPS activa — fecha de corte

- **Tipo:** stock.
- **Definición:** estudiantes `Activo` con al menos una práctica `pps` en estado
  `En curso`/`En proceso` a la fecha de corte.
- **Fuente:** `estudiantes` + `practicas`.
- **Comparación histórica:** sólo contra snapshots equivalentes.
- **Estado:** confiable para el valor actual; sin historia comparable aún.

### Inicios por orientación

- **Definición:** estudiantes distintos con una práctica `pps` iniciada en el
  período, agrupados por la orientación del lanzamiento o, si falta el vínculo,
  por la especialidad registrada en la práctica.
- **Unidad publicada:** menciones. Una persona puede aportar a más de un área.
- **No usar:** postulaciones ni `convocatorias.created_at` como sustituto.

## Drivers

### Postulaciones a PPS

- **Grano:** una fila por estudiante y lanzamiento; existe unicidad efectiva en
  los datos actuales.
- **Volumen:** cantidad de filas para lanzamientos `pps` del ciclo.
- **Personas:** estudiantes distintos; no confundir con volumen.
- **YTD histórico:** requiere fecha de evento confiable. `created_at` no es válido
  para 2024 por la migración.

### Seleccionados PPS

- **Definición:** pares estudiante-lanzamiento con estado `Seleccionado` en una
  actividad `pps`.
- **Capacidad realizada:** estudiantes distintos seleccionados por lanzamiento.
- **Limitación:** sin `selection_decided_at` no se puede reconstruir el stock de
  seleccionados a una fecha histórica.

### Capacidad PPS

Se publican tres medidas separadas:

1. **Cupos fijos ofrecidos:** suma de `cupos_disponibles` sólo para `modalidad_cupo = 'fijo'`.
2. **Plazas realizadas:** seleccionados distintos sólo para `modalidad_cupo = 'realizado'`.
3. **Capacidad operativa:** cupos fijos ofrecidos + plazas realizadas, siempre con desglose.

En el informe para autoridades esta suma se presenta como **capacidad registrada**:

- **cupos publicados en ofertas con límite prefijado**, más
- **participantes incorporados en ofertas sin límite prefijado**.

Cuando esas ofertas corresponden a Fundación Tiempo e Institución Fernando Ulloa,
el informe identifica ambas procedencias y explicita que sus convenios fueron
gestionados por la Coordinación de PPS de Sede Comahue. Esta nota contextual no
modifica el cálculo.

La redacción evita llamar “vacantes” a estudiantes ya incorporados. El campo
técnico `operational` no cambia y conserva su trazabilidad histórica.

Las actividades especiales se reportan en una sección independiente y nunca
entran en estos totales.

#### Oferta histórica documentada

Cuando `capacity.source = 'historical_documented_offers'`:

- **grano:** una oferta publicada canónica; un relanzamiento es un evento y no
  incrementa el total;
- **fecha YTD:** `announcement_at`, no la fecha técnica de una fila legacy;
- **capacidad documentada:** suma de `offered_capacity` sólo para ofertas con
  `capacity_mode = 'fijo'`;
- **ofertas sin total finito:** se informan por separado y no se imputan como cero
  real ni se estiman;
- **comparabilidad automática:** `capacity.comparable = false` frente a ciclos
  calculados desde lanzamientos operativos;
- **puente histórico aprobado:** el contrato de presentación permite comparar
  el cierre 2025 contra el cierre 2024 cuando la reconstrucción figura revisada
  al 100%. La variación usa 42 ofertas y 270 vacantes finitas como base y siempre
  conserva la aclaración de que seis ofertas 2024 no tenían cupo finito;
- **demanda/ocupación:** no disponible hasta aprobar una relación de resultados.

Para 2024 el resultado anual oficial es 42 ofertas. De ellas, 36 tienen capacidad
finita y suman exactamente 270 vacantes documentadas; las seis restantes son
ofertas sin cupo finito y se informan por separado. Las 270 vacantes son el
resultado consolidado de la oferta finita del ciclo: no son una estimación ni un
“mínimo”. Tampoco se inventa una equivalencia numérica para las seis ofertas de
capacidad no finita.

### Tiempo hasta selección

- **Definición:** días entre `convocatorias.created_at` y `selected_at` para casos seleccionados.
- **Resumen:** mediana, P25, P75, `n` y cobertura de timestamp.
- **Guardrail:** porcentaje pendiente y antigüedad de pendientes.
- **Publicación:** experimental hasta alcanzar al menos 90% de cobertura durante
  un ciclo completo. No comparar con años sin instrumentación.
- **Uso:** control interno de proceso. No se publica en el cuerpo principal del
  informe para autoridades porque describe la latencia entre dos timestamps y
  no cuántas postulaciones necesitó un estudiante para acceder.

### Esfuerzo hasta la primera selección

- **Unidad de análisis:** estudiante cuya primera postulación seleccionada se
  vincula a una PPS con inicio dentro del ciclo y antes del corte.
- **Secuencia:** todas las postulaciones del estudiante se ordenan por
  `created_at`; el número de orden de la primera seleccionada es su cantidad de
  postulaciones hasta el primer acceso.
- **Indicador principal:** porcentaje cuya primera selección ocurrió en la
  primera postulación.
- **Contexto obligatorio:** numerador, cohorte, mediana de postulaciones y P75.
- **Fecha anual:** fecha de inicio del lanzamiento, igual que la oferta operativa.
- **Disponibilidad:** desde 2025. En 2024 la migración no conserva una secuencia
  completa y el indicador se omite del cuerpo principal.
- **Extracción:** la consulta debe paginar todas las filas de `convocatorias` con
  orden estable por `created_at, id`; una única página de PostgREST invalida la
  secuencia y sesga la cohorte hacia los registros más antiguos.
- **Lectura:** mide fricción de acceso observada; no prueba por sí solo equidad,
  calidad de asignación ni causalidad de gestión.

### Calidad de selección

- `selection_decided_at` registra toda decisión nueva.
- `selected_at` conserva el instante que inicia el consentimiento y la medición de espera.
- `selection_closed_at` registra el cierre vigente de la mesa.
- `selection_decision_events` y `selection_cycle_events` preservan cambios y reaperturas.

## Métricas de trayectoria

### Tiempo hasta finalización

- **Definición:** meses entre la primera práctica `pps` y la
  `estudiantes.fecha_finalizacion` efectiva.
- **Resumen:** mediana principal, P25/P75, promedio secundario, `n` y cobertura.
- **Reglas:** excluir duraciones negativas; no descartar outliers silenciosamente.
  Los casos fuera del rango de publicación deben informarse como calidad.

### Registros de práctica

Cantidad de filas de `practicas` por estudiante finalizado. No debe llamarse
“rotaciones” hasta que exista una regla de negocio que confirme que cada fila
equivale a una rotación.

### Horas registradas

Suma de `practicas.horas_realizadas`. No debe llamarse “horas acreditadas” sin un
evento o campo explícito de acreditación.

## Guardrails de calidad

- cobertura de `selected_at` entre seleccionados;
- cobertura `practicas.lanzamiento_id` e `institucion_id` por año;
- lanzamientos con seleccionados por encima del cupo fijo;
- fechas obligatorias faltantes o inválidas;
- prácticas con horas nulas/cero;
- porcentaje de métricas calculadas con fallback histórico;
- fuente, base temporal, completitud y comparabilidad de la capacidad;
- versión de contrato usada en cada reporte o snapshot.

## Panel de jefaturas por orientación

El RPC `get_jefe_dashboard_v1` aplica el mismo vocabulario anual de
`analytics-v2`, limitado a las orientaciones asignadas al DNI autenticado.
`get_jefe_dashboard_preview_v2` reutiliza exactamente ese cálculo y no define
una métrica nueva: sólo habilita una lectura de prueba para `SuperUser` y
`AdminTester`. El cliente elige entre claves opacas obtenidas de
`list_jefe_preview_profiles_v1`; no recibe ni envía el DNI.

- **PPS lanzadas:** ofertas canónicas publicadas del área y del año. Para 2024
  usa `private.historical_launch_offers`; desde 2025 usa lanzamientos operativos
  de tipo `pps` y excluye borradores `Oculto`.
- **Cupos registrados:** cupos fijos documentados más participantes realizados
  en ofertas sin cupo finito. Siempre muestra el desglose `fixed`, `realized` y
  la cantidad de ofertas `desconocido`; no convierte estas últimas en cero.
- **Instituciones con ofertas de PPS en [año]:** instituciones distintas dentro
  de las ofertas del período. No se etiqueta como “instituciones activas”.
- **Estudiantes que iniciaron:** personas distintas con fecha efectiva de inicio
  en el año y orientación dentro del alcance del jefe.
- **Demanda:** `applications` cuenta inscripciones y `applicants` personas
  distintas. No se publica para 2024 si la relación histórica no está disponible.
- **Foto actual:** prácticas activas, convocatorias abiertas e informes
  pendientes/críticos al corte de hoy. Es un stock operativo separado y nunca se
  compara como si fuera un resultado anual.

La cola de informes usa el timestamp de entrega mostrado por Moodle y, como
fallback, `convocatorias.fecha_entrega_informe`. `observed_at` sólo indica cuándo
Mi Panel leyó Moodle y no puede reemplazar la fecha de entrega. Si ninguna fuente
confiable aporta la fecha, el informe permanece pendiente con urgencia `undated`
y se separa de `on_time`. El seguimiento interno vence a los 30 días corridos;
`critical` significa que ese umbral interno fue superado, no una declaración
sobre el plazo normativo comunicado al estudiante. Una entrega sin calificación
sale de la cola prioritaria cuando acumula más de 60 días de atraso respecto de
ese vencimiento: se conserva con estado `stale` como antecedente, pero no integra
`pending`, `critical` ni la foto operativa.

### Métricas operativas por unidad Moodle v2

Estas métricas no son resultados anuales de `analytics-v2`; describen una unidad
`(lanzamiento, orientación)` al corte de la consulta y deben reconciliar agregado
contra participante:

- **Esperados (`total_expected`)**: membresías activas con estado `expected`.
- **Entregados (`total_submitted`)**: esperados con evidencia Moodle de entrega o
  estado local confirmado `Entregado/Calificado`.
- **Faltantes (`total_missing`)**: esperados sin esa evidencia.
- **En corrección (`total_under_review`)**: entregados sin una calificación
  terminal observada.
- **Reentrega (`total_revision_required`)**: calificados por debajo del umbral
  explícito de la tarea; no equivale a desaprobación definitiva.
- **Aprobados (`total_passed`)**: calificación aprobatoria según `percentage`,
  `direct_10` o `pass_fail`.
- **Resueltos (`total_settled`)**: excepción terminal o aprobación verificada
  cuando la práctica ya terminó. Una nota futura no adelanta el fin operativo.

Los retirados y reemplazados se conservan como historia pero no integran el
denominador activo. La fuente es `get_moodle_task_unit_summaries_v1`.

## Snapshots

`analytics_metric_snapshots` guarda una fila por fecha, versión y métrica. La
versión inicial captura diariamente `active_students` y
`active_students_with_current_pps`. No se permite reconstruir retrospectivamente
un stock ni guardar como snapshot el JSON del RPC legado.

## Informe de gestión dinámico (`management-report-v1`)

`get_management_report_v1(p_cutoff)` complementa, sin reemplazar, los resultados
anuales de `analytics-v2`. El corte es elegido al generar el informe y toda fila
debe respetarlo.

Revisión de presentación directiva: 01/09/2026. No modifica las fórmulas ni el
payload del contrato.

- **Matrícula administrativa PPS:** serie externa informada por Secretaría de
  Facultad: 2022/1 = 39, 2023/1 = 87, 2024/1 = 101 y 2025/1 = 242. Se publica
  como fuente externa y no se equipara con cuentas, postulantes o inicios.
- **Cuentas de estudiantes creadas:** usuarios con rol `Alumno`, fechados por
  `auth.users.created_at`. Excluye cuentas de personal. El historial verificable
  comienza el 29/11/2025; 2024 se publica como `ND`.
- **Nuevas cuentas actualmente activas:** subconjunto de cada cohorte creada que
  continúa activo al corte. Es un stock con fecha de corte, no un flujo anual.
- **Instituciones incorporadas:** convenios con fecha registrada desde el
  01/09/2024 y seis convenios de gestión 2024 recuperados con precisión anual,
  confirmados por Coordinación. Estos últimos conservan `01/01/2024` como fecha
  técnica estimada y se muestran como “fecha anual registrada”; no se presenta
  ese día como fecha exacta de firma. La salida presenta **una fila por
  institución canónica**, aunque existan varios registros de convenio o espacios
  operativos asociados. En el informe directivo, el aporte anual muestra
  únicamente estudiantes distintos con una PPS registrada; el total vuelve a
  deduplicar entre años, por lo que no necesariamente equivale a la suma de las
  columnas anuales. Banco Provincia del Neuquén se excluye de esta tabla por
  decisión del responsable; el registro fuente no se elimina.
- **Acceso observado en el año del corte:** estudiantes distintos que se
  postularon al menos una vez a una oferta del año, comparados con quienes
  iniciaron una PPS durante ese mismo año. Se publican numerador, denominador,
  porcentaje, casos sin inicio anual y casos sin ninguna PPS registrada hasta el
  corte. Para quienes no iniciaron se publica además la distribución por cantidad
  de PPS distintas a las que se inscribieron y el total de lanzamientos del año
  hasta el corte; el denominador excluye por definición a quien no registra
  ninguna inscripción. Es una medida descriptiva de acceso; no permite atribuir
  los casos pendientes a falta de interés, rechazo u otra decisión personal.
- **Red con actividad reciente:** instituciones o espacios con al menos una PPS
  lanzada en los dos años calendario más recientes hasta el corte, junto con sus
  orientaciones —con el color institucional de cada área— y cantidad de ofertas
  por año. La vigencia documental y la cobertura de mapeo permanecen en el
  payload de calidad, pero no se muestran en el cuerpo directivo.
- **Cupos ofrecidos (rótulo directivo):** alias de presentación de
  `capacity.operational`. Reúne cupos fijos publicados y participación registrada
  en ofertas sin límite prefijado. No cambia la fórmula canónica ni convierte el
  componente realizado en vacantes históricas.

La resolución de institución usa, en este orden, `institucion_id` directo,
institución inequívoca de la práctica y coincidencia exacta del nombre
normalizado. Los registros cuyos nombres representan espacios de una misma
institución se consolidan mediante su nombre institucional canónico; por ejemplo,
`Institución Fernando Ulloa - Ateneos` y `Institución Fernando Ulloa -
Entrevistas de Admisión` integran una sola fila `Institución Fernando Ulloa`.
No usa coincidencia difusa. Las filas no resueltas se conservan como
`pending_mapping`; una fecha de vencimiento incoherente se muestra como
`inconsistent_expiry`, y la ausencia de convenio como `pending_agreement`.

Los componentes internos de cupos fijos y participación realizada deben seguir
reconciliando con `capacity.operational`, aunque la tabla directiva muestre una
sola fila “Cupos ofrecidos”. Los conteos de estudiantes se reconcilian como
conjuntos distintos: por año dentro de cada columna y nuevamente entre años para
el total. El reporte no
incluye nombres, documentos ni correos de estudiantes.
