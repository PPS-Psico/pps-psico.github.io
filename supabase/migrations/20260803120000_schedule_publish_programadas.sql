-- Publica las convocatorias 'Programada' cuando llega su fecha_publicacion.
--
-- La Edge Function `launch-scheduler` ya hacía esto, pero nunca se agendó: no
-- hay cron que la invoque ni el front la llama. Es decir, una convocatoria
-- programada se quedaba en 'Programada' para siempre, con el countdown del
-- Lanzador corriendo en falso.
--
-- Se resuelve en SQL en vez de agendar la Edge Function porque `launch-scheduler`
-- exige `X-API-Key: CRON_SECRET`, y ese secreto no está disponible desde
-- Postgres (los crons existentes sólo tienen `app.settings.service_key`, que no
-- sirve para esa función). El trabajo es un UPDATE de dos condiciones, así que
-- no justifica el salto por red ni un secreto nuevo. Mismo patrón que
-- `archive_lanzamientos_after_start_grace`.
--
-- La Edge Function se conserva para disparo manual desde una sesión admin.
--
-- Sobre las fechas: `fecha_publicacion` es TEXT por compatibilidad legacy y el
-- Lanzador escribe un ISO-8601 UTC completo (`Date.toISOString()`). NO se usa
-- `public.safe_date_cast` acá porque descarta la hora (castea a medianoche UTC)
-- y publicaría a la hora equivocada. Los valores sólo-fecha, si quedó alguno
-- viejo, se interpretan como medianoche de Argentina, que es lo que espera
-- quien tipeó una fecha suelta. Cualquier otro formato se ignora en vez de
-- romper la corrida entera.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.publish_scheduled_launches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_now timestamptz := now();
  v_entry text;
begin
  v_entry := to_char(v_now at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI')
    || ': Publicada automaticamente segun la fecha programada';

  with vencidas as (
    select
      id,
      case
        when fecha_publicacion ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$'
          then fecha_publicacion::timestamptz
        when fecha_publicacion ~ '^\d{4}-\d{2}-\d{2}$'
          then (fecha_publicacion || ' 00:00:00')::timestamp
               at time zone 'America/Argentina/Buenos_Aires'
        else null
      end as publicar_at
    from public.lanzamientos_pps
    where estado_convocatoria = 'Programada'
  )
  update public.lanzamientos_pps l
  set
    estado_convocatoria = 'Abierta',
    updated_at = now(),
    historial_gestion = case
      when nullif(btrim(l.historial_gestion), '') is null then v_entry
      else v_entry || chr(10) || l.historial_gestion
    end
  from vencidas v
  where v.id = l.id
    and v.publicar_at is not null
    and v.publicar_at <= v_now
    -- Reconfirmamos el estado: si alguien la abrió o archivó a mano entre el
    -- select y el update, no la pisamos.
    and l.estado_convocatoria = 'Programada';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.publish_scheduled_launches() from public;
revoke all on function public.publish_scheduled_launches() from anon;
revoke all on function public.publish_scheduled_launches() from authenticated;
grant execute on function public.publish_scheduled_launches() to postgres;
grant execute on function public.publish_scheduled_launches() to service_role;

comment on function public.publish_scheduled_launches()
is 'Pasa lanzamientos de Programada a Abierta cuando vence fecha_publicacion. Agendada cada 10 minutos.';

do $$
begin
  perform cron.unschedule('publish-scheduled-launches');
exception
  when others then
    null;
end;
$$;

-- Cada 10 minutos: misma cadencia que `check-consentimiento-pendientes`. Una
-- convocatoria programada para las 9:00 abre, a lo sumo, 9:09.
select cron.schedule(
  'publish-scheduled-launches',
  '*/10 * * * *',
  $$select public.publish_scheduled_launches();$$
);
