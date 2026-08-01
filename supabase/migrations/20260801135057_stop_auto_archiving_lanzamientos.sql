do $$
begin
  perform cron.unschedule('archive-lanzamientos-after-start-grace');
exception
  when others then
    null;
end;
$$;

comment on function public.archive_lanzamientos_after_start_grace()
is 'OBSOLETA (24/07/2026): el Lanzador deriva activa/finalizada de fecha_inicio y fecha_finalizacion, no de estado_gestion. Ya no está programada en cron porque archivaba PPS en curso. Se conserva solo para ejecución manual.';;
