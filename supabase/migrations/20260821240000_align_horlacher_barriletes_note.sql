begin;

-- Jhoselim Micaela Horlacher (DNI 44462529), "Barriletes en Bandada": Campus
-- registra 10,00 / 100,00 -- un diez cargado en escala 1-10 dentro de una tarea
-- configurada sobre 100, igual que las otras tres notas que la correctora dejo
-- ese mismo dia -- pero el panel conservaba el texto legado "Entregado (sin
-- corregir)".
--
-- Con la regla unificada la pantalla del estudiante ya lee 10 desde el
-- snapshot, mientras que la cola de jefaturas usa practicas.nota y seguia
-- mostrando el texto viejo. Se alinea el campo con lo que informa Campus.
do $$
declare
  v_rows integer;
begin
  update public.practicas p
  set nota = '10',
      nota_moodle = 10.00,
      nota_fuente = 'admin',
      informe_estado = 'calificado'
  from public.estudiantes e,
       public.moodle_grade_snapshots s,
       public.aula_entregas ae
  where p.estudiante_id = e.id
    and e.dni::text = '44462529'
    and s.practica_id = p.id
    and ae.id = s.aula_entrega_id
    and ae.moodle_id = '805657'
    and s.task_status = 'graded'
    and s.grade_value = 10
    and p.nota = 'Entregado (sin corregir)';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception
      'Horlacher/Barriletes: se esperaba 1 practica con nota legado y 10 en Campus, hubo %', v_rows;
  end if;
end $$;

commit;
