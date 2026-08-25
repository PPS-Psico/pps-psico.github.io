begin;

-- Reparto de notas de tareas compartidas, leido del comentario de Campus.
--
-- En Fundacion Tiempo un mismo espacio recibe el informe de Clinica de Adultos
-- y el de Clinica de Ninos. Moodle tiene un unico campo de nota, asi que la
-- catedra pone un numero cualquiera -a veces 0- y escribe la nota real de cada
-- PPS en el comentario. Sin leerlo, esas PPS quedan en "Sin calificar".
--
-- Fabrizio Cossio (25686) queda deliberadamente afuera: su comentario del
-- 26/06/26 dice "Fabricio no subiste el Informe". No hay nota que repartir,
-- es una entrega pendiente del alumno.

do $$
declare
  v_rows integer;
begin
  ------------------------------------------------------------------
  -- Evelyn Garay (37676952) - Fundacion Tiempo, cmid 1085731
  -- Libro: 60,00/100,00. Comentario del 24/08/26:
  --   "Informe Clinica de Adultos: 6 (Seis)
  --    Informe Clinica de Ninos: 6 (Seis)"
  ------------------------------------------------------------------
  update public.practicas
  set nota = '6', nota_moodle = 6.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '0c472aac-4d91-40cb-b036-c6efaff86439' and nota = 'Sin calificar';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Garay/Adultos: se esperaba Sin calificar'; end if;

  update public.practicas
  set nota = '6', nota_moodle = 6.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '19de093d-2a03-4ab7-8931-0fcfe96b2109' and nota = 'Sin calificar';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Garay/Ninos: se esperaba Sin calificar'; end if;

  ------------------------------------------------------------------
  -- Maria Laura Bechis (34798268) - Fundacion Tiempo, cmid 1085731
  -- Libro: 0,00/100,00 (marcador, no nota). Comentario del 15/05/26:
  --   "Informe Clinica de Adultos: 8 (Ocho)
  --    Informe Clinica de Ninos y Adolescentes: 9 (Nueve)"
  -- Los numeros del panel ya eran correctos; les faltaba procedencia, y sin
  -- ella no contaban para el promedio.
  ------------------------------------------------------------------
  update public.practicas
  set nota_moodle = 8.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = 'cff6dbc6-9ad2-46bb-8c93-5e61ac19a16f' and nota = '8' and nota_fuente is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Bechis/Adultos: se esperaba nota 8 sin procedencia'; end if;

  update public.practicas
  set nota_moodle = 9.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '9ea18184-766a-46b4-a38d-f065417bb49e' and nota = '9' and nota_fuente is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Bechis/Ninos: se esperaba nota 9 sin procedencia'; end if;
end $$;

commit;
