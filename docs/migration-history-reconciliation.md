# Reconciliación del historial de migraciones

Fecha de última verificación: 1 de agosto de 2026. Proyecto: `qxnxtnhtbpsgzprqtrjl`.

## Resultado

- Producción y repositorio contienen las mismas 116 versiones canónicas (`20260104152920`–`20260801135057`).
- Las primeras 111 entradas conservan el fingerprint `version:name` verificado
  en el cierre inicial: `f4d985c76fbee242d18b03dd9465a468`.
- Cinco statements divergentes se reconstruyeron literalmente desde producción; sus variantes locales quedaron en `supabase/reference/legacy/`.
- Se recuperó el SQL real UTF-8 de `20260104152920`; el blob corrupto quedó preservado como referencia.
- El estado anterior al ledger vive en `supabase/reference/bootstrap/20251217_initial_public_schema.sql`.
- Veinte overlays cronológicos reconstruyen objetos comprobados que fueron creados fuera del ledger; nunca se registran como migraciones productivas.
- El harness `scripts/replay-migrations.mjs` usa un único PostgreSQL 17.6 descartable, sin red ni puertos publicados, con crons desactivados y limpieza garantizada.

## Actualización posterior al cierre inicial

Después del cierre inicial de 111 versiones se importaron literalmente desde el
ledger `20260729182222_make_student_documents_private`,
`20260730120000_add_secure_solicitudes_student_rpcs` y
`20260731120000_restore_metrics_private_wrappers`. Las migraciones
`20260801135043_allow_admin_delete_disapproved_pps` y
`20260801135057_stop_auto_archiving_lanzamientos` se aplicaron y verificaron el
1 de agosto. `supabase migration list --linked` confirmó 116 pares local/remoto
sin versiones huérfanas.

## Replay verificado

El 1 de agosto, `npm run check:migrations:replay:contracts` aplicó 116/116
migraciones y los 20 overlays en PostgreSQL 17.6. Los cuatro contratos portables
pasaron. La plataforma local reproduce Auth/Storage mínimos y `pg_trgm`; no
contiene datos productivos ni ejecuta los cron jobs durante el replay.

`npm run check:migrations:replay:contracts` pasa estos contratos portables:

- `analytics_v1_contract.sql`;
- `director_report_v1_contract.sql`;
- `interview_completion_candidates_v1_contract.sql`;
- `selection_close_contract.sql`.

No se falsean `analytics_v2_historical_contract.sql` (requiere dataset 2024) ni `analytics_health_contract.sql` (requiere snapshots diarios recientes).

## Adaptaciones schema-only

- `20260717211849` y `20260717225419`: se omiten reconciliaciones de datos productivos.
- `20260717212308`: se ejecuta solo el DDL anterior al primer `INSERT` histórico.
- `20260717225039`: se reproducen solo columnas y comentarios persistentes.
- `aula_entregas`: se reconstruye tabla/RLS sin copiar su seed de Moodle.

## Diferencias productivas explicadas

- Producción conserva seis FKs legacy duplicadas (`fk_convocatoria_*`, `fk_finalizacion_estudiante`, `fk_penalizacion_estudiante`, `fk_practica_*`). No se recrean porque no agregan integridad y el historial canónico ya produce sus equivalentes.
- `check-launches-every-10min` fue configurado fuera del ledger. El replay no copia su comando ni credenciales y no inventa un job sustituto; los otros cinco jobs sí quedan registrados, siempre inactivos localmente.
- Storage alojado agrega las columnas de plataforma `avif_autodetection` y `type`; el catálogo mínimo local incluye solo columnas referenciadas por el proyecto. Las diez políticas propias sí se reconstruyen.
- Las 31 funciones públicas adicionales son propiedad de `pg_trgm`, no lógica de negocio.

## Guardrails y rollback

No ejecutar `db push`, `migration repair`, `db reset --linked` ni estos SQL de referencia contra producción. Para limpiar el replay basta eliminar su contenedor descartable; el harness lo hace incluso ante error. No se requiere Preview Branch paga ni `restore-backup`.

CI ejecuta el chequeo liviano `npm run check:migrations`. El replay completo queda como validación local/manual por el costo de descargar e inicializar la imagen PostgreSQL; el comando es reproducible y no necesita secretos.

## Migraciones Moodle v2 aplicadas · 20 de agosto de 2026

- `20260820100000_create_moodle_task_intents_and_participants.sql`: tablas
  públicas/privadas, RLS, índices, helpers, RPC, leases, resumen y triggers.
- `20260820101000_backfill_legacy_moodle_task_intents.sql`: backfill exacto
  2024–2026 sin mutar tareas del Campus.
- `20260820110500_harden_moodle_v2_advisors.sql`: índices de FKs y policies
  explícitas `service_role` para los ledgers privados.

Después de aplicarlas se regeneró `src/types/supabase.ts`. El contrato
`supabase/tests/moodle_v2_schema_contract.sql` pasó contra el schema productivo.
