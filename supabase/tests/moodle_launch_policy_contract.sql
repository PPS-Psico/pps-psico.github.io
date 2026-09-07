begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); baseline text;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'')) into baseline
    from public.moodle_task_intents i where mode='legacy_shared';
  insert into public.lanzamientos_pps(id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,estado_convocatoria)
    values(a,'[TEST] repeated institution','Clínica','2026-09-01','2026-12-01','Oculto'),
          (b,'[TEST] repeated institution','Clínica','2026-09-01','2026-12-01','Oculto');
  if exists(select 1 from public.lanzamientos_pps where id in(a,b) and moodle_task_policy<>'dedicated')
    or exists(select 1 from public.moodle_task_intents where lanzamiento_id in(a,b)) then
    raise exception 'New draft policy or premature queue failed'; end if;
  update public.lanzamientos_pps set estado_convocatoria='Activa' where id in(a,b);
  if (select count(distinct stable_key) from public.moodle_task_intents where lanzamiento_id in(a,b)
      and mode='dedicated' and provisioning_status='pending')<>2 then
    raise exception 'Two launches of one institution must create two units in 2026'; end if;
  perform private.reconcile_moodle_task_intents_v1_impl(a);
  if (select count(*) from public.moodle_task_intents where lanzamiento_id=a)<>1 then
    raise exception 'Repeated reconcile duplicated a unit'; end if;
  if baseline is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,''))
    from public.moodle_task_intents i where mode='legacy_shared') then
    raise exception 'Historical intents changed'; end if;
end $$;
rollback;
