do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.registrar_desaprobacion_pps(uuid,date,text[],text,text,timestamp with time zone)'::regprocedure
  )
  into v_definition;

  v_patched := replace(
    v_definition,
    E'AS $function$\ndeclare',
    E'AS $function$\n#variable_conflict use_column\ndeclare'
  );

  if v_patched = v_definition then
    raise exception 'No se pudo aplicar la resolución de nombres a registrar_desaprobacion_pps';
  end if;

  execute v_patched;
end;
$migration$;

revoke all on function public.registrar_desaprobacion_pps(
  uuid,
  date,
  text[],
  text,
  text,
  timestamptz
) from public, anon;

grant execute on function public.registrar_desaprobacion_pps(
  uuid,
  date,
  text[],
  text,
  text,
  timestamptz
) to authenticated;
