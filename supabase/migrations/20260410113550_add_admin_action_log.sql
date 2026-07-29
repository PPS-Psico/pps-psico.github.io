create table if not exists public.admin_action_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null references auth.users (id) on delete set null,
  actor_name text null,
  actor_legajo text null,
  action_type text not null,
  target_table text not null,
  target_id text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.admin_action_log enable row level security;

create index if not exists idx_admin_action_log_created_at
  on public.admin_action_log (created_at desc);

create index if not exists idx_admin_action_log_target
  on public.admin_action_log (target_table, target_id);

drop policy if exists "Admins can view action log" on public.admin_action_log;
create policy "Admins can view action log"
on public.admin_action_log
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can insert action log" on public.admin_action_log;
create policy "Admins can insert action log"
on public.admin_action_log
for insert
to authenticated
with check ((select public.is_admin()));

revoke update on table public.admin_action_log from authenticated;
revoke delete on table public.admin_action_log from authenticated;

comment on table public.admin_action_log is
  'Registro minimo de decisiones operativas del administrador para seguimiento interno.';