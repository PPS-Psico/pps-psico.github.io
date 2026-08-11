-- Los estados Moodle son monotónicos: un error de lectura posterior no puede
-- borrar una entrega ya confirmada y una calificación es terminal.

create or replace function private.moodle_grade_status_rank(p_status text)
returns smallint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_status
    when 'graded' then 4
    when 'submitted' then 3
    when 'not_submitted' then 2
    else 1
  end::smallint;
$$;

revoke all on function private.moodle_grade_status_rank(text)
  from public, anon, authenticated;

-- Repara snapshots que ya habían retrocedido. Se conserva el estado de mayor
-- avance y, dentro del mismo estado, la observación más reciente.
with canonical_observation as (
  select distinct on (o.practica_id, o.cmid)
    o.practica_id,
    o.cmid,
    o.id,
    o.estudiante_id,
    o.lanzamiento_id,
    o.aula_entrega_id,
    o.task_status,
    o.submitted,
    o.grade_value,
    o.grade_max,
    o.grade_display,
    o.graded_at_display,
    o.observed_at,
    o.received_at,
    o.confidence
  from public.moodle_grade_observations o
  order by
    o.practica_id,
    o.cmid,
    private.moodle_grade_status_rank(o.task_status) desc,
    o.observed_at desc,
    o.received_at desc
)
update public.moodle_grade_snapshots s
set latest_observation_id = o.id,
    estudiante_id = o.estudiante_id,
    lanzamiento_id = o.lanzamiento_id,
    aula_entrega_id = o.aula_entrega_id,
    task_status = o.task_status,
    submitted = o.submitted,
    grade_value = o.grade_value,
    grade_max = o.grade_max,
    grade_display = o.grade_display,
    graded_at_display = o.graded_at_display,
    observed_at = o.observed_at,
    received_at = o.received_at,
    confidence = o.confidence
from canonical_observation o
where s.practica_id = o.practica_id
  and s.cmid = o.cmid
  and (
    private.moodle_grade_status_rank(o.task_status)
      > private.moodle_grade_status_rank(s.task_status)
    or (
      private.moodle_grade_status_rank(o.task_status)
        = private.moodle_grade_status_rank(s.task_status)
      and o.observed_at > s.observed_at
    )
  );

create or replace function private.preserve_moodle_grade_snapshot_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- La primera nota válida cierra la tarea. Ninguna lectura posterior, ni
  -- siquiera otra nota, reemplaza el registro final ya guardado.
  if old.task_status = 'graded' then
    return old;
  end if;

  -- parse_error/no_access son observaciones útiles para auditoría, pero no
  -- degradan un estado confirmado en el snapshot visible.
  if private.moodle_grade_status_rank(new.task_status)
     < private.moodle_grade_status_rank(old.task_status) then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.preserve_moodle_grade_snapshot_progress()
  from public, anon, authenticated;

drop trigger if exists preserve_moodle_grade_snapshot_progress_trigger
  on public.moodle_grade_snapshots;
create trigger preserve_moodle_grade_snapshot_progress_trigger
before update on public.moodle_grade_snapshots
for each row execute function private.preserve_moodle_grade_snapshot_progress();

comment on function private.preserve_moodle_grade_snapshot_progress() is
  'Impide regresiones de estado Moodle y vuelve terminal la primera calificación guardada.';

-- La aplicación de la nota adopta el mismo cierre terminal. El lock sobre la
-- práctica serializa dos lecturas concurrentes antes de consultar la bitácora.
create or replace function private.apply_moodle_grade_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_note text;
  normalized_grade numeric;
  note_text text;
  conversion_rule text;
