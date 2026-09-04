# SQL de referencia

Esta carpeta contiene evidencia y SQL para auditoría/replay local. **Nada bajo `supabase/reference/` forma parte del historial productivo ni debe desplegarse.**

## Bootstrap local

- `bootstrap/20251217_initial_public_schema.sql`: estado mínimo comprobado anterior al ledger remoto.
- `bootstrap/platform/supabase_platform_compat.sql`: compatibilidad local de Auth, Storage y `pg_trgm` para la imagen PostgreSQL cruda.
- `bootstrap/overlays/`: 20 objetos cronológicos comprobados que existen en producción pero fueron creados fuera del ledger.

El harness intercala overlays por timestamp, pero registra exclusivamente los archivos de `supabase/migrations/` incluidos en el replay dentro de `supabase_migrations.schema_migrations`. Los overlays son schema-only: no copian PII, seeds ni datos históricos.

## Variantes legacy

- `metrics_rpcs.sql`: snapshot histórico de funciones de métricas.
- `legacy/`: statements locales que difieren del historial remoto y artefactos preservados para auditoría.
- `legacy/local-only/20260703130325_create_aula_entregas_table_with_seed.sql`: script original ejecutado fuera del ledger; el replay usa un overlay sin seed.
- `legacy/local-only/20260413120000_add_consentimiento_tracking_and_cron.sql`: agregado local reemplazado por cinco migraciones remotas canónicas; no ejecutar.

## Reglas

- `supabase/migrations/` debe contener únicamente migraciones remotas canónicas con nombre `YYYYMMDDHHMMSS_nombre.sql`; el conteo se verifica contra el ledger vivo y no se fija en este documento.
- Un timestamp no puede repetirse entre migraciones y overlays.
- No mover archivos de referencia a `supabase/migrations/` ni aplicarlos en Supabase alojado.
- Cambios nuevos de producción requieren una migración nueva aplicada por MCP, seguida por `npm run gen-types` y `npm run type-check`.
- El replay debe ejecutarse con `npm run check:migrations:replay` o `npm run check:migrations:replay:contracts`; nunca contra la base enlazada.
- El contenedor usa `--network none`, no publica puertos, desactiva ejecución cron y se elimina al finalizar.

La explicación de fingerprints, adaptaciones schema-only, diferencias productivas y rollback está en `docs/migration-history-reconciliation.md`.
