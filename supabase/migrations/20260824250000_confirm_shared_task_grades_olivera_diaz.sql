begin;

-- Cierra el reparto de tareas compartidas de las dos solicitudes de egreso en
-- curso (Olivera 32313 y Diaz 32315), leyendo el comentario de Campus.
--
-- Estas PPS no tienen observacion propia: comparten el espacio de entrega con
-- su PPS hermana, asi que Moodle guarda una sola entrega y la segunda quedaba
-- sin nota verificada aunque el informe estuviera corregido.

do $$
declare
  v_rows integer;
begin
  ------------------------------------------------------------------
  -- Lucia Belen Olivera (42166368)
  ------------------------------------------------------------------

  -- Ateneos Ulloa, cmid 926287, libro 100,00/100,00. Comentario del 05/02/26:
  --   "Muy bien ambos Informes: 10 (Diez)"
  -- El ateneo del 17/09 ya estaba verificado; este es el del 18/09.
  update public.practicas
  set nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '89c51faa-a973-4665-ac36-35b715655af4' and nota = '10' and nota_fuente is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Olivera/Ateneo 18-09: se esperaba nota 10 sin procedencia'; end if;

  -- Fundacion Tiempo, cmid 1085731, libro 100,00/100,00. Comentario del
  -- 15/05/26 asigna 10 a los dos informes (Selva escribio "Ninos" dos veces,
  -- pero ambos valores son 10 y el libro lo confirma).
  update public.practicas
  set nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'ac108b42-f0a6-42f6-99bf-126fc81bc96f' and nota = '10' and nota_fuente is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Olivera/Tiempo Ninos: se esperaba nota 10 sin procedencia'; end if;

  ------------------------------------------------------------------
  -- Franco Gabriel Diaz (41436371)
  ------------------------------------------------------------------

  -- Fundacion Tiempo, cmid 1085731, libro 80,00/100,00. Comentario del
  -- 15/05/2026:
  --   "Informe Clinica de Adultos: 8 (Ocho)
  --    Informe Clinica de Ninos y Adolescentes: 8 (Ocho)"
  update public.practicas
  set nota = '8', nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '6bc4887a-c12c-4feb-a58c-5c5ede6aa20c' and nota = 'Sin calificar';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Diaz/Tiempo Ninos: se esperaba Sin calificar'; end if;
end $$;

commit;
