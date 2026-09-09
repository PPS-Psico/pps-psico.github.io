begin;

-- Alta de la primera tarea de proyecto de investigacion y su unica asignacion,
-- registrada a mano porque el writer de Moodle no existe: el runbook dice
-- "escritura Moodle aun no habilitada" y reconcile_moodle_task_intents_v1 solo
-- toca Supabase. Ademas moodle_task_intents.lanzamiento_id es NOT NULL y una
-- PPS especial no tiene lanzamiento, asi que este caso queda fuera de ese
-- pipeline por diseno.
--
-- La actividad se creo en el curso 3615 el 2026-09-03 y se releyo desde
-- modedit.php?update=1227230 antes de registrarla: nombre correcto,
-- visible = 1, tipo de calificacion 'point' con maximo 10, entrega por archivo
-- y las cuatro fechas (allowsubmissionsfrom, due, cutoff, gradingdue)
-- deshabilitadas. La relectura no es opcional: Moodle rechaza guardados en
-- silencio y el formulario vuelve a mostrarse sin cartel.
--
-- grade_conversion_mode = 'direct_10' porque la tarea califica sobre 10, no
-- sobre 100 como las tareas legacy. Si quedara en 'percentage' un 9 se leeria
-- como 9%.
--
-- Caso: Lara Antonella Petit Abojer (legajo 33374). Tenia 240 hs y le faltaban
-- exactamente 10 para las 250. Participa del proyecto "Los nuevos formatos
-- tecnologicos..." (RCS 161/25, Sede Patagonia). La orientacion Clinica la
-- decidio Coordinacion por el objeto del proyecto -- contrastar tests clasicos
-- es evaluacion psicologica -- y no por el area de la tarea, que es unica y
-- compartida.

insert into public.aula_entregas (
  course_id, moodle_id, institucion, moodle_name, area, academic_year,
  activo, moodle_grade_max, grade_conversion_mode, source_synced_at
)
select 3615, '1227230', 'Informe de Proyecto de Investigación',
       'Informe de Proyecto de Investigación', 'clinica', 2026,
       true, 10, 'direct_10', now()
where not exists (
  select 1 from public.aula_entregas
  where course_id = 3615 and moodle_id = '1227230'
);

insert into public.special_pps_task_catalog (
  activity_type, orientation_key, academic_year, aula_entrega_id, enabled,
  created_by, updated_by
)
select 'proyecto_investigacion', 'general', 2026, ae.id, true,
       'a019911a-a757-4861-8376-0d349a51fbb0'::uuid,
       'a019911a-a757-4861-8376-0d349a51fbb0'::uuid
from public.aula_entregas ae
where ae.course_id = 3615 and ae.moodle_id = '1227230'
on conflict (activity_type, orientation_key, academic_year) do update
set aula_entrega_id = excluded.aula_entrega_id,
    enabled = true,
    updated_at = now();

-- La asignacion se hizo por SQL y no por assign_special_pps_v1 porque la
-- funcion toma assigned_by de auth.uid(), que es null fuera de una sesion de
-- usuario. Se pasa el uuid de coordinacion explicitamente.

with practica_nueva as (
  insert into public.practicas (
    estudiante_id, lanzamiento_id, horas_realizadas, fecha_inicio,
    fecha_finalizacion, estado, especialidad, nombre_institucion,
    es_online, tipo_actividad, informe_estado
  )
  select e.id, null, 10, null, null, 'En curso', 'Clínica',
         'Proyecto de Investigación — Los nuevos formatos tecnológicos: contrastando tests clásicos en versiones con dibujos en blanco y negro, fotografías y emojis',
         true, 'actividad_especial', 'a_revisar'
  from public.estudiantes e
  where e.legajo = '33374'
    and not exists (
      select 1 from public.special_pps_assignments a
      where a.estudiante_id = e.id
        and a.activity_type = 'proyecto_investigacion'
        and a.academic_year = 2026
        and a.status = 'assigned'
    )
  returning id, estudiante_id
),
vinculo as (
  insert into public.practica_moodle_tareas (
    practica_id, aula_entrega_id, validation_status, link_source,
    rationale, validated_at, validated_by
  )
  select p.id, ae.id, 'confirmed', 'manual',
         'Asignacion excepcional proyecto_investigacion 2026 por coordinacion',
         now(), 'a019911a-a757-4861-8376-0d349a51fbb0'::uuid
  from practica_nueva p
  cross join public.aula_entregas ae
  where ae.course_id = 3615 and ae.moodle_id = '1227230'
  returning practica_id
)
insert into public.special_pps_assignments (
  practica_id, estudiante_id, task_catalog_id, activity_type,
  orientation_key, academic_year, expected_hours, project_title, assigned_by
)
select p.id, p.estudiante_id, c.id, 'proyecto_investigacion',
       'clinica', 2026, 10,
       'Los nuevos formatos tecnológicos: contrastando tests clásicos en versiones con dibujos en blanco y negro, fotografías y emojis',
       'a019911a-a757-4861-8376-0d349a51fbb0'::uuid
from practica_nueva p
join public.special_pps_task_catalog c
  on c.activity_type = 'proyecto_investigacion'
 and c.orientation_key = 'general'
 and c.academic_year = 2026
where exists (select 1 from vinculo);

commit;