begin
  if new.task_status <> 'graded'
     or new.grade_value is null
     or new.grade_max is null
     or new.grade_max <= 0 then
    return new;
  end if;

  if new.grade_max > 10 and new.grade_value <= 10 then
    normalized_grade := round(new.grade_value, 2);
    conversion_rule := 'direct_legacy_ten_point';
  else
    normalized_grade := round((new.grade_value / new.grade_max) * 10, 2);
    conversion_rule := 'normalized_to_ten';
  end if;

  if normalized_grade < 0 or normalized_grade > 10 then
    raise exception 'La nota Moodle normalizada queda fuera del rango 0-10.'
      using errcode = '22003';
  end if;

  note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');

  select p.nota
    into current_note
  from public.practicas p
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id
  for update;

  if not found then
    raise exception 'La practica observada no pertenece al estudiante validado.'
      using errcode = '23503';
  end if;

  -- Una aplicación previa para esta práctica+tarea convierte la nota en final.
  -- El ledger de observaciones puede seguir auditando intentos de clientes
  -- antiguos, pero practicas.nota no vuelve a tocarse.
  if exists (
    select 1
    from private.moodle_grade_applications a
    where a.practica_id = new.practica_id
      and a.cmid = new.cmid
  ) then
    return new;
  end if;

  if current_note is distinct from note_text then
    update public.practicas
    set nota = note_text
    where id = new.practica_id;
  end if;

  insert into private.moodle_grade_applications (
    source_observation_id,
    source_observed_at,
    estudiante_id,
    practica_id,
    cmid,
    previous_note,
    applied_note,
    grade_value,
    grade_max,
    conversion_rule,
    confidence,
    changed
  ) values (
    new.id,
    new.observed_at,
    new.estudiante_id,
    new.practica_id,
    new.cmid,
    current_note,
    note_text,
    new.grade_value,
    new.grade_max,
    conversion_rule,
    new.confidence,
    current_note is distinct from note_text
  );

  return new;
end;
$$;

revoke all on function private.apply_moodle_grade_observation()
  from public, anon, authenticated;

comment on function private.apply_moodle_grade_observation() is
  'Aplica una sola nota Moodle final por práctica+tarea y conserva before/after en la bitácora privada.';

-- Las observaciones calificadas anteriores a la automatización no tenían fila
-- en la bitácora. Se completa ese faltante y se aplica su nota sin borrar
-- ningún antecedente existente.
do $$
declare
  observed record;
  current_note text;
  normalized_grade numeric;
  note_text text;
  conversion_rule text;
begin
  for observed in
    select distinct on (o.practica_id, o.cmid)
      o.*
    from public.moodle_grade_observations o
    where o.task_status = 'graded'
      and not exists (
        select 1
        from private.moodle_grade_applications a
        where a.practica_id = o.practica_id
          and a.cmid = o.cmid
      )
    order by o.practica_id, o.cmid, o.observed_at desc, o.received_at desc
  loop
    if observed.grade_max > 10 and observed.grade_value <= 10 then
      normalized_grade := round(observed.grade_value, 2);
      conversion_rule := 'direct_legacy_ten_point';
    else
      normalized_grade := round((observed.grade_value / observed.grade_max) * 10, 2);
      conversion_rule := 'normalized_to_ten';
    end if;

    note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');

    select p.nota
      into current_note
    from public.practicas p
    where p.id = observed.practica_id
      and p.estudiante_id = observed.estudiante_id
    for update;

    if not found then
      continue;
    end if;

    if current_note is distinct from note_text then
      update public.practicas
      set nota = note_text
      where id = observed.practica_id;
    end if;

    insert into private.moodle_grade_applications (
      source_observation_id,
      source_observed_at,
      estudiante_id,
      practica_id,
      cmid,
      previous_note,
      applied_note,
      grade_value,
      grade_max,
      conversion_rule,
      confidence,
      changed
    ) values (
      observed.id,
      observed.observed_at,
      observed.estudiante_id,
      observed.practica_id,
      observed.cmid,
      current_note,
      note_text,
      observed.grade_value,
      observed.grade_max,
      conversion_rule,
      observed.confidence,
      current_note is distinct from note_text
    );
  end loop;
end;
$$;
