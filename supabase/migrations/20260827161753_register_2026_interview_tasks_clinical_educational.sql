begin;

insert into public.aula_entregas (
  area,
  institucion,
  moodle_id,
  orden,
  activo,
  course_id,
  academic_year,
  moodle_name,
  source_synced_at,
  moodle_grade_max,
  grade_conversion_mode
)
values
  (
    'clinica',
    'Entrevistas a Profesionales · Clínica',
    '1224814',
    null,
    true,
    3615,
    2026,
    'Entrevistas a Profesionales · Clínica',
    now(),
    100,
    'percentage'
  ),
  (
    'educacional',
    'Entrevistas a Profesionales · Educacional',
    '1224816',
    null,
    true,
    3615,
    2026,
    'Entrevistas a Profesionales · Educacional',
    now(),
    100,
    'percentage'
  )
on conflict (course_id, moodle_id) do update
set area = excluded.area,
    institucion = excluded.institucion,
    activo = true,
    academic_year = excluded.academic_year,
    moodle_name = excluded.moodle_name,
    source_synced_at = excluded.source_synced_at,
    moodle_grade_max = excluded.moodle_grade_max,
    grade_conversion_mode = excluded.grade_conversion_mode;

insert into public.special_pps_task_catalog (
  activity_type,
  orientation_key,
  academic_year,
  aula_entrega_id,
  enabled,
  created_by,
  updated_by
)
select
  'entrevistas_profesionales',
  seed.orientation_key,
  2026::smallint,
  ae.id,
  true,
  null,
  null
from (values
  ('clinica', '1224814'),
  ('educacional', '1224816')
) as seed(orientation_key, moodle_id)
join public.aula_entregas ae
  on ae.course_id = 3615
 and ae.moodle_id = seed.moodle_id
 and ae.academic_year = 2026
on conflict (activity_type, orientation_key, academic_year) do update
set aula_entrega_id = excluded.aula_entrega_id,
    enabled = true,
    updated_at = now(),
    updated_by = null;

commit;
