-- "Recordarme calificar en" (gradingduedate) como parte del contrato de la tarea.
--
-- Hallazgo del spike manual del 2026-08-20 sobre el curso 3615: Moodle valida
-- las fechas entre sí y RECHAZA el guardado si "Recordarme calificar en" es
-- anterior a la fecha de entrega. El rechazo es silencioso desde el punto de
-- vista de un agente: el formulario vuelve a mostrarse, sin cartel arriba, y el
-- mensaje queda al pie del bloque Disponibilidad. Un agente que asuma que
-- "hice clic en Guardar" equivale a "se guardó" marcaría la tarea como creada
-- cuando en Moodle no existe.
--
-- El campo trae un default cercano a la fecha de creación, así que cualquier
-- tarea con entrega a meses vista lo viola por defecto. Es decir: NO es un
-- campo opcional, es obligatorio setearlo o la creación falla.
--
-- El valor no es arbitrario: es el plazo de corrección en término acordado,
-- 30 días desde la fecha de entrega. Los mismos 30 que ya definen el corte a
-- cola fría (30 de entrega + 30 de corrección = 60).
--
-- Alcance deliberado de esta migración:
--   - agrega la columna, su invariante y el backfill;
--   - hace que la reconciliación de intenciones la calcule.
-- NO toca `private.moodle_v2_config_hash` ni la firma de
-- `confirm_moodle_task_intent_v1`. Motivo: incluir el campo en el hash
-- cambiaría el `desired_config_hash` de las 212 intenciones legacy vigentes y
-- la regla de on-conflict las pasaría a `needs_attention` en la próxima
-- reconciliación, sin ningún beneficio mientras no exista una sola intención
-- `dedicated`. Ese cambio corresponde al mismo trabajo que construya el worker
-- de escritura, que es quien va a observar y reportar el campo.

alter table public.moodle_task_intents
  add column if not exists desired_grading_due_at timestamptz;

comment on column public.moodle_task_intents.desired_grading_due_at is
  'Moodle gradingduedate. Debe ser >= desired_due_at o Moodle rechaza el guardado sin aviso visible.';

-- Backfill antes de crear la restricción, para no fallar sobre filas vigentes.
update public.moodle_task_intents
set desired_grading_due_at = desired_due_at + interval '30 days'
where desired_grading_due_at is null
  and desired_due_at is not null;

alter table public.moodle_task_intents
  drop constraint if exists moodle_task_intents_grading_due_after_due_chk;
alter table public.moodle_task_intents
  add constraint moodle_task_intents_grading_due_after_due_chk
  check (
    desired_grading_due_at is null
    or desired_due_at is null
    or desired_grading_due_at >= desired_due_at
  );

-- Parcheo por reemplazo de texto sobre la definición vigente: evita
-- transcribir 120 líneas y falla ruidosamente si el patrón ya no existe.
do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.reconcile_moodle_task_intents_v1_impl(uuid)'::regprocedure
  ) into v_def;
  v_new := v_def;

  v_new := replace(v_new,
    E'  v_due_at timestamptz;',
    E'  v_due_at timestamptz;\n  v_grading_due_at timestamptz;');

  v_new := replace(v_new,
    E'    v_stable_key := ''PPS:''',
    E'    v_grading_due_at := case when v_due_at is not null\n      then v_due_at + interval ''30 days'' end;\n    v_stable_key := ''PPS:''');

  v_new := replace(v_new,
    E'      desired_open_at, desired_due_at, desired_grade_mode, desired_grade_max,',
    E'      desired_open_at, desired_due_at, desired_grading_due_at,\n      desired_grade_mode, desired_grade_max,');

  v_new := replace(v_new,
    E'      v_desired_name, v_open_at, v_due_at, v_unit.grade_conversion_mode,',
    E'      v_desired_name, v_open_at, v_due_at, v_grading_due_at, v_unit.grade_conversion_mode,');

  v_new := replace(v_new,
    E'      desired_due_at = excluded.desired_due_at,',
    E'      desired_due_at = excluded.desired_due_at,\n      desired_grading_due_at = excluded.desired_grading_due_at,');

  if v_new = v_def then
    raise exception 'No se pudo parchear reconcile_moodle_task_intents_v1_impl: cambió su definición';
  end if;
  if position('v_grading_due_at timestamptz' in v_new) = 0
     or position('desired_grading_due_at = excluded.desired_grading_due_at' in v_new) = 0 then
    raise exception 'El parche de gradingduedate quedó incompleto; se aborta';
  end if;

  execute v_new;
end;
$patch$;
