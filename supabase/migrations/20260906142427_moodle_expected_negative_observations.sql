begin;

-- Absence only concerns confirmed obligations or a previously observed case.
-- Positive observations remain discoverable without any prior association.
create function private.moodle_capture_negative_allowed_v1(
  p_student uuid, p_course bigint, p_cmid bigint, p_moodle_user bigint
) returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from private.moodle_evidence_cases c
    where c.course_id=p_course and c.cmid=p_cmid
      and (c.moodle_user_id=p_moodle_user or c.estudiante_id=p_student)
  ) or exists (
    select 1 from public.practicas p
    join public.aula_entregas a on a.course_id=p_course and a.moodle_id=p_cmid::text
    where p.estudiante_id=p_student and (
      exists (select 1 from public.practica_moodle_tareas l
        where l.practica_id=p.id and l.aula_entrega_id=a.id and l.validation_status='confirmed')
      or (not exists(select 1 from public.practica_moodle_tareas l
          where l.practica_id=p.id and l.validation_status='confirmed')
        and exists(select 1 from public.lanzamiento_moodle_tareas l
          where l.lanzamiento_id=p.lanzamiento_id and l.aula_entrega_id=a.id
            and l.validation_status='confirmed'
            and private.jefe_text_has_area(coalesce(p.especialidad,''),l.orientacion_key)))
    )
  );
$$;
revoke all on function private.moodle_capture_negative_allowed_v1 from public,anon,authenticated;

do $patch$
declare v_definition text; v_updated text;
begin
  select pg_get_functiondef('private.capture_jefe_moodle_evidence_v1(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure) into v_definition;
  v_updated:=replace(v_definition,
    '        v_content := private.moodle_evidence_content_v1(v_row);',
    '        if v_row->>''status''=''not_submitted'' and not private.moodle_capture_negative_allowed_v1(v_student,p_course_id,(v_task->>''cmid'')::bigint,(v_row->>''moodleUserId'')::bigint) then
          continue;
        end if;
        v_content := private.moodle_evidence_content_v1(v_row);');
  if v_updated=v_definition then raise exception 'Negative observation scope anchor missing'; end if;
  execute v_updated;
end $patch$;

commit;
