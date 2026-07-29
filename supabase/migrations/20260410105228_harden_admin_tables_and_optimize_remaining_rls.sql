-- Tighten remaining admin-only tables and optimize ownership policies.

-- backup_config should be admin-only and rely on the centralized helper.
drop policy if exists "Allow admin read backup_config" on public.backup_config;
drop policy if exists "Allow admin update backup_config" on public.backup_config;

create policy "Allow admin read backup_config"
on public.backup_config
for select
to authenticated
using ((select public.is_admin()));

create policy "Allow admin update backup_config"
on public.backup_config
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- email_templates is used by admin flows only.
drop policy if exists "Enable access for authenticated users" on public.email_templates;

create policy "Admin select email_templates"
on public.email_templates
for select
to authenticated
using ((select public.is_admin()));

create policy "Admin insert email_templates"
on public.email_templates
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admin update email_templates"
on public.email_templates
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admin delete email_templates"
on public.email_templates
for delete
to authenticated
using ((select public.is_admin()));

-- reminders remain self-service per user; optimize auth helper usage.
drop policy if exists "Users can view own reminders" on public.reminders;
drop policy if exists "Users can insert own reminders" on public.reminders;
drop policy if exists "Users can update own reminders" on public.reminders;
drop policy if exists "Users can delete own reminders" on public.reminders;

create policy "Users can view own reminders"
on public.reminders
for select
to authenticated
using (((select auth.uid()) = user_id));

create policy "Users can insert own reminders"
on public.reminders
for insert
to authenticated
with check (((select auth.uid()) = user_id));

create policy "Users can update own reminders"
on public.reminders
for update
to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

create policy "Users can delete own reminders"
on public.reminders
for delete
to authenticated
using (((select auth.uid()) = user_id));

-- compromisos_pps keeps the same access model:
-- student owns their row, admin roles can manage, reportero can read.
drop policy if exists "compromisos_pps_select_own_or_admin" on public.compromisos_pps;
drop policy if exists "compromisos_pps_insert_own_or_admin" on public.compromisos_pps;
drop policy if exists "compromisos_pps_update_own_or_admin" on public.compromisos_pps;

create policy "compromisos_pps_select_own_or_admin"
on public.compromisos_pps
for select
to authenticated
using (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = (select auth.uid())
      and e.role = any (array['SuperUser'::text, 'Jefe'::text, 'Directivo'::text, 'AdminTester'::text, 'Reportero'::text])
  )
);

create policy "compromisos_pps_insert_own_or_admin"
on public.compromisos_pps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = (select auth.uid())
      and e.role = any (array['SuperUser'::text, 'Jefe'::text, 'Directivo'::text, 'AdminTester'::text])
  )
);

create policy "compromisos_pps_update_own_or_admin"
on public.compromisos_pps
for update
to authenticated
using (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = (select auth.uid())
      and e.role = any (array['SuperUser'::text, 'Jefe'::text, 'Directivo'::text, 'AdminTester'::text])
  )
)
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = (select auth.uid())
      and e.role = any (array['SuperUser'::text, 'Jefe'::text, 'Directivo'::text, 'AdminTester'::text])
  )
);

-- Cover the backup_history foreign key used by admin/audit views.
create index if not exists idx_backup_history_created_by
on public.backup_history (created_by);
