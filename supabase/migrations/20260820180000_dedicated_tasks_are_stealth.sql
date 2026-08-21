-- Las tareas de PPS son "disponibles pero no visibles en la pagina del curso".
--
-- Convencion del curso 3615, verificada en las tareas existentes: todas estan
-- en modo stealth. El alumno no las encuentra navegando el curso; llega por el
-- link de la tarjeta de Mi Panel que apunta a la suya. Las pestañas por anio
-- estan ocultas por diseño y solo se ven en modo de edicion.
--
-- La reconciliacion fijaba desired_visibility = 'visible', asi que la primera
-- tarea dedicada (Consultorio Psicologico, cmid 1222866) se creo visible en la
-- pagina del curso, contra la convencion. El valor 'stealth' ya estaba
-- permitido por el check de la tabla; solo faltaba usarlo.
--
-- Efecto sobre el piloto: cambia su desired_config_hash y la regla de
-- on-conflict lo pasa a needs_attention. Es correcto: la tarea en Moodle esta
-- efectivamente mal configurada y hay que corregirla y volver a verificarla.

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.reconcile_moodle_task_intents_v1_impl(uuid)'::regprocedure
  ) into v_def;

  if position('''stealth''' in v_def) > 0 then
    return;
  end if;

  -- Aparece dos veces: en la lista de columnas del insert y en el on-conflict.
  v_new := replace(v_def, '''informes-'' || v_unit.orientacion_key, ''visible''',
                          '''informes-'' || v_unit.orientacion_key, ''stealth''');
  v_new := replace(v_new, '''informes-'' || v_unit.orientacion_key, ''visible'',',
                          '''informes-'' || v_unit.orientacion_key, ''stealth'',');

  if v_new = v_def then
    raise exception 'No se pudo parchear la visibilidad: cambio la definicion';
  end if;
  if position('''stealth''' in v_new) = 0 then
    raise exception 'El parche de visibilidad quedo incompleto; se aborta';
  end if;

  execute v_new;
end;
$patch$;
