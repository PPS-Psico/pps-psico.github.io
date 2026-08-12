-- Cover every Moodle-workflow foreign key that participates in reconciliation,
-- audit lookups or referential actions. These indexes are deliberately narrow.
create index if not exists moodle_grade_import_batches_requested_by_idx
  on public.moodle_grade_import_batches (requested_by);

create index if not exists moodle_grade_reopen_events_requested_by_idx
  on public.moodle_grade_reopen_events (requested_by);

create index if not exists moodle_grade_snapshots_last_observation_idx
  on public.moodle_grade_snapshots (last_observation_id);

create index if not exists moodle_sync_runs_auth_user_idx
  on public.moodle_sync_runs (auth_user_id);

create index if not exists lanzamiento_moodle_tareas_aula_entrega_id_idx
  on public.lanzamiento_moodle_tareas (aula_entrega_id);

create index if not exists lanzamiento_moodle_tareas_validated_by_idx
  on public.lanzamiento_moodle_tareas (validated_by);

create index if not exists moodle_practice_link_repair_audit_previous_launch_idx
  on private.moodle_practice_link_repair_audit (previous_lanzamiento_id);

create index if not exists moodle_practice_link_repair_audit_repaired_launch_idx
  on private.moodle_practice_link_repair_audit (repaired_lanzamiento_id);

create index if not exists moodle_signup_tickets_auth_user_idx
  on public.moodle_signup_tickets (auth_user_id);
