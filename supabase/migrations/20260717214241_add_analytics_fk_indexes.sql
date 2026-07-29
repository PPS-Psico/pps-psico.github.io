-- Indices de cobertura para claves foraneas de la capa analitica.

begin;

create index if not exists historical_launch_offers_source_idx
  on private.historical_launch_offers (source_id);

create index if not exists selection_decision_events_convocatoria_idx
  on public.selection_decision_events (convocatoria_id);

create index if not exists selection_decision_events_estudiante_idx
  on public.selection_decision_events (estudiante_id);

commit;
