-- Activar una PPS deja de ser un click que casi nadie da.
--
-- POR QUÉ
-- "Activar PPS" era un acto manual que, medido sobre los datos reales, se
-- saltea el 71% de las veces: de 17 PPS en curso hoy, solo 5 pasaron por ese
-- botón. Y no rompía nada, porque el Lanzador deriva "en curso" del calendario
-- (fecha_inicio ≤ hoy ≤ fecha_finalizacion), no del estado. El botón terminó
-- siendo un acto de navegación —te cambia la pantalla— disfrazado de transición.
--
-- El problema es a futuro. La rama `dedicated` del padrón de Moodle exige
-- `estado_convocatoria in ('activa','archivado')` para los lanzamientos con
-- `fecha_inicio >= 2027`. Las de 2026 entran por la rama legacy, que no lo pide,
-- y por eso hoy hay PPS sin activar que igual tienen su padrón armado. Desde
-- 2027 eso deja de ser cierto: una PPS que nadie activó no arma sus tareas y los
-- jefes no ven qué corregir. Depender de un click que se saltea 7 de cada 10
-- veces para alimentar el padrón de correcciones es un bug con fecha.
--
-- QUÉ HACE
-- Cada 10 minutos, pasa a 'Activa' lo que ya empezó y todavía no terminó. Mismo
-- patrón que `publish_scheduled_launches`: SQL directo, sin salto por red.
--
-- QUÉ NO HACE
--  * No toca 'Abierta'. Una convocatoria con la inscripción abierta cuyo inicio
--    ya llegó es un problema de datos; activarla cerraría la mesa de contrabando.
--  * No toca lo ya terminado (`fecha_finalizacion` pasada): eso sale de la vista
--    operativa por calendario y activarlo sería mentir al revés.
--  * No inventa fechas: sin `fecha_inicio` parseable, la fila se ignora.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.activate_started_launches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_entry text;
  v_id uuid;
  -- Los ids se juntan en un array y no en una tabla temporal: esta funcion corre
  -- con `search_path = ''`, y una temp table vive en `pg_temp`, asi que
  -- referenciarla sin calificar fallaria en tiempo de ejecucion.
  v_activadas uuid[];
begin
  v_entry := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI')
    || ': Activada automaticamente porque llego su fecha de inicio';

  with candidatas as (
    select
      l.id,
      nullif(substring(btrim(coalesce(l.fecha_inicio, '')) from '^\d{4}-\d{2}-\d{2}'), '')::date as ini,
      nullif(substring(btrim(coalesce(l.fecha_finalizacion, '')) from '^\d{4}-\d{2}-\d{2}'), '')::date as fin
    from public.lanzamientos_pps l
    -- Solo los pasos posteriores a la selección. 'Confirmacion' es el nombre
    -- legacy del paso Seguro (ver 20260904140000).
    where l.estado_convocatoria in ('Cerrado', 'Seguro', 'Confirmacion')
  ), actualizadas as (
    update public.lanzamientos_pps l
    set
      estado_convocatoria = 'Activa',
      updated_at = now(),
      historial_gestion = case
        when nullif(btrim(l.historial_gestion), '') is null then v_entry
        else v_entry || chr(10) || l.historial_gestion
      end
    from candidatas c
    where c.id = l.id
      and c.ini is not null
      and c.ini <= v_today
      and (c.fin is null or c.fin >= v_today)
      -- Reconfirmamos el estado por si alguien lo movió a mano entre el select
      -- y el update.
      and l.estado_convocatoria in ('Cerrado', 'Seguro', 'Confirmacion')
    returning l.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_activadas from actualizadas;

  v_count := coalesce(array_length(v_activadas, 1), 0);

  -- El trigger de Moodle se abstiene cuando la sesión no es de coordinación
  -- (`moodle_v2_is_coordinator`), y un cron de Postgres no lo es. Sin esto, la
  -- activación automática no armaría el padrón que la manual sí arma, que es
  -- justamente lo que esta migración viene a asegurar para 2027. Cada
  -- reconciliación va aislada: un lanzamiento que falle no puede tumbar la
  -- corrida entera.
  foreach v_id in array v_activadas loop
    begin
      perform private.reconcile_moodle_task_intents_v1_impl(v_id);
    exception
      when others then
        raise warning 'activate_started_launches: reconciliacion Moodle fallida para %: %',
          v_id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.activate_started_launches() from public;
revoke all on function public.activate_started_launches() from anon;
revoke all on function public.activate_started_launches() from authenticated;
grant execute on function public.activate_started_launches() to postgres;
grant execute on function public.activate_started_launches() to service_role;

comment on function public.activate_started_launches()
is 'Pasa a Activa los lanzamientos posteriores a la seleccion cuya fecha de inicio ya llego y que todavia no terminaron. Agendada cada 10 minutos.';

do $$
begin
  perform cron.unschedule('activate-started-launches');
exception
  when others then
    null;
end;
$$;

-- Misma cadencia que la publicación de programadas: una PPS que empieza hoy
-- queda activa, a lo sumo, diez minutos después del primer tick.
select cron.schedule(
  'activate-started-launches',
  '*/10 * * * *',
  $$select public.activate_started_launches();$$
);
