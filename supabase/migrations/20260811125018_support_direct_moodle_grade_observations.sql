begin;

-- Legacy practices can have an explicit, confirmed task in
-- practica_moodle_tareas without a trustworthy launch. The observation ledger
-- must preserve that fact instead of inventing a launch relationship.
alter table public.moodle_grade_observations
  alter column lanzamiento_id drop not null;

alter table public.moodle_grade_snapshots
  alter column lanzamiento_id drop not null;

comment on column public.moodle_grade_observations.lanzamiento_id is
  'Lanzamiento asociado cuando existe; NULL para tareas legacy vinculadas directamente a la practica.';

comment on column public.moodle_grade_snapshots.lanzamiento_id is
  'Lanzamiento asociado cuando existe; NULL para snapshots de una vinculacion directa practica-tarea.';

commit;
