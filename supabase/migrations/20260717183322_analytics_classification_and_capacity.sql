-- Clasificación semántica para separar PPS, actividades especiales y
-- modalidades de capacidad sin reglas permanentes basadas en nombres.

begin;

alter table public.lanzamientos_pps
  add column if not exists tipo_actividad text not null default 'pps',
  add column if not exists modalidad_cupo text not null default 'fijo';

alter table public.lanzamientos_pps
  drop constraint if exists lanzamientos_pps_tipo_actividad_check,
  drop constraint if exists lanzamientos_pps_modalidad_cupo_check;

alter table public.lanzamientos_pps
  add constraint lanzamientos_pps_tipo_actividad_check
    check (tipo_actividad in ('pps', 'actividad_especial')),
  add constraint lanzamientos_pps_modalidad_cupo_check
    check (modalidad_cupo in ('fijo', 'realizado'));

alter table public.practicas
  add column if not exists tipo_actividad text not null default 'pps';

alter table public.practicas
  drop constraint if exists practicas_tipo_actividad_check;

alter table public.practicas
  add constraint practicas_tipo_actividad_check
    check (tipo_actividad in ('pps', 'actividad_especial'));

comment on column public.lanzamientos_pps.tipo_actividad is
  'Contrato analytics-v1: pps o actividad_especial. No inferir en runtime por nombre.';
comment on column public.lanzamientos_pps.modalidad_cupo is
  'fijo: cupos_disponibles es oferta; realizado: la capacidad se mide por seleccionados.';
comment on column public.practicas.tipo_actividad is
  'Contrato analytics-v1: clasifica el registro como pps o actividad_especial.';

-- Backfill transitorio y repetible. Estas reglas de texto viven solamente en la
-- migración; después la clasificación queda explícita y editable en los datos.
update public.lanzamientos_pps
set tipo_actividad = 'actividad_especial'
where translate(lower(coalesce(nombre_pps, '')), 'áéíóúüñ', 'aeiouun')
      ~ '(jornada|relevamiento)';

update public.lanzamientos_pps
set modalidad_cupo = 'realizado'
where tipo_actividad = 'pps'
  and coalesce(cupos_disponibles, 0) >= 50
  and translate(lower(coalesce(nombre_pps, '')), 'áéíóúüñ', 'aeiouun')
      ~ '(fundacion tiempo|ulloa)';

update public.practicas as p
set tipo_actividad = l.tipo_actividad
from public.lanzamientos_pps as l
where p.lanzamiento_id = l.id
  and p.tipo_actividad is distinct from l.tipo_actividad;

update public.practicas
set tipo_actividad = 'actividad_especial'
where lanzamiento_id is null
  and translate(lower(coalesce(nombre_institucion, '')), 'áéíóúüñ', 'aeiouun')
      ~ '(jornada|relevamiento)';

commit;
