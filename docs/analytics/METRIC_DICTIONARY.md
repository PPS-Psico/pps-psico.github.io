# Diccionario de métricas

Versión vigente: `analytics-v2` — 2026-07-17. Versión base preservada:
`analytics-v1`.

Contrato ejecutable: `public.get_analytics_v2(p_year, p_cutoff)`. La salida
incluye `metric_version`, `cutoff`, `as_of`, `flows`, `capacity`, `stocks` y
`quality`. Los comparativos y KPI visibles consumen este RPC. V2 conserva los
flujos y stocks de v1 y agrega fuente, completitud y comparabilidad de la oferta.

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

## Snapshots

`analytics_metric_snapshots` guarda una fila por fecha, versión y métrica. La
versión inicial captura diariamente `active_students` y
`active_students_with_current_pps`. No se permite reconstruir retrospectivamente
un stock ni guardar como snapshot el JSON del RPC legado.
