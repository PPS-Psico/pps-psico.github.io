begin;

create table if not exists private.moodle_practice_orientation_repair_audit (
  practice_id uuid primary key references public.practicas(id) on delete restrict,
  previous_orientation text,
  repaired_orientation text not null,
  assigned_schedule text not null,
  evidence_source text not null,
  repaired_at timestamptz not null default statement_timestamp()
);

revoke all on private.moodle_practice_orientation_repair_audit
  from public, anon, authenticated;

comment on table private.moodle_practice_orientation_repair_audit is
  'Bitácora privada de especialidades PPS reparadas desde el horario individual efectivamente asignado.';

-- Two imported Ministerio practices copied the complete list of offered slots
-- into `especialidad`, even though each student was assigned only the Laboral
-- slot. The assigned schedule is individual evidence and disambiguates which
-- of the two annual Moodle tasks belongs to the practice.
with candidates as (
  select p.id as practice_id,
         p.especialidad as previous_orientation,
         'Laboral'::text as repaired_orientation,
         c.horario_asignado as assigned_schedule
  from public.practicas p
  join public.convocatorias c
    on c.estudiante_id = p.estudiante_id
   and c.lanzamiento_id = p.lanzamiento_id
   and c.estado_inscripcion = 'Seleccionado'
  where p.tipo_actividad = 'pps'
    and translate(lower(coalesce(p.especialidad, '')), 'áéíóúüñ', 'aeiouun') like '%labor%'
    and translate(lower(coalesce(p.especialidad, '')), 'áéíóúüñ', 'aeiouun') like '%educ%'
    and c.horario_asignado ilike '%[Laboral]%'
    and c.horario_asignado not ilike '%[Educacional]%'
    and c.horario_asignado not ilike '%[Clínica]%'
    and c.horario_asignado not ilike '%[Comunitaria]%'
)
insert into private.moodle_practice_orientation_repair_audit (
  practice_id,
  previous_orientation,
  repaired_orientation,
  assigned_schedule,
  evidence_source
)
select practice_id,
       previous_orientation,
       repaired_orientation,
       assigned_schedule,
       'selected_convocatoria_horario_asignado'
from candidates
on conflict (practice_id) do nothing;

update public.practicas p
set especialidad = a.repaired_orientation
from private.moodle_practice_orientation_repair_audit a
where p.id = a.practice_id
  and p.especialidad is distinct from a.repaired_orientation;

commit;
