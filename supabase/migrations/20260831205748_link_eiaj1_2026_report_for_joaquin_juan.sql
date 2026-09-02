begin;

-- La PPS de la Escuela Integral de Jóvenes y Adolescentes N.° 1 se gestionó
-- fuera del circuito de convocatorias: es de un solo cupo y la consiguió el
-- propio estudiante, así que nunca hubo lanzamiento ni práctica cargada. En
-- Educacional ese caso es habitual, no una excepción.
--
-- El informe sí está entregado en la tarea 2026 del Campus (cmid 1162587,
-- aula_entregas 34). Pero la cola del jefe se arma desde public.practicas:
-- sin práctica no hay fila, el puente descartaba la lectura con
-- reason = 'no_practice_in_area' y el vencimiento nunca se calculaba porque
-- depende de una submitted_at ligada a una práctica.
--
-- Esta migración carga la práctica faltante y la vincula a mano con la tarea.
-- Las fechas y las horas reales no constan en ningún lado del sistema y
-- quedan en null a propósito, para completarlas después: la cola del jefe no
-- las usa, sólo hacen falta para acreditar.

do $$
declare
  -- Joaquín Franco Juan, legajo 32286, DNI 45028756
  v_estudiante constant uuid := '9b8ce3de-64ac-4055-850b-cb3aedf82196';
  -- aula_entregas: "Escuela Integral de Jóvenes y Adolescentes N.° 1",
  -- moodle_id 1162587, course_id 3615, academic_year 2026
  v_aula constant integer := 34;
  v_cmid constant bigint := 1162587;
  v_practica uuid;
begin
  select p.id
    into v_practica
  from public.practicas p
  where p.estudiante_id = v_estudiante
    and (
      exists (
        select 1
        from public.practica_moodle_tareas pm
        where pm.practica_id = p.id
          and pm.aula_entrega_id = v_aula
      )
      or p.nombre_institucion ilike '%Integral de Jóvenes y Adolescentes N.° 1%'
    );

  if v_practica is not null then
    raise notice 'La práctica ya existía (%); no se inserta nada.', v_practica;
    return;
  end if;

  insert into public.practicas (
    estudiante_id,
    lanzamiento_id,
    nombre_institucion,
    especialidad,
    tipo_actividad,
    estado,
    informe_estado
  ) values (
    v_estudiante,
    null,
    'Escuela Integral de Jóvenes y Adolescentes N.° 1',
    'Educacional',
    'pps',
    'Finalizada',
    'entregado'
  )
  returning id into v_practica;

  insert into public.practica_moodle_tareas (
    practica_id,
    aula_entrega_id,
    validation_status,
    link_source,
    rationale,
    validated_at
  ) values (
    v_practica,
    v_aula,
    'confirmed',
    'manual',
    'PPS de un solo cupo gestionada por el estudiante, sin lanzamiento. '
      || 'Se vincula a mano con la tarea 2026 de EIAJ N.° 1 (cmid '
      || v_cmid::text || ') para que la entrega deje de caer en '
      || 'no_practice_in_area y llegue a la cola de Educacional.',
    now()
  );

  update private.moodle_jefe_unmatched_diagnostics d
  set resolution_status = 'auto_linked',
      resolved_practica_id = v_practica,
      resolved_at = statement_timestamp(),
      resolution_evidence = jsonb_build_object(
        'ruleVersion', 'manual-link/eiaj1-2026',
        'reason', 'practica_creada_y_vinculada_a_mano'
      )
  where d.estudiante_id = v_estudiante
    and d.cmid = v_cmid
    and d.resolution_status = 'pending';
end
$$;

commit;
