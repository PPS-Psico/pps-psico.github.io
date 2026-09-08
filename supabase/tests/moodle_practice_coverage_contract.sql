begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare v_launch uuid := gen_random_uuid(); v_legacy uuid := gen_random_uuid(); v_student uuid;
begin
  select id into strict v_student from public.estudiantes order by id limit 1;
  insert into public.lanzamientos_pps(id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,estado_convocatoria)
    values(v_launch,'[TEST] coverage closed','Clínica','2026-05-02','2026-09-02','Cerrado');
  if exists(select 1 from public.moodle_task_intents where lanzamiento_id=v_launch) then
    raise exception 'Empty closed launch must not provision'; end if;
  insert into public.practicas(id,estudiante_id,lanzamiento_id,nombre_institucion,especialidad,estado,tipo_actividad)
    values(gen_random_uuid(),v_student,v_launch,'[TEST] coverage closed','Clínica','Finalizada','pps');
  if (select count(*) from public.moodle_task_intents where lanzamiento_id=v_launch and provisioning_status='pending')<>1 then
    raise exception 'Real practice on closed dedicated launch must provision'; end if;
  perform private.reconcile_moodle_task_intents_v1_impl(v_launch);
  if (select count(*) from public.moodle_task_intents where lanzamiento_id=v_launch)<>1 then
    raise exception 'Reconciliation must be idempotent'; end if;
  if (select count(*) from public.moodle_task_expected_participants ep join public.moodle_task_intents i on i.id=ep.intent_id
      where i.lanzamiento_id=v_launch and ep.active_to is null and ep.membership_status='expected')<>1 then
    raise exception 'Practice must be an expected participant'; end if;
  insert into public.lanzamientos_pps(id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,estado_convocatoria,moodle_task_policy)
    values(v_legacy,'[TEST] historical gap','Clínica','2026-05-02','2026-09-02','Cerrado','legacy_shared');
  insert into public.practicas(id,estudiante_id,lanzamiento_id,nombre_institucion,especialidad,estado,tipo_actividad)
    values(gen_random_uuid(),v_student,v_legacy,'[TEST] historical gap','Clínica','Finalizada','pps');
  if exists(select 1 from public.moodle_task_intents where lanzamiento_id=v_legacy) then
    raise exception 'Do not silently promote historical gaps'; end if;
end $$;
rollback;
