-- Preserve the specific provenance of grades entered by an authorized area head.
-- The update RPC introduced in jefe_area_panel_v1 already writes this value; the
-- existing constraint predated that workflow and therefore needs to accept it.
alter table public.practicas
  drop constraint if exists practicas_nota_fuente_check;

alter table public.practicas
  add constraint practicas_nota_fuente_check
  check (nota_fuente is null or nota_fuente in (
    'moodle_session_observed',
    'moodle_export_verified',
    'moodle_api_verified',
    'legacy',
    'admin',
    'jefe_panel'
  ));

comment on column public.practicas.nota_fuente is
  'Procedencia de la calificacion academica aplicada: Moodle, carga legacy, admin o panel del jefe de area.';
