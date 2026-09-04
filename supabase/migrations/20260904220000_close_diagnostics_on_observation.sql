begin;

-- `moodle_jefe_unmatched_diagnostics` es append-only: registra que una fila de
-- Moodle no se pudo atribuir, pero nada la cierra cuando un barrido posterior sí
-- la atribuye. Medido hoy, después de las tres corridas de jefatura: 114 filas
-- en `pending`/`needs_review`, de las cuales 64 ya tenían observación atribuida.
-- La cola se ve casi el doble de grande de lo que es, y el error crece con cada
-- barrido. Para la jefatura eso es peor que no tener cola: aprende a ignorarla.
--
-- El cierre va como trigger sobre `moodle_grade_observations` y no dentro del
-- sync de jefatura a propósito: así cubre TODAS las vías por las que puede
-- llegar una atribución (barrido de jefatura, puente del alumno, vinculaciones
-- manuales), no sólo la que hoy conocemos. Es a nivel sentencia porque las
-- observaciones se insertan en lote.

-- Estado nuevo y propio. No se reusa `auto_linked`, que significa otra cosa: que
-- el diagnóstico derivó en la creación de un vínculo. Acá el diagnóstico queda
-- sin efecto porque la entrega terminó atribuida por otra vía.
alter table private.moodle_jefe_unmatched_diagnostics
  drop constraint if exists moodle_jefe_unmatched_resolution_status_check;

alter table private.moodle_jefe_unmatched_diagnostics
  add constraint moodle_jefe_unmatched_resolution_status_check
  check (resolution_status = any (array[
    'pending', 'auto_linked', 'ignored_no_area_practice', 'needs_review',
    'resolved_by_observation'
  ]::text[]));

create or replace function private.close_moodle_diagnostics_on_observation_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  with atribuidas as (
    select distinct on (n.estudiante_id, n.cmid)
      n.estudiante_id, n.cmid, n.practica_id, n.id as observation_id,
      n.parser_version, n.observed_at
    from new_rows n
    where n.practica_id is not null
      and n.estudiante_id is not null
    order by n.estudiante_id, n.cmid, n.observed_at desc, n.id desc
  )
  update private.moodle_jefe_unmatched_diagnostics d
  set resolution_status   = 'resolved_by_observation',
      resolved_practica_id = a.practica_id,
      resolved_at          = now(),
      resolution_evidence  = jsonb_build_object(
        'source',         'observation_trigger',
        'observation_id', a.observation_id,
        'cmid',           a.cmid,
        'parser_version', a.parser_version,
        'observed_at',    a.observed_at
      )
  from atribuidas a
  where d.estudiante_id = a.estudiante_id
    and d.cmid = a.cmid
    and d.resolution_status in ('pending', 'needs_review');

  return null;
end
$fn$;

drop trigger if exists moodle_observation_closes_diagnostics on public.moodle_grade_observations;
create trigger moodle_observation_closes_diagnostics
after insert on public.moodle_grade_observations
referencing new table as new_rows
for each statement
execute function private.close_moodle_diagnostics_on_observation_v1();

-- Backfill de lo acumulado. Cierra todo diagnóstico abierto cuyo (alumno, cmid)
-- ya tenga una observación atribuida a una práctica.
with atribuidas as (
  select distinct on (o.estudiante_id, o.cmid)
    o.estudiante_id, o.cmid, o.practica_id, o.id as observation_id,
    o.parser_version, o.observed_at
  from public.moodle_grade_observations o
  where o.practica_id is not null
    and o.estudiante_id is not null
  order by o.estudiante_id, o.cmid, o.observed_at desc, o.id desc
)
update private.moodle_jefe_unmatched_diagnostics d
set resolution_status   = 'resolved_by_observation',
    resolved_practica_id = a.practica_id,
    resolved_at          = now(),
    resolution_evidence  = jsonb_build_object(
      'source',         'backfill_20260904220000',
      'observation_id', a.observation_id,
      'cmid',           a.cmid,
      'parser_version', a.parser_version,
      'observed_at',    a.observed_at
    )
from atribuidas a
where d.estudiante_id = a.estudiante_id
  and d.cmid = a.cmid
  and d.resolution_status in ('pending', 'needs_review');

commit;
