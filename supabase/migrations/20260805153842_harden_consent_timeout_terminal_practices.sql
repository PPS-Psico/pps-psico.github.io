-- Defensa adicional para el procesador SQL legacy de consentimientos.
-- Una convocatoria antigua que haya quedado como Seleccionado no debe hacer
-- que el cron modifique o elimine un antecedente Desaprobada.
do $$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef('public.process_consentimiento_timeouts()'::regprocedure)
  into v_definition;

  v_patched := replace(
    v_definition,
    E'and c.baja_automatica_at is null\n      and not exists (\n        select 1 from public.compromisos_pps cp',
    E'and c.baja_automatica_at is null\n      and not exists (\n        select 1 from public.practicas p\n        where p.estudiante_id = c.estudiante_id\n          and p.lanzamiento_id = c.lanzamiento_id\n          and p.estado = ''Desaprobada''\n      )\n      and not exists (\n        select 1 from public.compromisos_pps cp'
  );

  if v_patched = v_definition then
    raise exception 'No se pudo excluir prácticas Desaprobada del cron de consentimiento';
  end if;

  v_definition := v_patched;
  v_patched := replace(
    v_definition,
    E'delete from public.practicas\n      where estudiante_id = rec.estudiante_id\n        and lanzamiento_id = rec.lanzamiento_id;',
    E'delete from public.practicas\n      where estudiante_id = rec.estudiante_id\n        and lanzamiento_id = rec.lanzamiento_id\n        and estado = ''En curso'';'
  );

  if v_patched = v_definition then
    raise exception 'No se pudo limitar el cron a prácticas En curso';
  end if;

  execute v_patched;
end;
$$;
