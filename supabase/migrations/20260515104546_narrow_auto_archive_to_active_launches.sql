-- Narrow automatic archiving to launches still visible as active/closed convocatorias.

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
    and lower(coalesce(estado_convocatoria, '')) in ('abierta', 'abierto', 'cerrado', 'cerrada')
    and coalesce(estado_gestion, '') not in ('Archivado', 'No se Relanza');

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

comment on function public.archive_lanzamientos_after_start_grace()
is 'Archives visible active/closed lanzamientos_pps 2 calendar days after fecha_inicio, preserving No se Relanza and existing archived records.';
