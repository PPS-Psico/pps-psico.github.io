-- Completa 20260821020000. Esa migracion distinguia legacy_shared ('visible')
-- de dedicated ('stealth'), a partir de un supuesto sin verificar: que las
-- tareas legacy estaban realmente visibles en la pagina del curso.
--
-- Revisando el curso 3615 con el modo de edicion activado, las tareas legacy
-- (Liens, Sensus, Fundación Tiempo, Colegio Psicólogos CPAVZO, etc., en las
-- tres areas de la pestaña Tareas 2026) muestran todas "Disponibles pero no
-- visibles en la pagina del curso" -- son stealth, igual que la dedicada.
-- El supuesto de la migracion anterior era incorrecto.
--
-- Esto coincide con lo que ya habia verificado y dejado documentado (sin
-- efecto real, por una carrera con 20260821020000) la migracion
-- 20260820180000_dedicated_tasks_are_stealth.sql: "todas estan en modo
-- stealth" es la convencion real del curso, no solo para dedicated.
--
-- Sin impacto operativo sobre legacy_shared: su provisioning_status queda
-- forzado a 'verified' en el on-conflict sin mirar el hash, asi que esto solo
-- corrige el dato declarado para que refleje la realidad.

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.reconcile_moodle_task_intents_v1_impl(uuid)'::regprocedure
  ) into v_def;

  if position('''legacy_shared'' then ''visible''' in v_def) = 0 then
    return; -- ya aplicado (o nunca existio esa distincion)
  end if;

  v_new := replace(v_def,
    'v_visibility := case when v_unit.mode = ''legacy_shared'' then ''visible'' else ''stealth'' end;',
    'v_visibility := ''stealth'';');
  if v_new = v_def then
    raise exception 'No se pudo unificar la visibilidad: no matcheo la asignacion de v_visibility';
  end if;
  if position('''legacy_shared'' then ''visible''' in v_new) > 0 then
    raise exception 'El parche quedo incompleto; se aborta';
  end if;

  execute v_new;
end;
$patch$;

comment on function private.reconcile_moodle_task_intents_v1_impl(uuid) is
  'Reconciliador v2: declara la config deseada de cada unidad y su hash. Toda tarea del curso 3615 es stealth (con link, fuera de la pagina del curso) -- legacy_shared y dedicated por igual, verificado contra las tareas existentes.';
