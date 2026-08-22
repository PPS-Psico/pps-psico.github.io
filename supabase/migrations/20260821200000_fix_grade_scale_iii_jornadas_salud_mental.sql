begin;

-- "III Jornadas de Salud Mental" (cmid 919158) quedó configurada como
-- `percentage`, pero sus dos únicas notas son 8,00 / 100,00 cargadas con un
-- minuto de diferencia (10/11/2025 14:20 y 14:21). Leídas como porcentaje dan
-- 0,8 y el panel muestra 1 a las dos estudiantes.
--
-- A diferencia de "Barriletes en Bandada" o "Parque Industrial" -- donde
-- conviven notas de 40 a 100 y el 10 suelto es un error de carga puntual del
-- docente -- acá NO hay ninguna nota en escala centesimal: la tarea entera se
-- calificó en escala 1-10. Por eso corresponde corregir el contrato de la
-- tarea y no los valores, que quedan intactos.
--
-- Sin filas en escala centesimal esta corrección es segura; la guarda de abajo
-- lo verifica antes de aplicar y aborta si el supuesto dejó de valer.
do $$
declare
  v_task_id integer;
  v_centesimal integer;
begin
  select ae.id into v_task_id
  from public.aula_entregas ae
  where ae.moodle_id = '919158'
    and ae.course_id = 3615;

  if v_task_id is null then
    raise exception 'No se encontro la tarea Moodle 919158';
  end if;

  select count(*) into v_centesimal
  from public.moodle_grade_snapshots s
  where s.aula_entrega_id = v_task_id
    and s.grade_value is not null
    and s.grade_value > 10;

  if v_centesimal > 0 then
    raise exception
      'La tarea 919158 tiene % notas en escala centesimal; no se puede reinterpretar como direct_10',
      v_centesimal;
  end if;

  update public.aula_entregas
  set grade_conversion_mode = 'direct_10'
  where id = v_task_id;
end $$;

commit;
