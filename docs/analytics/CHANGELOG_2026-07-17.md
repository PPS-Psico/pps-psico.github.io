# Changelog analítico — 17 de julio de 2026

## Alcance

Primera implementación de la capa `analytics-v1`, construida después de auditar
Supabase productivo. No se reescribió historia ambigua ni se imputaron timestamps
que no existen.

## Base de datos

| Migración                                                      | Resultado                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `20260717183041_analytics_classification_and_capacity.sql`     | Clasifica PPS/actividad especial y capacidad fija/realizada.             |
| `20260717183046_solicitud_non_concretion_reason.sql`           | Agrega motivos controlados de no concreción.                             |
| `20260717185938_selection_instrumentation.sql`                 | Instrumenta decisiones, cierres, reaperturas y cierre atómico.           |
| `20260717190409_analytics_v1_rpc.sql`                          | Publica el contrato versionado de flujos, capacidad, stocks y calidad.   |
| `20260717191231_analytics_v1_snapshots.sql`                    | Crea snapshots normalizados, bitácora y cron diario.                     |
| `20260717191638_sync_practice_activity_type.sql`               | Sincroniza la clasificación entre lanzamiento y práctica.                |
| `20260717193022_align_analytics_drilldown_lists.sql`           | Alinea los detalles de inicios y finalizados con sus KPI.                |
| `20260717211658_backfill_2024_deterministic_links.sql`         | Vincula 68 instituciones y 317 prácticas 2024 con guardas exactas.       |
| `20260717212025_create_historical_launch_layer.sql`            | Crea la capa privada y carga 42 ofertas, slots, miembros y eventos.      |
| `20260717213000_publish_analytics_v2.sql`                      | Publica oferta histórica canónica, procedencia y comparabilidad.         |
| `20260717213500_add_analytics_fk_indexes.sql`                  | Cubre las claves foráneas nuevas señaladas por el asesor de rendimiento. |
| `20260717223000_cleanup_2024_legacy_entities.sql`              | Reconstruye 11 filas, vincula 44 prácticas y cierra las 20 revisiones.   |
| `20260717225321_cleanup_2024_plottier_institution.sql`         | Consolida Plottier y completa la cobertura institucional 80/80.          |
| `20260717232717_analytics_health_monitoring.sql`               | Agrega salud diaria, historial, RPC staff y cron a las 10:05 UTC.        |
| `20260717233121_harden_analytics_health_permissions.sql`       | Limita el historial a lectura staff con privilegios explícitos.          |
| `20260717233525_drop_unused_analytics_health_status_index.sql` | Elimina un índice sin patrón de consulta ni beneficio operativo.         |

## Aplicación

- Los tableros Admin, Directivo, Jefe y Reportero consumen los flujos y la
  capacidad de `analytics-v2` mediante el hook común.
- Los comparativos del año en curso usan el mismo día y mes para todos los años.
- La orientación se calcula sobre prácticas iniciadas; una persona puede aportar
  una mención a más de un área.
- Los reportes y descargas excluyen actividades especiales, usan capacidad
  operativa y cuentan finalizaciones efectivas.
- El formulario de lanzamiento exige tipo de actividad y modalidad de capacidad.
- Las solicitudes no concretadas exigen motivo; `Otro` exige detalle.
- El Lanzador cierra la selección mediante una operación atómica y auditable.
- El cierre principal y el cierre desde el menú lateral comparten la misma
  orquestación y encolan las mismas notificaciones.
- El centro de notificaciones admin muestra el último warning/critical de
  analytics y enlaza a la vista de Métricas.
- Se corrigió el import faltante del WIP previo de horarios obligatorios que
  impedía completar una inscripción estudiantil en el test de integración.

## Reconciliación productiva

Al 17/07/2026:

- 190 estudiantes iniciaron una PPS;
- 28 estudiantes finalizaron efectivamente;
- 41 lanzamientos PPS;
- capacidad operativa 492 = 243 fija + 249 realizada;
- los modales de detalle devuelven 190 y 28 filas respectivamente;
- orientaciones: Clínica 164, Educacional 58, Laboral 44 y Comunitaria 19
  menciones.

## Validación

- contrato SQL `supabase/tests/analytics_v1_contract.sql`: aprobado;
- `npm run gen-types`: ejecutado contra el proyecto productivo;
- `npm run type-check`: aprobado;
- `npm run lint`: aprobado;
- Jest: 37 suites, 391 tests aprobados;
- build Vite: aprobado, 2.673 módulos transformados.
- contrato SQL `analytics_v2_historical_contract.sql`: aprobado sobre datos productivos.
- contrato SQL `selection_close_contract.sql`: aprobado con fixtures y `ROLLBACK`.
- contrato SQL `analytics_health_contract.sql`: aprobado sobre el primer chequeo productivo.
- asesores Supabase: sin funciones nuevas privilegiadas expuestas y sin claves
  foráneas nuevas sin índice; permanecen advertencias preexistentes fuera del alcance.

La prueba funcional controlada quedó completada con fixtures transaccionales y
`ROLLBACK`: validó RLS staff, conteos, timestamps, auditoría y reapertura sin
persistir registros. La cola de notificaciones se cubrió con cuatro pruebas y
proveedores simulados, sin emails ni push reales.

## Evidencia histórica 2024

- Se incorporó un parser reproducible y privado por diseño para la exportación
  del grupo institucional de WhatsApp.
- Se documentaron 42 ofertas candidatas, 2 relanzamientos y 270 vacantes finitas
  publicadas, con referencias de línea y sin almacenar datos personales.
- Se conciliaron las 42 ofertas con 60 filas legacy y se reconstruyeron los 9
  lanzamientos documentados faltantes.
- Se aplicaron 68 vínculos de institución y 317 vínculos de práctica
  determinísticos, con transacción, conteos exactos y verificación de triggers.
- Se cargaron las 42 ofertas en tablas privadas; ninguna evidencia cruda ni dato
  personal del chat se persistió.
- `analytics-v2` publica 42 ofertas y 270 vacantes finitas para el año completo;
  al 17 de julio publica 24 y 118.
- La UI y los drilldowns usan el mismo universo. Cuando una comparación mezcla
  oferta documental con filas operativas, la variación se marca `n/c`.
- Las 363 prácticas PPS 2024 quedaron vinculadas y los 80 lanzamientos 2024 tienen
  institución; no quedan fechas invertidas ni ofertas en revisión.
