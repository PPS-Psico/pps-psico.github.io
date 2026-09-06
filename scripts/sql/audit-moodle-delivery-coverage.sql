-- Sólo lectura. Ejecutar con rol de coordinación/servicio con acceso privado.
-- No identifica faltantes académicos: mide cobertura técnica del sistema.
select jsonb_build_object(
 'as_of',now(),
 'scope','Todas las practicas existentes; diagnostico tecnico, no faltantes academicos',
 'practice_count',(select count(*) from public.practicas),
 'view_rows',(select count(*) from public.practica_estado_entrega),
 'view_unique_practices',(select count(distinct practica_id) from public.practica_estado_entrega),
 'states',(select jsonb_agg(x) from (
   select estado,count(*) as practices,count(*) filter(where cmid_vinculado is null) as without_link
   from public.practica_estado_entrega group by estado order by estado) x),
 'without_reading',(select jsonb_agg(x) from (
   select coalesce(p.tipo_actividad,'pps') as activity_type,p.estado,count(*) as practices,
     count(*) filter(where v.cmid_vinculado is null) as without_link
   from public.practica_estado_entrega v join public.practicas p on p.id=v.practica_id
   where v.estado='sin_lectura' group by coalesce(p.tipo_actividad,'pps'),p.estado order by 1,2) x),
 'without_link',(select jsonb_agg(x) from (
   select case when p.lanzamiento_id is null then 'no_launch'
     when l.unidad_id is null then 'launch_without_unit'
     when not exists(select 1 from public.unidad_entrega_tareas ut where ut.unidad_id=l.unidad_id)
       then 'unit_without_tasks'
     else 'unit_tasks_exist_without_exact_link' end as diagnostic,count(*) as practices
   from public.practica_estado_entrega v join public.practicas p on p.id=v.practica_id
   left join public.lanzamientos_pps l on l.id=p.lanzamiento_id
   where v.cmid_vinculado is null group by 1 order by 1) x),
 'shared_snapshot_pairs',(select count(*) from (
   select estudiante_id,cmid from public.moodle_grade_snapshots
   group by estudiante_id,cmid having count(distinct practica_id)>1) x),
 'latest_diagnostics',(select jsonb_agg(x) from (
   select reason,resolution_status,count(*) as student_task_pairs from (
     select distinct on (course_id,cmid,estudiante_id) course_id,cmid,estudiante_id,reason,resolution_status
     from private.moodle_jefe_unmatched_diagnostics where estudiante_id is not null
     order by course_id,cmid,estudiante_id,observed_at desc,id desc) latest
   group by reason,resolution_status order by reason,resolution_status) x)
) as audit;
