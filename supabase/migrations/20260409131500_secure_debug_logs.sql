-- Containment-first hardening for public.debug_logs.
-- This table is still used by internal triggers, but it should not be readable
-- or writable from the public API except for authenticated admins.

alter table public.debug_logs enable row level security;

revoke all on table public.debug_logs from anon, authenticated;
grant select on table public.debug_logs to authenticated;

drop policy if exists "Admins can read debug logs" on public.debug_logs;

create policy "Admins can read debug logs"
on public.debug_logs
for select
to authenticated
using ((select public.is_admin()));
