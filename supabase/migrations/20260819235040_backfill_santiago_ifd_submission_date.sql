-- Evidencia verificada en la tabla de Entregas Moodle (cmid 1110106):
-- Santiago Oliva, DNI 44684830, envio el 04/08/2026 a las 15:17 ART.
-- Se usan claves estables de negocio; no se hardcodean UUID generados.

with target_practices as (
  select distinct p.id
  from public.practicas p
  join public.estudiantes e on e.id = p.estudiante_id
  join public.moodle_grade_observations o
    on o.practica_id = p.id
   and o.cmid = 1110106
   and o.submitted = true
  where e.dni = 44684830
)
update public.moodle_grade_observations o
set
  submitted_at = timestamptz '2026-08-04 15:17:00-03',
  submitted_at_display = 'martes, 4 de agosto de 2026, 15:17'
where o.practica_id in (select id from target_practices)
  and o.cmid = 1110106
  and o.submitted = true
  and o.submitted_at is null;

with target_practices as (
  select distinct p.id
  from public.practicas p
  join public.estudiantes e on e.id = p.estudiante_id
  join public.moodle_grade_snapshots s
    on s.practica_id = p.id
   and s.cmid = 1110106
   and s.submitted = true
  where e.dni = 44684830
)
update public.moodle_grade_snapshots s
set
  submitted_at = timestamptz '2026-08-04 15:17:00-03',
  submitted_at_display = 'martes, 4 de agosto de 2026, 15:17'
where s.practica_id in (select id from target_practices)
  and s.cmid = 1110106
  and s.submitted = true
  and s.submitted_at is null;
