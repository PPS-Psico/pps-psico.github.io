-- Close the Moodle v2 advisor findings without widening application access.

create index if not exists moodle_task_expected_practice_idx
  on public.moodle_task_expected_participants (practica_id);

create index if not exists moodle_task_expected_replacement_idx
  on public.moodle_task_expected_participants (replaces_participant_id)
  where replaces_participant_id is not null;

create index if not exists moodle_task_expected_created_by_idx
  on public.moodle_task_expected_participants (created_by)
  where created_by is not null;

drop policy if exists "Service role manages Moodle agent runs"
  on private.moodle_agent_runs;
create policy "Service role manages Moodle agent runs"
  on private.moodle_agent_runs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role manages Moodle agent run items"
  on private.moodle_agent_run_items;
create policy "Service role manages Moodle agent run items"
  on private.moodle_agent_run_items
  for all
  to service_role
  using (true)
  with check (true);
