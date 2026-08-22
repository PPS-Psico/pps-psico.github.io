begin;

-- Corrección manual de notas en tareas Moodle compartidas por dos PPS.
--
-- En Fundación Tiempo y Ateneos Ulloa, un mismo espacio de entrega recibe dos
-- informes del mismo estudiante (Clínica de Adultos y Clínica de Niños). Moodle
-- tiene un único campo de calificación, así que Selva deja 0,00 / 100,00 en el
-- número y escribe las notas reales en "Comentarios de retroalimentación".
--
-- Ese 0 no es una nota: el trigger apply_moodle_grade_observation lo prorrateó
-- (0/100*10) y escribió nota = '0' con informe_estado = 'calificado'. Donde
-- alguien transcribió las notas del comentario a mano, además, quedaron
-- cruzadas.
--
-- Cada cambio de abajo se apoya en el texto literal del comentario, citado en
-- su bloque. Las notas se corrigen una por una porque el comentario asigna una
-- nota distinta a cada PPS: no hay regla automática que las reparta.
--
-- Los snapshots afectados tienen scan_closed = true, así que el trigger sale
-- temprano y estas correcciones no se pisan en el próximo escaneo.
do $$
declare
  v_rows integer;
begin
  -- Guarda genérica: cada UPDATE debe tocar exactamente una fila y encontrar
  -- el valor previo esperado. Si algo ya cambió, la migración aborta entera.

  ------------------------------------------------------------------
  -- A. Notas cruzadas al transcribir el comentario
  ------------------------------------------------------------------

  -- Carlos José Luna (DNI 96233471) — Ateneos Ulloa, cmid 926287, 17/12/25:
  -- "Informe Clínica de Adultos Calificación: 8 (Ocho)
  --  Informe Clínica de Niños, Calificación: 9 (Nueve)"
  -- Mi Panel tenía Adultos 9 y Niños 8: invertido.
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin'
  where id = '00b7c1af-273a-4d0c-8ed1-84bccb2ff8dc' and nota = '9';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Luna/Adultos Jueves: se esperaba nota 9, no se actualizo'; end if;

  update public.practicas
  set nota = '9', nota_moodle = 9.00, nota_fuente = 'admin'
  where id = '508d89b7-e673-4a09-a5e5-e50348b894a8' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Luna/Ninos: se esperaba nota 8, no se actualizo'; end if;

  -- Eugenia Zahira Dantas (DNI 43555082) — Ateneos Ulloa, cmid 926287, 17/12/25:
  -- "Informe Clínica de Adultos. 8 (Ocho)
  --  Informe Ateneo Martes 10 (Diez)"
  -- Los archivos entregados son "INFORME ATENEO JUEVES" e "Informe Ateneo
  -- Martes": el 10 es explícitamente de Martes, y el 8 corresponde al restante
  -- (Jueves). Mi Panel tenía Martes 8 y Jueves 10: invertido.
  update public.practicas
  set nota = '10', nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '7e746c64-a87a-447b-8896-1eba297f3258' and nota = '8';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Dantas/Adultos Martes: se esperaba nota 8, no se actualizo'; end if;

  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin'
  where id = 'cca0c4bc-27c3-460a-8f82-2b165e4cfbe7' and nota = '10';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Dantas/Adultos Jueves: se esperaba nota 10, no se actualizo'; end if;

  ------------------------------------------------------------------
  -- B. Ceros que el trigger tomó por nota, sin corrección real detrás
  ------------------------------------------------------------------

  -- Ledesma Lorena Shamanata (DNI 32779049) — Fundación Tiempo, cmid 1085731,
  -- 15/05/2026: "Lorena, no me queda claro si asististe a los Ateneos de
  -- Clínica de Niños y de Adultos. Si fuera así, son dos Informes. Además se
  -- agrega Bibliografía. Confirma por mails por favor."
  -- No hay ninguna nota asignada: el 0 es el placeholder de Moodle.
  update public.practicas
  set nota = 'Sin calificar', nota_moodle = null, nota_fuente = 'admin',
      informe_estado = 'entregado'
  where id in (
    '1c4b4288-d914-4d5a-9fa4-0059ea62ab50',
    'aab9fdda-e143-4d5c-9ff8-7289587e6758'
  ) and nota = '0';
  get diagnostics v_rows = row_count;
  if v_rows <> 2 then raise exception 'Ledesma: se esperaban 2 practicas con nota 0, se actualizaron %', v_rows; end if;

  ------------------------------------------------------------------
  -- C. Informes sin corregir marcados como calificados
  ------------------------------------------------------------------

  -- Garay Evelyn (DNI 37676952) — Fundación Tiempo, 15/05/26: "Evelyn se
  -- presenta un Informe por Clínica de Adultos y otro Informe por Clínica de
  -- Niños y Adolescentes. Cuando lo realices enviame un mails asi te corrijo."
  update public.practicas
  set informe_estado = 'entregado'
  where id = '0c472aac-4d91-40cb-b036-c6efaff86439' and informe_estado = 'calificado';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Garay: se esperaba informe_estado calificado'; end if;

  -- Fabrizio Tomás Cossio (DNI 42264924) — Ateneos Ulloa, 26/06/26: "Fabricio
  -- no subiste el Informe". Después sí lo subió (18/08/2026) y todavía no fue
  -- corregido, así que corresponde "entregado", no "calificado".
  update public.practicas
  set informe_estado = 'entregado'
  where id = '4733fa20-e21f-42b2-be29-db7923e437fe' and informe_estado = 'calificado';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Cossio: se esperaba informe_estado calificado'; end if;

  ------------------------------------------------------------------
  -- D. Nota correcta a la que le faltaba el estado
  ------------------------------------------------------------------

  -- Maria Laura Bechis (DNI 34798268) — Fundación Tiempo, 15/05/26:
  -- "Informe Clínica de Adultos: 8 (Ocho)
  --  Informe Clínica de Niños y Adolescentes: 9 (Nueve)"
  -- Ambas notas ya estaban bien cargadas; sólo faltaba el estado en Niños.
  update public.practicas
  set informe_estado = 'calificado'
  where id = '9ea18184-766a-46b4-a38d-f065417bb49e'
    and nota = '9' and informe_estado is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Bechis/Ninos: se esperaba nota 9 sin informe_estado'; end if;
end $$;

commit;
