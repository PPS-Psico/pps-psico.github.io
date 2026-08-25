begin;

-- Correccion de notas verificadas una por una contra Campus: nota del libro de
-- calificaciones + comentario de retroalimentacion de la tarea.
--
-- Origen: al destrabar la aplicacion de notas de Moodle quedaron 7 practicas con
-- una nota numerica cargada a mano distinta de la que informa Campus. El
-- backfill automatico las excluyo a proposito; aca se resuelven con la fuente a
-- la vista. Cada bloque cita el comentario literal.
--
-- Se marcan como `admin` porque la decision la toma coordinacion leyendo el
-- comentario, no el lector automatico: en las tareas compartidas el numero
-- suelto de Moodle no es la nota de ninguna de las dos PPS.
--
-- NO se toca Ariel Nahuelcheo: su tarea de Ateneos Ulloa (cmid 926287) informa
-- 90,00/100,00 para dos informes, y el comentario del 21/12/25 dice
-- "Informe Clinica de Adultos: 8 (Ocho) / Informe Clinica de Ninos: 9 (Nueve)".
-- El panel ya tiene 8 y 9: el conflicto era contra un numero que no es la nota
-- de ninguna de las dos.

do $$
declare
  v_rows integer;
begin
  ------------------------------------------------------------------
  -- Nara Lujan Diaz (42104635)
  ------------------------------------------------------------------

  -- Ateneos Ulloa, cmid 926287, comentario del 03/02/26:
  -- "Informe Ninos: Aprobado 8 (Ocho) / Informe Clinica de Adultos: 8 (Ocho)"
  -- El libro informa 80,00/100,00 para los dos informes.
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '6be895de-a025-432a-b458-bb0538fe4773' and nota = '10';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Diaz/Ateneos: se esperaba nota 10'; end if;

  -- Parque Industrial, cmid 805656: 90,00/100,00 (tarea en escala centesimal),
  -- comentario del 30/11/25 "Muy bien tu informe Nara". Una sola PPS.
  update public.practicas
  set nota = '9', nota_moodle = 9.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '97fe5483-c988-474d-8eda-312454e489ac' and nota = '10';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Diaz/Parque Industrial: se esperaba nota 10'; end if;

  ------------------------------------------------------------------
  -- Santiago Khalid Obando Saddi (44481004)
  ------------------------------------------------------------------

  -- Ministerio de Trabajo -20, cmid 802079: tarea centesimal (26 notas, todas
  -- entre 40 y 100). Informa 80,00/100,00 -> 8. Comentario del 01/09/25:
  -- "Informe de PPS: Aprobado. Muy buen informe Santiago."
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '6314b4bd-8273-4f24-9966-08cba147d06a' and nota = '9';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Obando/Ministerio 802079: se esperaba nota 9'; end if;

  -- Consumos Problematicos, cmid 795721: tarea en escala 1-10 (10 notas, todas
  -- entre 7 y 9; contrato direct_10). Informa 9,00 -> 9. Comentario del
  -- 10/11/25: "el informe esta aprobado. Lic Rossi Cynthia".
  update public.practicas
  set nota = '9', nota_moodle = 9.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'f1acc68d-68a9-4ba4-aa66-3e5e79ebe7fe' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Obando/Consumos: se esperaba nota 8'; end if;

  ------------------------------------------------------------------
  -- Daniel Chocolonea (43555204)
  ------------------------------------------------------------------

  -- Ministerio de Trabajo -32, cmid 805659: tarea en escala 1-10 (32 notas,
  -- todas entre 8 y 10; contrato direct_10). Informa 10,00 -> 10. Comentario
  -- del 11/02/26: "tu trabajo esta muy bien, esta aprobado. Lic Rossi Cynthia".
  update public.practicas
  set nota = '10', nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'b2f067ad-6b79-4236-8cc7-90880b18550f' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Chocolonea/Ministerio 805659: se esperaba nota 8'; end if;

  ------------------------------------------------------------------
  -- Guillermo Orlando Fabian Gonzalo (43891662)
  ------------------------------------------------------------------

  -- Randstad, cmid 1085736: tarea en escala 1-10 (6 notas, todas 9; contrato
  -- direct_10). Informa 9,00 -> 9. Comentario del 14/05/26: "tu trabajo esta
  -- aprobado. Lic Rossi Cynthia".
  update public.practicas
  set nota = '9', nota_moodle = 9.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '0ef38702-623e-47b9-923c-d8ab71f52fe0' and nota = '10';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Guillermo Gonzalo/Randstad: se esperaba nota 10'; end if;

  ------------------------------------------------------------------
  -- Lorena Shamanata Ledesma (32779049) - unico bloqueo activo del formulario
  ------------------------------------------------------------------

  -- Fundacion Tiempo, cmid 1085731: tarea compartida por las dos PPS. El libro
  -- informaba 0,00/100,00 y alguien lo registro como "Sin calificar" con
  -- procedencia admin, que es un estado y no una nota. Selva corrigio el
  -- 24/08/26 -el libro pasa a 70,00- y el comentario reparte:
  --   "Clinica de Ninos: 7 (Siete) / Clinica de Adultos: 7 (Siete)"
  update public.practicas
  set nota = '7', nota_moodle = 7.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '1c4b4288-d914-4d5a-9fa4-0059ea62ab50' and nota = 'Sin calificar';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Ledesma/Tiempo Adultos: se esperaba Sin calificar'; end if;

  update public.practicas
  set nota = '7', nota_moodle = 7.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'aab9fdda-e143-4d5c-9ff8-7289587e6758' and nota = 'Sin calificar';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Ledesma/Tiempo Ninos: se esperaba Sin calificar'; end if;
end $$;

commit;
