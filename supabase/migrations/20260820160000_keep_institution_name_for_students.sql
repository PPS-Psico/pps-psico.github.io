-- El estudiante debe ver el nombre de la institucion, nunca el rotulo interno.
--
-- Hasta ahora el nombre de la tarea Moodle ERA el nombre de la institucion, asi
-- que aula_entregas.institucion y aula_entregas.moodle_name coincidian y daba
-- igual cual leyera el panel. Al darle a las tareas dedicadas un nombre
-- canonico verboso para que coordinacion distinga relanzamientos ("Informe
-- final PPS · Consultorio Psicologico · Clinica · ago 2026"), ese supuesto se
-- rompio: el panel de entregas del alumno paso a mostrar el rotulo interno.
--
-- confirm_moodle_task_intent_v1 guardaba v_intent.desired_name en la columna
-- `institucion`, que semanticamente es la institucion y no la tarea. Ahora
-- guarda el nombre del lanzamiento y deja el rotulo canonico solo en
-- `moodle_name`, que es el nombre real de la actividad en Moodle y sirve para
-- coordinacion y diagnostico.

do $patch$
declare
  v_sig text := 'private.confirm_moodle_task_intent_v1_impl(uuid,uuid,bigint,bigint,'
    || 'text,text,text,timestamptz,timestamptz,timestamptz,text,numeric,text,text,jsonb)';
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(v_sig::regprocedure) into v_def;

  if position('l.nombre_pps from public.lanzamientos_pps l' in v_def) > 0 then
    return; -- ya aplicado
  end if;

  v_new := replace(v_def,
    'p_cmid::text, v_intent.desired_name, p_observed_name,',
    'p_cmid::text,'
    || ' coalesce((select l.nombre_pps from public.lanzamientos_pps l'
    || ' where l.id = v_intent.lanzamiento_id), v_intent.desired_name),'
    || ' p_observed_name,');

  if v_new = v_def then
    raise exception 'No se pudo parchear confirm_moodle_task_intent_v1_impl: cambio su definicion';
  end if;

  execute v_new;
end;
$patch$;

-- Repara la unica fila creada con el rotulo interno (Consultorio Psicologico).
update public.aula_entregas ae
set institucion = l.nombre_pps
from public.moodle_task_intents i
join public.lanzamientos_pps l on l.id = i.lanzamiento_id
where i.aula_entrega_id = ae.id
  and i.mode = 'dedicated'
  and ae.institucion is distinct from l.nombre_pps;
