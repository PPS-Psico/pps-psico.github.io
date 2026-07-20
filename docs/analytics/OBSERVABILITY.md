# Observabilidad de analytics

## Objetivo

Detectar una degradación de las estadísticas antes de que un tablero la presente
como un dato válido. La observabilidad no cambia definiciones ni corrige datos:
registra evidencia, clasifica severidad y la muestra al equipo administrativo.

## Flujo diario

```text
09:00 UTC  analytics-v1-daily-snapshot
     ↓     guarda dos stocks y una fila de ejecución
10:05 UTC  analytics-daily-health-check
     ↓     evalúa frescura, completitud y guardrails
Admin UI   muestra warning/critical en el centro de notificaciones
```

La hora de gracia evita declarar vencido un snapshot mientras todavía puede estar
ejecutándose. Supabase Cron registra además cada corrida en
`cron.job_run_details`.

## Componentes

| Componente                                       | Responsabilidad                                                |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `public.analytics_metric_snapshots`              | Stocks diarios normalizados                                    |
| `public.analytics_snapshot_runs`                 | Resultado funcional del snapshot                               |
| `public.analytics_health_checks`                 | Historial diario de salud, incidencias y contexto              |
| `private.evaluate_analytics_health(timestamptz)` | Evalúa sin persistir                                           |
| `private.run_analytics_health_check(text)`       | Persiste el resultado y aplica retención de 400 días           |
| `public.get_analytics_health()`                  | Devuelve el último chequeo a staff                             |
| `NotificationContext`                            | Publica warning/critical en las notificaciones administrativas |

## Umbrales versionados

Versión: `analytics-health-v1`.

| Control                           | Umbral                     | Severidad  |
| --------------------------------- | -------------------------- | ---------- |
| Cron ausente o inactivo           | cualquier ocurrencia       | `critical` |
| Última corrida con error          | cualquier ocurrencia       | `critical` |
| Corrida en `running`              | más de 30 minutos          | `critical` |
| Snapshot vencido                  | falta después de 10:00 UTC | `critical` |
| Filas del snapshot diario         | distinto de 2              | `critical` |
| Cobertura práctica–lanzamiento    | menor a 95%                | `warning`  |
| Cobertura lanzamiento–institución | menor a 95%                | `warning`  |
| Lanzamientos fijos sobre cupo     | uno o más                  | `warning`  |
| Cobertura `selected_at`           | menor a 90%                | `info`     |

Los controles `info` no degradan el estado global. Un `warning` sí genera una
notificación administrativa; un `critical` debe atenderse el mismo día.

## Estado inicial productivo

El primer chequeo del 17 de julio de 2026 quedó en `warning`:

- snapshot 2026-07-17 presente, dos filas y corrida `success`;
- cron de snapshots activo;
- coberturas de vínculos en 98,8% y 95,1%;
- 2 lanzamientos fijos sobre cupo, advertencia operativa;
- `selected_at` en 43,8%, indicador informativo y todavía experimental.

## Seguridad

- RLS habilitada en `analytics_health_checks`;
- `anon` no tiene acceso;
- `authenticated` conserva únicamente privilegio SQL `SELECT`;
- la política limita lectura a `public.is_admin()`;
- las funciones que evalúan o escriben viven en `private` y no son ejecutables
  por clientes;
- el único RPC público es `SECURITY INVOKER`, valida staff y es sólo lectura.

## Operación

Último chequeo:

```sql
select public.get_analytics_health();
```

Historial:

```sql
select checked_at, source, status, issue_count, issues
from public.analytics_health_checks
order by checked_at desc
limit 30;
```

Ejecución manual por operador desde SQL Editor/MCP:

```sql
select private.run_analytics_health_check('manual');
```

Ante un crítico, seguir el diagnóstico de snapshots en [RUNBOOK.md](./RUNBOOK.md)
y revisar `cron.job_run_details` y los logs Postgres. No editar el resultado del
chequeo para ocultar la alerta: se corrige la causa y se ejecuta un nuevo control.

## Validación

El contrato `supabase/tests/analytics_health_contract.sql` comprueba:

- versión y estado no crítico del chequeo productivo;
- snapshot igual o posterior al esperado;
- ausencia de incidencias críticas contradictorias;
- RPC no ejecutable por `anon`;
- historial no escribible por clientes;
- cron activo a las 10:05 UTC.

Referencia operativa: [Supabase Cron](https://supabase.com/docs/guides/cron).
