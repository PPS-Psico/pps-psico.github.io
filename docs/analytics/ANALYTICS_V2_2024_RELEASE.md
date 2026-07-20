# Analytics v2 y reconstrucción de la oferta PPS 2024

Fecha de publicación: 17 de julio de 2026.

## Resultado

La oferta PPS 2024 ya no se mide contando filas técnicas de
`lanzamientos_pps`. El contrato `analytics-v2` usa una oferta canónica reconstruida
desde la fuente institucional y conserva el modelo anterior únicamente como
diagnóstico.

| Medida 2024                                         | Resultado |
| --------------------------------------------------- | --------: |
| Ofertas publicadas canónicas                        |        42 |
| Ofertas con vacante finita                          |        36 |
| Vacantes finitas documentadas                       |       270 |
| Ofertas abiertas, realizadas o sin total finito     |         6 |
| Cobertura de oferta con capacidad finita            |     85,7% |
| Ofertas vinculadas con una o más filas legacy       |        42 |
| Vínculos conservados con filas legacy               |        60 |
| Cobertura de conciliación con filas legacy          |      100% |
| Ofertas que conservan una observación para revisión |         0 |
| Relanzamientos deduplicados                         |         2 |
| Slots conservados                                   |        31 |

Al corte comparable del 17 de julio de 2024, el contrato devuelve 24 ofertas y
118 vacantes finitas documentadas.

## Cambio respecto del cálculo anterior

Para el año completo, el cálculo operativo legacy devolvía 69 filas y 332 plazas.
No era un error aritmético: mezclaba oferta publicada, cohortes, slots y
realización en un mismo grano. El valor visible pasa a ser:

- `42` ofertas publicadas, con relanzamientos deduplicados;
- `270` vacantes documentadas como **mínimo**, no como capacidad total completa;
- demanda y seleccionados por oferta como no disponibles mientras no exista una
  conciliación de resultados aprobada.

Por esta razón `capacity.comparable = false` para 2024. La interfaz muestra los
valores, pero no calcula una variación contra años que usan filas operativas; en
esos casos informa `n/c`.

## Contrato ejecutable

RPC principal:

```sql
select public.get_analytics_v2(2024, date '2024-12-31');
```

Drilldown coherente con el KPI:

```sql
select public.get_historical_launch_offer_list(2024, date '2024-12-31');
```

Campos agregados en `capacity`:

- `source`: `historical_documented_offers` u `operational_launches`;
- `date_basis`: `announcement_at` o `launch_start_date`;
- `capacity_complete`: indica si todas las ofertas tienen un total finito;
- `comparable`: habilita o bloquea variaciones entre definiciones;
- `finite_offer_coverage_pct`;
- `documented_finite_offers`;
- `unknown_or_realized_offers`;
- `legacy_operational` y `legacy_launch_rows`, sólo para diagnóstico.

El contrato mantiene `flows`, `stocks` y los indicadores de calidad de v1. La
demanda histórica 2024 continúa con `demand_available = false`.

## Modelo y seguridad

La reconstrucción vive en el esquema no expuesto `private`:

- `historical_launch_sources`;
- `historical_launch_offers`;
- `historical_launch_slots`;
- `historical_launch_members`;
- `historical_launch_events`.

No se guardaron mensajes, remitentes, teléfonos, correos ni nombres de
participantes. Se conserva la huella SHA-256 de la fuente, referencias de
evidencia y atributos de convocatoria.

`anon` y `authenticated` no tienen `SELECT` sobre estas tablas. Los clientes
staff acceden mediante wrappers públicos `SECURITY INVOKER`; los helpers
privilegiados viven en `private`, usan `search_path = ''` y vuelven a validar
`public.is_staff()`.

## Cambios de aplicación

- Los hooks principales y los comparativos consumen `get_analytics_v2`.
- Las tarjetas cambian a “Ofertas PPS documentadas” y “Capacidad documentada”
  cuando la fuente es histórica.
- Los modales listan exactamente las 42 ofertas del KPI y distinguen vacantes
  finitas, participación realizada y capacidad desconocida.
- El anexo anual usa fecha de publicación para 2024 y no presenta ceros falsos
  de demanda o seleccionados.
- Las variaciones que mezclan oferta documental con filas operativas se marcan
  como no comparables.

## Backfills aplicados

- 80 de 80 lanzamientos PPS 2024 quedaron vinculados a una institución: cobertura
  100%.
- 363 de 363 prácticas PPS 2024 tienen lanzamiento: cobertura 100%.
- Las 44 prácticas inicialmente ambiguas se resolvieron mediante evidencia
  documental, decisiones de dominio y excepciones legacy explícitas.
- Las 9 ofertas documentadas sin fila operativa fueron reconstruidas como
  lanzamientos ocultos; SAU e Investigación interna se conservaron como modalidades
  históricas discontinuadas.
- Se consolidaron los duplicados maestros de UFLO y Municipalidad de Plottier.

## Validación

- Contrato SQL `analytics_v2_historical_contract.sql` aprobado.
- Resultado anual reconciliado: 42 ofertas, 270 vacantes finitas y 42 filas de
  drilldown.
- Resultado al 17/07: 24 ofertas y 118 vacantes finitas.
- Permisos verificados: sin lectura de tablas privadas para `anon` ni
  `authenticated`; RPC sólo para usuarios autenticados y validación staff.
- Tipos de Supabase regenerados y `npm run type-check` aprobado.
- Jest: 37 suites y 391 tests aprobados; lint sin errores; build Vite aprobado
  con 2.673 módulos transformados.
- Los asesores de Supabase no reportan funciones nuevas `SECURITY DEFINER`
  expuestas ni claves foráneas nuevas sin índice.

## Cierre de pendientes históricos

1. Las 20 ofertas observadas quedaron verificadas y con resolución auditada.
2. Las 42 ofertas tienen al menos una conciliación legacy; total: 60 vínculos.
3. Fútbol Valorado conserva 20 horas por confirmación académica final y corrigió
   únicamente las fechas invertidas.
4. Los lanzamientos reconstruidos guardan procedencia y resolución en
   `notas_gestion`; ninguna evidencia personal del chat fue persistida.
