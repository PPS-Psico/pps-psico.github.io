-- Los consumidores consultan siempre el último chequeo por fecha. El índice por
-- estado no participa en ningún acceso y sólo agrega costo de escritura.

begin;

drop index if exists public.analytics_health_checks_status_checked_at_idx;

commit;
