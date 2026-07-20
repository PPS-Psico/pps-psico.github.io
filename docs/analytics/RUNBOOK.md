# Runbook de `analytics-v2`

## Componentes

- RPC canónico visible: `public.get_analytics_v2(p_year, p_cutoff)`.
- Base preservada: `public.get_analytics_v1(p_year, p_cutoff)`.
- Drilldown histórico: `public.get_historical_launch_offer_list(p_year, p_cutoff)`.
- Hook consumidor común: `src/hooks/useMetricsData.ts`.
- Detalles reconciliados: wrappers staff `get_estudiantes_en_pps_list` y
  `get_finalizados_list`.
- Cierre atómico: `public.close_selection(p_lanzamiento_id)`.
- Snapshots: `public.analytics_metric_snapshots`.
- Ejecuciones: `public.analytics_snapshot_runs`.
- Salud: `public.analytics_health_checks` y `public.get_analytics_health()`.
- Auditoría: `public.selection_decision_events` y `public.selection_cycle_events`.
- Cron: `analytics-v1-daily-snapshot`, todos los días a las 09:00 UTC. Los
  snapshots de stocks permanecen en v1 porque la superposición histórica v2 es
  determinística y se calcula en lectura; no se reescribe la serie existente.
- Cron de salud: `analytics-daily-health-check`, todos los días a las 10:05 UTC.
  Respeta una hora de gracia y publica warning/critical en las notificaciones admin.

Las funciones con privilegios y triggers viven en el esquema `private`, no expuesto
por la API. Las tablas públicas nuevas tienen RLS y lectura sólo para staff admin.

## Verificación diaria

```sql
select public.get_analytics_v2(extract(year from current_date)::integer, current_date);

select snapshot_date, metric_version, metric_key, value, taken_at
from public.analytics_metric_snapshots
order by snapshot_date desc, metric_key;

select started_at, finished_at, status, rows_written, error_message
from public.analytics_snapshot_runs
order by id desc
limit 10;

select public.get_analytics_health();
```

Resultado esperado: una ejecución `success` por día y dos filas de stock para la
fecha actual. El chequeo de salud no debe quedar `critical`. Para fuentes
operativas, la función debe cumplir `operational = fixed_offered + realized`.

Control de regresión 2024 con sesión staff:

```sql
select
  p #>> '{capacity,launches}' as offers,
  p #>> '{capacity,operational}' as documented_capacity,
  p #>> '{capacity,capacity_complete}' as capacity_complete,
  p #>> '{capacity,source}' as source
from (select public.get_analytics_v2(2024, date '2024-12-31') as p) as q;
```

Resultado esperado: `42`, `270`, `false`, `historical_documented_offers`.

## Verificación de calidad

Revisar en la respuesta `quality`:

- `selected_at_coverage_pct`;
- `practice_launch_link_coverage_pct`;
- `launch_institution_link_coverage_pct`;
- `capacity.fixed_over_capacity_launches`.
- `capacity.source`, `capacity_complete` y `comparable`;
- `historical_offer_mapping_coverage_pct` y `historical_offer_review_needed`.

Un cero histórico no debe interpretarse como ausencia del fenómeno si
`demand_available = false` o la cobertura del vínculo es insuficiente.

## Validación segura del cierre de selección

Ejecutar `supabase/tests/selection_close_contract.sql` con el SQL runner o MCP.
El contrato:

- crea un lanzamiento y tres estudiantes con identificadores aleatorios;
- cambia a una sesión `authenticated` staff para atravesar las RLS reales;
- cierra 1 seleccionado y 2 pendientes mediante `close_selection`;
- comprueba timestamps, actor y bitácoras de decisión/ciclo;
- reabre la mesa y valida el evento;
- finaliza siempre con `ROLLBACK`.

Después de una ejecución correcta, esta consulta debe devolver cero en ambos
campos:

```sql
select
  (select count(*) from public.lanzamientos_pps
   where nombre_pps = '[TEST] Contrato de cierre') as test_launches,
  (select count(*) from public.estudiantes
   where nombre like '[TEST] %') as test_students;
```

Las notificaciones se validan en Jest mediante dependencias simuladas. El contrato
SQL no abre la aplicación ni invoca proveedores externos, por lo que no puede
enviar emails o push.

## Fallo del snapshot

1. Consultar la última fila `error` de `analytics_snapshot_runs`.
2. Ejecutar manualmente el RPC para aislar si falla el contrato o la escritura.
3. Corregir mediante una nueva migración; no editar funciones directamente sin archivo local.
4. Reintentar con privilegios de operador:

```sql
select private.take_analytics_v1_snapshot();
```

La escritura es idempotente por fecha, versión, métrica y dimensión.

Después de recuperar el snapshot, volver a evaluar la salud:

```sql
select private.run_analytics_health_check('manual');
```

La nueva fila reemplaza la alerta visible como último estado; no se borra el
historial anterior. Umbrales y severidades completos en
[OBSERVABILITY.md](./OBSERVABILITY.md).

## Cambios de definición

1. Crear una versión nueva; no cambiar silenciosamente v1 ni v2.
2. Actualizar `METRIC_DICTIONARY.md` y las notas del reporte.
3. Regenerar tipos con `npm run gen-types`.
4. Reconciliar al menos dos años y un corte YTD contra SQL agregado.
5. Ejecutar type-check, tests, lint y build.
6. Iniciar snapshots con la nueva versión sólo si cambia la semántica de los
   stocks; nunca reescribir los anteriores.

## Recuperación

Las migraciones son aditivas. Si la superposición histórica falla, la UI puede
volver temporalmente a `get_analytics_v1`, sabiendo que 2024 recuperará las cifras
legacy no comparables. No se deben borrar clasificaciones, fuentes, eventos ni
snapshots. Una reversión destructiva requiere backup y aprobación explícita.
