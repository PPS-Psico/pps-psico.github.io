-- Archive PPS launches automatically once their start date is 2 days behind.
-- Uses Argentina calendar date so the grace period matches the admin workflow.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.archive_lanzamientos_after_start_grace()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected_count integer := 0;
  archive_entry text;
begin
  archive_entry := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')
    || ': Archivado automaticamente 2 dias despues de la fecha de inicio';

  update public.lanzamientos_pps
  set
    estado_gestion = 'Archivado',
    updated_at = now(),
    historial_gestion = case
      when nullif(trim(historial_gestion), '') is null then archive_entry
      else archive_entry || chr(10) || historial_gestion
    end
  where public.safe_date_cast(fecha_inicio) is not null
    and public.safe_date_cast(fecha_inicio)::date <= (
      (now() at time zone 'America/Argentina/Buenos_Aires')::date - 2
    )
    and coalesce(estado_gestion, '') not in ('Archivado', 'No se Relanza');

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.archive_lanzamientos_after_start_grace() from public;
revoke all on function public.archive_lanzamientos_after_start_grace() from anon;
revoke all on function public.archive_lanzamientos_after_start_grace() from authenticated;
grant execute on function public.archive_lanzamientos_after_start_grace() to postgres;
grant execute on function public.archive_lanzamientos_after_start_grace() to service_role;

comment on function public.archive_lanzamientos_after_start_grace()
is 'Archives lanzamientos_pps 2 calendar days after fecha_inicio, preserving No se Relanza and existing archived records.';

do $$
begin
  perform cron.unschedule('archive-lanzamientos-after-start-grace');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'archive-lanzamientos-after-start-grace',
  '15 6 * * *',
  $$select public.archive_lanzamientos_after_start_grace();$$
);
