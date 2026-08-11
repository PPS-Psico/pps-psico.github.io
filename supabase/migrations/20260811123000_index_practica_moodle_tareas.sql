begin;

create index if not exists practica_moodle_tareas_aula_entrega_id_idx
  on public.practica_moodle_tareas (aula_entrega_id);

create index if not exists practica_moodle_tareas_validated_by_idx
  on public.practica_moodle_tareas (validated_by)
  where validated_by is not null;

commit;
