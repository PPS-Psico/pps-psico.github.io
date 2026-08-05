-- Cierra por calendario las prácticas que quedaron en 'En curso'.
--
-- El panel del estudiante ya intentaba esto (`useStudentPracticas`: si la PPS
-- terminó, escribe estado = 'Finalizada'), pero el UPDATE nunca llegaba a la
-- base: el trigger `trg_check_practica_updates` revierte `estado` en silencio
-- para todo el que no sea admin, y el que corre ese código es el estudiante.
-- Resultado: la columna `estado` quedó congelada en 'En curso' para cientos de
-- prácticas ya terminadas, y cualquier vista de admin, métrica o consulta SQL
-- que la leyera veía datos falsos.
--
-- Se resuelve del lado del servidor, que es el único lugar donde el cierre
-- puede ser verdad para todos. La nota del informe es irrelevante: si la fecha
-- de fin pasó, la PPS terminó, esté calificada o no.
--
-- Criterio idéntico al de `isPracticeOverdue` en src/logic/studentRules.ts:
-- sólo 'En curso' (no toca Desaprobada, Convenio Realizado ni No se pudo
-- concretar) y sólo si `fecha_finalizacion` es estrictamente anterior a hoy.
-- Las prácticas sin fecha de fin se dejan como están: no hay dato para decidir.
--
-- Sobre el trigger: se desactiva SOLO dentro de la transacción del job. El
-- ALTER TABLE es transaccional, así que si la corrida falla el rollback lo
-- restituye; no queda forma de terminar con el trigger apagado. Mismo recurso
-- que usó la migración de normalización de estados. No se agrega un bypass
-- permanente al trigger para no ampliar la superficie de escritura que hoy
-- protege a los estudiantes.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.close_finished_practicas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  alter table public.practicas disable trigger trg_check_practica_updates;

  with vencidas as (
    select id
    from public.practicas
    where estado = 'En curso'
      and fecha_finalizacion ~ '^\d{4}-\d{2}-\d{2}'
      and left(fecha_finalizacion, 10)::date < v_hoy
  )
  update public.practicas p
  set estado = 'Finalizada'
  from vencidas v
  where v.id = p.id
    -- Reconfirmamos el estado por si algo lo cambió entre el select y el update.
    and p.estado = 'En curso';

  get diagnostics v_count = row_count;

  alter table public.practicas enable trigger trg_check_practica_updates;

  return v_count;
end;
$$;

revoke all on function public.close_finished_practicas() from public;
revoke all on function public.close_finished_practicas() from anon;
revoke all on function public.close_finished_practicas() from authenticated;
grant execute on function public.close_finished_practicas() to postgres;
grant execute on function public.close_finished_practicas() to service_role;

comment on function public.close_finished_practicas()
is 'Pasa practicas de En curso a Finalizada cuando fecha_finalizacion ya pasó. Agendada diaria.';

-- Backfill de la deuda acumulada: al momento de escribir esto son ~360 filas
-- terminadas que seguían figurando como En curso.
select public.close_finished_practicas();

do $$
begin
  perform cron.unschedule('close-finished-practicas');
exception
  when others then
    null;
end;
$$;

-- Diario a las 04:11 UTC (01:11 en Argentina): la ventana de menos tráfico, y
-- el cierre es por fecha, así que no gana nada corriendo más seguido.
select cron.schedule(
  'close-finished-practicas',
  '11 4 * * *',
  $$select public.close_finished_practicas();$$
);
