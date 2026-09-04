-- Paso 4 del Lanzador: un token propio, y el registro de ciclo deja de mentir.
--
-- CONTEXTO
-- Al reordenar el pipeline (el consentimiento pasó a ir antes que el seguro), el
-- paso «Seguro» quedó representado por el valor histórico 'Confirmacion', que se
-- llamaba así cuando el seguro iba primero. Un token que dice una cosa y
-- significa la contraria es una trampa para quien lea una query suelta dentro de
-- seis meses.
--
-- POR QUÉ NO SE RENOMBRA NADA MÁS
-- 'Abierta', 'Cerrado' y 'Activa' están cableados fuera del Lanzador:
--   * director_report_v1            → where l.estado_convocatoria = 'Abierta'
--   * jefe_area_panel_v1            → <> 'oculto' y = 'abierta'
--   * schedule_publish_programadas  → cron 'Programada' → 'Abierta' cada 10 min
--   * moodle task intents           → in ('activa', 'archivado'), dentro de un trigger
--   * log_selection_cycle           → 'Cerrado' / 'Abierta' hardcodeados
-- Renombrarlos rompería cinco subsistemas para arreglar un problema de nombres.
-- Se agrega un único valor y no se toca ninguno de los existentes.
--
-- POR QUÉ NO HAY BACKFILL
-- Las 16 convocatorias que hoy están en 'Confirmacion' NO se migran. La lista de
-- estados visibles para el estudiante vive escrita a mano en el cliente
-- (convocatoriasService); moverlas antes de que ese deploy esté arriba las haría
-- desaparecer del panel de los alumnos ya anotados. 'Confirmacion' queda como
-- valor legacy —el cliente lo sigue mapeando al paso 4— y drena solo a medida que
-- esas convocatorias avanzan a 'Activa' o 'Archivado'.
--
-- ORDEN DE APLICACIÓN
-- Esta migración va ANTES del deploy del código. El cliente nuevo escribe
-- 'Seguro'; sin el CHECK actualizado, cada intento de pasar al paso 4 falla con
-- violación de constraint.

alter table public.lanzamientos_pps
  drop constraint if exists lanzamientos_estado_convocatoria_check;

alter table public.lanzamientos_pps
  add constraint lanzamientos_estado_convocatoria_check
  check (
    estado_convocatoria = any (
      array[
        'Oculto'::text,
        'Programada'::text,
        'Abierta'::text,
        'Cerrado'::text,
        'Confirmacion'::text,
        'Seguro'::text,
        'Activa'::text,
        'Archivado'::text
      ]
    )
  );

comment on column public.lanzamientos_pps.estado_convocatoria is
  'Paso del pipeline del Lanzador. Recorrido: Oculto/Programada → Abierta (mesa) → Cerrado (sala de firmas) → Seguro (planilla y listado) → Activa → Archivado. ''Confirmacion'' es un valor legacy equivalente a ''Seguro'', conservado para las convocatorias anteriores a septiembre de 2026.';

-- ── El registro del ciclo de selección deja de inventar cierres ──────────────
--
-- `log_selection_cycle` anotaba un evento 'closed' cada vez que
-- `estado_convocatoria` llegaba a 'Cerrado', sin mirar de dónde venía. Con el
-- pipeline reordenado eso es un problema concreto: volver del paso Seguro a la
-- sala de firmas —una navegación hacia atrás, no un cierre— dejaba registrado un
-- cierre de mesa que nunca ocurrió.
--
-- Un cierre de mesa es exactamente la transición 'Abierta' → 'Cerrado'. El resto
-- de las llegadas a 'Cerrado' (volver del seguro, correcciones manuales desde el
-- editor) no son cierres y no se anotan: `selection_cycle_events` acota su
-- event_type a ('closed', 'reopened') y no hace falta un tercer tipo para algo
-- que nadie mide.
create or replace function private.log_selection_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado_convocatoria is distinct from old.estado_convocatoria then
    if old.estado_convocatoria = 'Abierta' and new.estado_convocatoria = 'Cerrado' then
      insert into public.selection_cycle_events (
        lanzamiento_id, event_type, actor_id, from_state, to_state
      ) values (new.id, 'closed', auth.uid(), old.estado_convocatoria, new.estado_convocatoria);
    elsif old.estado_convocatoria = 'Cerrado' and new.estado_convocatoria = 'Abierta' then
      insert into public.selection_cycle_events (
        lanzamiento_id, event_type, actor_id, from_state, to_state
      ) values (new.id, 'reopened', auth.uid(), old.estado_convocatoria, new.estado_convocatoria);
    end if;
  end if;
  return new;
end;
$$;

comment on function private.log_selection_cycle() is
  'Registra el cierre y la reapertura de la mesa de selección. Solo cuenta como cierre la transición Abierta → Cerrado; volver al paso de firmas desde Seguro no lo es.';
