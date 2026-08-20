-- Opt-in explicito para pilotear el modelo `dedicated` sobre lanzamientos 2026.
--
-- El plan v2 preve un piloto acotado durante 2026 (seccion 10.4), pero la
-- reconciliacion quedo con una condicion dura: solo considera dedicadas las
-- unidades de lanzamientos con fecha_inicio >= 2027. Resultado practico: no
-- habia forma de marcar un lanzamiento 2026 como dedicado y el piloto no podia
-- ejecutarse.
--
-- Esta migracion agrega la bandera que faltaba. El corte 2027 sigue intacto:
-- lo unico que cambia es que un lanzamiento marcado a mano tambien califica.
-- Activar el piloto pasa a ser un UPDATE de una fila, auditable y reversible.
--
-- Un lanzamiento marcado sale ademas del universo legacy: si tuviera un vinculo
-- confirmado previo, sin esta exclusion generaria una unidad legacy y una
-- dedicada para la misma clave (lanzamiento, orientacion) y chocarian contra el
-- indice unico.

alter table public.lanzamientos_pps
  add column if not exists moodle_pilot_dedicated boolean not null default false;

comment on column public.lanzamientos_pps.moodle_pilot_dedicated is
  'Opt-in al piloto dedicated durante 2026. Desde 2027 el modo dedicado es el default y esta bandera deja de ser necesaria.';

-- Nota adicional: la rama dedicada tambien exigia estado_convocatoria en
-- ('activa','archivado'). Ninguna PPS 2026 candidata lo cumple: quedan en
-- 'Confirmacion' aunque ya hayan empezado, porque ese estado depende de un
-- click del admin. El propio repo ya establece que "Activa y Finalizada las
-- decide el CALENDARIO, no un click" (aseguramientoService). Marcar el piloto
-- a mano ES la autorizacion humana, asi que la bandera se basta sola y no se
-- le exige ademas el estado del pipeline. El camino 2027 queda intacto.
--
-- El bloque es idempotente: cada reemplazo se aplica solo si falta.

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.reconcile_moodle_task_intents_v1_impl(uuid)'::regprocedure
  ) into v_def;
  v_new := v_def;

  if position('and not coalesce(l.moodle_pilot_dedicated, false)' in v_new) = 0 then
    v_new := replace(v_new, '::integer, 0) < 2027',
      E'::integer, 0) < 2027
        and not coalesce(l.moodle_pilot_dedicated, false)');
  end if;

  if position('or coalesce(l.moodle_pilot_dedicated, false))' in v_new) = 0 then
    v_new := replace(v_new, 'where coalesce(substring', 'where (coalesce(substring');
    v_new := replace(v_new, '::integer, 0) >= 2027',
      E'::integer, 0) >= 2027
             or coalesce(l.moodle_pilot_dedicated, false))');
  end if;

  if position('or lower(coalesce(l.estado_convocatoria' in v_new) = 0 then
    v_new := replace(v_new,
      'and lower(coalesce(l.estado_convocatoria, '''')) in (''activa'', ''archivado'')',
      E'and (coalesce(l.moodle_pilot_dedicated, false)
             or lower(coalesce(l.estado_convocatoria, '''')) in (''activa'', ''archivado''))');
  end if;

  if position('and not coalesce(l.moodle_pilot_dedicated, false)' in v_new) = 0
     or position('or coalesce(l.moodle_pilot_dedicated, false))' in v_new) = 0
     or position('or lower(coalesce(l.estado_convocatoria' in v_new) = 0 then
    raise exception 'El parche del piloto quedo incompleto; se aborta';
  end if;

  execute v_new;
end;
$patch$;
