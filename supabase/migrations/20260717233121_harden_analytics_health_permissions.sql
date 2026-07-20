-- La migración inicial se aplicó antes de explicitar los privilegios de tabla.
-- RLS ya bloqueaba escrituras; esta capa agrega defensa en profundidad.

begin;

revoke all on table public.analytics_health_checks from anon, authenticated;
grant select on table public.analytics_health_checks to authenticated;
revoke all on sequence public.analytics_health_checks_id_seq from anon, authenticated;

commit;
