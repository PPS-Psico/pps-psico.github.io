begin;

-- Carga las notas del Relevamiento del Ejercicio Profesional leidas de Campus.
--
-- El Relevamiento es la unica PPS que se otorga a mano, sin lanzamiento. Como
-- el panel resuelve las tareas de Campus a traves del lanzamiento, ninguna de
-- las 32 practicas tenia nota verificada: quedaban en "Pend." aunque el informe
-- estuviera corregido. Lo reporto Santiago Oliva (31310) por mail y al revisar
-- aparecio que le pasaba a los 32.
--
-- Las entregas viven en tres tareas del curso 3615:
--   906164 "Relevamiento Prof."                              escala centesimal
--   906166 "Relevamiento del Ejercicio Profesional en Psic."  escala 1-10 (*)
--   906167 "Relevamiento Prof."                              escala centesimal
--
-- (*) Las 7 notas de 906166 son todas 8,00 sobre 100 y ninguna supera 10: la
--     tarea entera se califico en escala 1-10 aunque el contrato dijera
--     porcentaje. Se corrige el contrato mas abajo, igual que hizo
--     20260821200000 con las III Jornadas.
--
-- Corroboracion: de las 19 practicas, 11 ya tenian una nota de texto cargada a
-- mano y las 11 coinciden exactamente con lo que informa Campus, incluidas las
-- de escala 1-10. Ninguna discrepancia.
--
-- Quedan deliberadamente afuera:
--   · Guillermo Gonzalo (43891662): la tarea 906164 informa 0,00 y NO hay
--     comentario. Sin evidencia de cual es la nota, no se asigna ninguna.
--   · 11 practicas cuyos alumnos no aparecen en ninguna de las tres tareas.

-- El contrato de 906166 describia mal la escala.
update public.aula_entregas set grade_conversion_mode = 'direct_10'
where moodle_id = '906166' and grade_conversion_mode = 'percentage';

do $$
declare
  v_rows integer;
begin

  -- Legajo 28840 (DNI 21390077) - tarea 906167, libro 70,00 / 100,00
  update public.practicas
  set nota = '7', nota_moodle = 7.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '640be785-f99f-45c4-bc52-2375dd1e6086' and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 28840: estado inesperado'; end if;

  -- Legajo 33392 (DNI 25227574) - tarea 906164, libro 80,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '8075b150-7212-4fa3-a8e9-b0466eac82fc' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 33392: estado inesperado'; end if;

  -- Legajo 10339 (DNI 27593232) - tarea 906167, libro 70,00 / 100,00
  update public.practicas
  set nota = '7', nota_moodle = 7.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '4fc6d3b9-4950-4aab-96a3-164ab0c5f99d' and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 10339: estado inesperado'; end if;

  -- Legajo 32696 (DNI 30529609) - tarea 906164, libro 80,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'a2213270-3f4c-4b76-b6ef-7aeddfd0ca16' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32696: estado inesperado'; end if;

  -- Legajo 30918 (DNI 33919433) - tarea 906167, libro 90,00 / 100,00
  update public.practicas
  set nota = '9', nota_moodle = 9.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'af0ec356-b0e9-4587-821a-1fea5f9509f3' and nota = '9';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 30918: estado inesperado'; end if;

  -- Legajo 30220 (DNI 37174341) - tarea 906164, libro 80,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '8dd4f338-b1dc-4629-9b6c-4417fa486d9c' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 30220: estado inesperado'; end if;

  -- Legajo 33018 (DNI 38298406) - tarea 906167, libro 100,00 / 100,00
  update public.practicas
  set nota = '10', nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'c71a4802-69be-4eb9-908b-b84e783ff364' and nota = '10';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 33018: estado inesperado'; end if;

  -- Legajo 32952 (DNI 38810074) - tarea 906167, libro 70,00 / 100,00
  update public.practicas
  set nota = '7', nota_moodle = 7.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '7b518338-ff42-4cd9-b44a-966971c032e1' and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32952: estado inesperado'; end if;

  -- Legajo 32954 (DNI 38812881) - tarea 906166, libro 8,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '7b01b498-f178-44be-848c-796e94ab71e5' and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32954: estado inesperado'; end if;

  -- Legajo 32247 (DNI 41589957) - tarea 906164, libro 100,00 / 100,00
  update public.practicas
  set nota = '10', nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '70ddbf2e-04c6-4133-8178-81a6674481d5' and nota = '10';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32247: estado inesperado'; end if;

  -- Legajo 32376 (DNI 42848580) - tarea 906166, libro 8,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '84427f3b-784f-458c-beae-72230587d13b' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32376: estado inesperado'; end if;

  -- Legajo 29431 (DNI 44237573) - tarea 906166, libro 8,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '6df6b8df-dfad-4584-9d34-bd5ff3dfc370' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 29431: estado inesperado'; end if;

  -- Legajo 28202 (DNI 44342139) - tarea 906164, libro 90,00 / 100,00
  update public.practicas
  set nota = '9', nota_moodle = 9.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '9809d7bd-7018-4135-89d0-df9473c1af50' and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 28202: estado inesperado'; end if;

  -- Legajo 32320 (DNI 44463180) - tarea 906167, libro 100,00 / 100,00
  update public.practicas
  set nota = '10', nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'd9ff6276-b810-475f-a129-bbc82a056bb7' and nota = '10';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32320: estado inesperado'; end if;

  -- Legajo 32260 (DNI 44481886) - tarea 906166, libro 8,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '5372178c-7368-41c9-ad42-873d105bb864' and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32260: estado inesperado'; end if;

  -- Legajo 33374 (DNI 44825539) - tarea 906164, libro 80,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '0aecbba0-3580-406c-92f6-645916fcb58f' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 33374: estado inesperado'; end if;

  -- Legajo 32360 (DNI 44858276) - tarea 906164, libro 90,00 / 100,00
  update public.practicas
  set nota = '9', nota_moodle = 9.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '05081d67-dca3-4ab3-a31e-da49995687b8' and nota = '9';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32360: estado inesperado'; end if;

  -- Legajo 32330 (DNI 45141487) - tarea 906166, libro 8,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '15fadb79-a4ab-4804-aae5-16b1beb5d9e9' and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 32330: estado inesperado'; end if;

  -- Legajo 31235 (DNI 96233471) - tarea 906164, libro 80,00 / 100,00
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '5eb685a7-06a9-45e9-84d5-32f20424b16c' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Relevamiento legajo 31235: estado inesperado'; end if;

end $$;

commit;
