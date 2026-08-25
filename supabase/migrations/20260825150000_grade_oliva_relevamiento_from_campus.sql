begin;

-- Santiago Joaquin Oliva Soto (31310) - Relevamiento del Ejercicio Profesional.
--
-- El Relevamiento es una PPS especial: se otorga a mano a determinados
-- estudiantes -acredita 20 horas- y por eso la practica NO tiene lanzamiento.
-- El panel resuelve la tarea de Campus a traves del lanzamiento, asi que sin el
-- no hay vinculo, no hay lectura y la fila queda en "Pend." aunque el informe
-- este entregado y corregido. El alumno lo reporto por mail: "desaparecio la
-- pestana... no puedo abrir mi informe y mi nota".
--
-- Evidencia en Campus, tarea 906164 "Relevamiento Prof." (escala porcentual):
--   Entrega: "PPS Relevamiento Profesional-S. Oliva-31310 (2).docx", 10/12/2025
--   Libro:   100,00 / 100,00  ->  10
--   Comentario del 21/12/25: "Muy bien tu Informe Santiago. Lic. Selva A. Estrella"
--
-- Se carga como `admin` porque la lectura la hizo coordinacion: sin lanzamiento,
-- el lector automatico no puede llegar a esta tarea.

do $$
declare
  v_rows integer;
begin
  update public.practicas
  set nota = '10', nota_moodle = 10.00, nota_fuente = 'admin', informe_estado = 'calificado'
  where id = '45e77e9a-3d18-462f-8389-3c68781adc74'
    and nota is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Oliva/Relevamiento: se esperaba la practica sin nota, filas afectadas %', v_rows;
  end if;
end $$;

commit;
