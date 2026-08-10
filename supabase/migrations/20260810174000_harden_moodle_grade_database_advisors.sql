revoke all on function public.strip_student_declared_finalization_grades()
  from public, anon, authenticated;

drop policy if exists "Students read own Moodle observations"
  on public.moodle_grade_observations;
drop policy if exists "Admins read Moodle observations"
  on public.moodle_grade_observations;
create policy "Authorized users read Moodle observations"
  on public.moodle_grade_observations
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.estudiantes e
      where e.id = estudiante_id
        and e.user_id = (select auth.uid())
    )
  );

drop policy if exists "Students read own Moodle snapshots"
  on public.moodle_grade_snapshots;
drop policy if exists "Admins read Moodle snapshots"
  on public.moodle_grade_snapshots;
create policy "Authorized users read Moodle snapshots"
  on public.moodle_grade_snapshots
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.estudiantes e
      where e.id = estudiante_id
        and e.user_id = (select auth.uid())
    )
  );

create index if not exists moodle_grade_observations_auth_received_idx
  on public.moodle_grade_observations (auth_user_id, received_at desc);
create index if not exists moodle_grade_observations_launch_idx
  on public.moodle_grade_observations (lanzamiento_id);
create index if not exists moodle_grade_observations_delivery_idx
  on public.moodle_grade_observations (aula_entrega_id);

create index if not exists moodle_grade_snapshots_launch_idx
  on public.moodle_grade_snapshots (lanzamiento_id);
create index if not exists moodle_grade_snapshots_delivery_idx
  on public.moodle_grade_snapshots (aula_entrega_id);
create index if not exists moodle_grade_snapshots_latest_observation_idx
  on public.moodle_grade_snapshots (latest_observation_id);
