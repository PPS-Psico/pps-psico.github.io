-- Los conteos del Lanzador son operativos y sólo corresponden a Coordinación.
-- El RPC sigue siendo SECURITY DEFINER para reconciliar filas atravesadas por
-- RLS, pero valida el rol del caller antes de leerlas.
create or replace function public.get_consent_counts_by_launch(p_launch_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if session_user <> 'postgres'
     and coalesce(auth.role(), '') <> 'service_role'
     and not exists (
       select 1
       from public.estudiantes e
       where e.user_id = auth.uid()
         and e.role in ('admin', 'SuperUser', 'Jefe', 'Directivo', 'AdminTester', 'Reportero')
     ) then
    raise exception 'No tenés permisos para consultar estos conteos.' using errcode = '42501';
  end if;

  with roster as (
    select
      c.id,
      c.lanzamiento_id,
      lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado' as vigente,
      c.baja_automatica_at is not null as baja,
      exists (
        select 1
        from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and lower(trim(cp.estado)) = 'aceptado'
      ) as aceptado
    from public.convocatorias c
    where c.lanzamiento_id = any(p_launch_ids)
      and (
        lower(trim(coalesce(c.estado_inscripcion, ''))) = 'seleccionado'
        or c.baja_automatica_at is not null
      )
  ), grouped as (
    select
      lanzamiento_id,
      count(*) filter (where aceptado)::integer as aceptados,
      count(*)::integer as total,
      count(*) filter (where vigente and not aceptado)::integer as pendientes,
      count(*) filter (where not vigente and baja and not aceptado)::integer as bajas,
      count(*) filter (where vigente)::integer as seleccionados_vigentes
    from roster
    group by lanzamiento_id
  )
  select coalesce(
    jsonb_object_agg(
      lanzamiento_id::text,
      jsonb_build_object(
        'aceptados', aceptados,
        'total', total,
        'pendientes', pendientes,
        'bajas', bajas,
        'seleccionados_vigentes', seleccionados_vigentes
      )
    ),
    '{}'::jsonb
  )
  into v_result
  from grouped;

  return v_result;
end;
$$;

revoke all on function public.get_consent_counts_by_launch(uuid[]) from public, anon;
grant execute on function public.get_consent_counts_by_launch(uuid[])
  to authenticated, service_role;
