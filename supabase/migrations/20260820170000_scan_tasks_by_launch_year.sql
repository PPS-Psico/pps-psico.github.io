-- El barrido de jefatura escaneaba por el anio de la PESTAÑA de la tarea, no
-- por el de la cohorte que la usa.
--
-- Detectado por el reclamo de una alumna de ASER: entrego su informe y nadie lo
-- corrigio en mas de 30 dias. Su PPS es de mayo 2026, pero apunta a la tarea
-- "Programa Aser" (cmid 805658), catalogada en 2025 porque es reutilizada. La
-- rama launch_tasks exigia ae.academic_year = anio corriente, asi que esa tarea
-- nunca entraba al barrido y sus entregas eran invisibles para jefatura.
--
-- No es un caso aislado: cuatro tareas de 2025 reciben cohortes 2026 y
-- acumulaban 19 informes entregados sin corregir (Ateneos Ulloa 7, Programa
-- Aser 6, Fundacion Kano 5, Camioneros 1).
--
-- La regla correcta no es "escanea las tareas de la pestaña de este anio" sino
-- "escanea las tareas que use una cohorte de este anio". catalog_tasks conserva
-- su filtro por anio: esa rama existe justamente para recorrer la pestaña.
--
-- Se usa regexp_replace tolerante a espacios porque el cuerpo desplegado trae
-- saltos \r y la indentacion no es estable entre despliegues. Sin
-- retrorreferencias: el ancla se repite literal en el reemplazo.

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.get_jefe_moodle_sync_tasks_for_areas_v1(text[])'::regprocedure
  ) into v_def;

  if position('l2.id = lm.lanzamiento_id' in v_def) > 0 then
    return;
  end if;

  v_new := regexp_replace(
    v_def,
    'lm\.orientacion_key = any\(p_areas\)\s+and\s+ae\.academic_year = v_year',
    'lm.orientacion_key = any(p_areas) and exists ( select 1 from public.lanzamientos_pps l2 where l2.id = lm.lanzamiento_id and coalesce(substring(l2.fecha_inicio from ''^(\d{4})'')::integer, 0) = v_year )'
  );

  if v_new = v_def then
    raise exception 'No se pudo parchear el barrido: no matcheo el filtro de launch_tasks';
  end if;
  if position('l2.id = lm.lanzamiento_id' in v_new) = 0 then
    raise exception 'El parche del barrido quedo incompleto; se aborta';
  end if;

  execute v_new;
end;
$patch$;
