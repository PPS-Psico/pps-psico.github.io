begin;

create table public.moodle_grade_import_batches (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  file_name text not null check (char_length(file_name) between 1 and 180),
  source_type text not null default 'moodle_export_verified'
    check (source_type in ('moodle_export_verified', 'moodle_api_verified')),
  observed_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'partial', 'failed')),
  row_count integer not null check (row_count between 1 and 500),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  observation_count integer not null default 0 check (observation_count >= 0),
  snapshot_count integer not null default 0 check (snapshot_count >= 0),
  details jsonb not null default '{}'::jsonb
);

alter table public.moodle_grade_import_batches enable row level security;
revoke all on table public.moodle_grade_import_batches from anon, authenticated;
grant select on table public.moodle_grade_import_batches to authenticated;
grant select, insert, update on table public.moodle_grade_import_batches to service_role;

create policy "Admins read Moodle grade import batches"
  on public.moodle_grade_import_batches
  for select to authenticated
  using ((select public.is_admin()));

create index moodle_grade_import_batches_created_idx
  on public.moodle_grade_import_batches (created_at desc);
create index moodle_grade_import_batches_problem_idx
  on public.moodle_grade_import_batches (created_at desc, status)
  where status in ('partial', 'failed');

comment on table public.moodle_grade_import_batches is
  'Auditoria de conciliaciones masivas normalizadas desde exportaciones o API Moodle. El archivo original no se almacena.';

commit;
