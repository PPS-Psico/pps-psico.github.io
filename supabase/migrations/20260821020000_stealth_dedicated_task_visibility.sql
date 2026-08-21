-- Las tareas dedicadas tienen que quedar accesibles por link (los estudiantes
-- entregan ahi) pero fuera de la pagina del curso: Moodle llama a ese estado
-- "stealth" (Disponibilidad = -1, "Hacerlo disponible pero no mostrarlo en la
-- pagina del curso"). Hasta ahora la reconciliacion solo conocia 'visible' y
-- 'hidden', y siempre declaraba 'visible' para dedicated, lo que las dejaba
-- listadas en la pagina del curso -- exactamente lo que no se queria.
--
-- Las tareas legacy_shared no cambian: siguen declarandose 'visible', que es
-- el estado real en el que ya estan.
--
-- Se parchea la definicion viva (pg_get_functiondef) en lugar de reescribir la
-- funcion desde el archivo base, porque el archivo base 20260820100000 ya no
-- refleja lo desplegado: acumula parches posteriores (nombre canonico con
-- private.moodle_v2_orientation_label/period_suffix, desired_grading_due_at,
-- filtro moodle_pilot_dedicated) que un create-or-replace desde ese archivo
-- revertiria en silencio.

alter table public.moodle_task_intents drop constraint moodle_task_intents_desired_visibility_check;
alter table public.moodle_task_intents add constraint moodle_task_intents_desired_visibility_check
  check (desired_visibility in ('visible', 'hidden', 'stealth'));

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.reconcile_moodle_task_intents_v1_impl(uuid)'::regprocedure
  ) into v_def;

  if position('v_visibility' in v_def) > 0 then
    return; -- ya aplicado
  end if;

  v_new := replace(v_def,
    '  v_desired_hash text;' || chr(10) || 'begin' || chr(10),
    '  v_desired_hash text;' || chr(10) || '  v_visibility text;' || chr(10) || 'begin' || chr(10));
  if v_new = v_def then
    raise exception 'No se pudo parchear el declare: no matcheo v_desired_hash text;/begin';
  end if;
  v_def := v_new;

  v_new := replace(v_def,
    'private.moodle_v2_period_suffix(v_unit.fecha_inicio)) end;' || chr(10)
      || '    v_desired_hash := private.moodle_v2_config_hash(',
    'private.moodle_v2_period_suffix(v_unit.fecha_inicio)) end;' || chr(10)
      || '    v_visibility := case when v_unit.mode = ''legacy_shared'' then ''visible'' else ''stealth'' end;' || chr(10)
      || '    v_desired_hash := private.moodle_v2_config_hash(');
  if v_new = v_def then
    raise exception 'No se pudo parchear el calculo de v_visibility: no matcheo el bloque desired_name/desired_hash';
  end if;
  v_def := v_new;

  v_new := replace(v_def,
    '''informes-'' || v_unit.orientacion_key, ''visible'', ''v1''',
    '''informes-'' || v_unit.orientacion_key, v_visibility, ''v1''');
  if v_new = v_def then
    raise exception 'No se pudo parchear la visibilidad del hash: no matcheo el llamado a moodle_v2_config_hash';
  end if;
  v_def := v_new;

  v_new := replace(v_def,
    'v_unit.grade_max, ''informes-'' || v_unit.orientacion_key, ''visible'',',
    'v_unit.grade_max, ''informes-'' || v_unit.orientacion_key, v_visibility,');
  if v_new = v_def then
    raise exception 'No se pudo parchear la visibilidad del insert: no matcheo la lista de values';
  end if;

  if position('v_visibility' in v_new) = 0 then
    raise exception 'El parche de visibilidad quedo incompleto; se aborta';
  end if;

  execute v_new;
end;
$patch$;

comment on function private.reconcile_moodle_task_intents_v1_impl(uuid) is
  'Reconciliador v2: declara la config deseada de cada unidad y su hash. Dedicated entra en visibilidad stealth (con link, fuera de la pagina del curso); legacy_shared se queda visible porque ya lo esta.';
