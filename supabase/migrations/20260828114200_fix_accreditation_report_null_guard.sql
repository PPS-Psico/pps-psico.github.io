begin;

-- PostgreSQL bool_and ignores NULL inputs. In the original evaluator, a
-- student with graded reports plus one report whose state was NULL could be
-- interpreted as having every report approved. Make the predicate total so
-- every state other than the explicit terminal value `calificado` is false.
do $migration$
declare
  v_definition text;
  v_unsafe_expression constant text :=
    'coalesce(bool_and(p.informe_estado = ''calificado''), false)';
  v_safe_expression constant text :=
    'coalesce(bool_and(coalesce(p.informe_estado = ''calificado'', false)), false)';
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'evaluate_student_accreditation_transition_v1'
    and pg_get_function_identity_arguments(p.oid) = 'p_student_id uuid, p_trigger_observation_id uuid';

  if v_definition is null then
    raise exception 'private.evaluate_student_accreditation_transition_v1(uuid, uuid) does not exist';
  end if;

  -- Allows a clean replay if the original definition is corrected in a later
  -- squash without weakening the live hotfix.
  if position(v_safe_expression in v_definition) > 0 then
    return;
  end if;

  if position(v_unsafe_expression in v_definition) = 0 then
    raise exception 'Expected report aggregation was not found; refusing a broad function rewrite';
  end if;

  execute replace(v_definition, v_unsafe_expression, v_safe_expression);
end;
$migration$;

-- CREATE OR REPLACE preserves existing grants, but these revocations keep the
-- service-only contract explicit and safe on a clean database replay.
revoke all on function private.evaluate_student_accreditation_transition_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.evaluate_student_accreditation_transition_v1(uuid, uuid)
  to service_role;

comment on function private.evaluate_student_accreditation_transition_v1(uuid, uuid) is
  'Evalúa la transición híbrida de acreditación. Sólo informe_estado=calificado cuenta como informe aprobado; NULL y cualquier otro estado quedan pendientes.';

commit;
