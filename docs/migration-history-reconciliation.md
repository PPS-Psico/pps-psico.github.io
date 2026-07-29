# Reconciliación del historial de migraciones

Fecha de cierre técnico: 29 de julio de 2026. Proyecto: `qxnxtnhtbpsgzprqtrjl`.

## Resultado

- Producción y repositorio contienen las mismas 111 versiones canónicas (`20260104152920`–`20260728183153`).
- La matriz `version:name` local/remota tiene fingerprint idéntico: `f4d985c76fbee242d18b03dd9465a468`.
- Cinco statements divergentes se reconstruyeron literalmente desde producción; sus variantes locales quedaron en `supabase/reference/legacy/`.
- Se recuperó el SQL real UTF-8 de `20260104152920`; el blob corrupto quedó preservado como referencia.
- El estado anterior al ledger vive en `supabase/reference/bootstrap/20251217_initial_public_schema.sql`.
- Veinte overlays cronológicos reconstruyen objetos comprobados que fueron creados fuera del ledger; nunca se registran como migraciones productivas.
- El harness `scripts/replay-migrations.mjs` usa un único PostgreSQL 17.6 descartable, sin red ni puertos publicados, con crons desactivados y limpieza garantizada.

## Replay verificado

`npm run check:migrations:replay` aplica 111/111 migraciones y registra solo esas 111 en `supabase_migrations.schema_migrations`. La plataforma local reproduce Auth/Storage mínimos y `pg_trgm`; no contiene datos productivos.

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
