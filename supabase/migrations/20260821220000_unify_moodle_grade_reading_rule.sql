begin;

-- Una sola regla para leer una nota de Moodle, compartida por toda la base.
--
-- La escala de cada tarea vive en aula_entregas.grade_conversion_mode, pero
-- cuatro funciones la interpretaban por su cuenta y ninguna igual:
--
--   apply_moodle_grade_observation      conoce el modo, prorratea el resto
--   jefe_report_rows_v1                 "hay grade_value" = calificado
--   get_moodle_grade_discrepancies      heuristica propia, sin mirar el modo
--   get_moodle_task_unit_summaries_v1   conoce el modo, prorratea el resto
--
-- El frontend ya centralizo esto en readMoodleGrade (moodleReportStatus.ts).
-- Estas funciones son su equivalente en SQL, con la misma regla del dominio:
-- en PPS no existe una nota menor a 4, un informe insuficiente se rehace. De
-- ahi se siguen las dos lecturas que faltaban:
--
--   * un valor entre 4 y 10 que al prorratearse caeria bajo el piso es una
--     nota de escala 1-10 cargada en una tarea configurada sobre 100
--     ("10,00 / 100,00" es un diez, no un diez por ciento);
--   * cualquier otro valor bajo el piso -- tipicamente el 0 que deja Moodle
--     cuando la correccion real va escrita en los comentarios -- no es una
--     nota, y no debe convertirse en una.
--
-- Diferencia con el frontend: aca se conservan dos decimales, porque `nota`
-- guarda el valor y la pantalla es la que redondea al mostrarlo.
create or replace function private.read_moodle_grade_v1(
  p_grade_value numeric,
  p_grade_max numeric,
  p_mode text
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_grade_value is null then null
    -- pass_fail no produce un numero; lo resuelve is_passing_moodle_grade_v1.
    when p_mode = 'pass_fail' then null
    when p_mode = 'direct_10' then
      case
        when p_grade_value >= 4 and p_grade_value <= 10 then round(p_grade_value, 2)
        else null
      end
    when p_grade_max is null or p_grade_max <= 0 then null
    when p_grade_value < 0 or p_grade_value > p_grade_max then null
    -- El piso se evalua sin redondear: un 39/100 no puede volverse un 4.
    when (p_grade_value / p_grade_max) * 10 >= 4
      then round((p_grade_value / p_grade_max) * 10, 2)
    when p_grade_value >= 4 and p_grade_value <= 10 then round(p_grade_value, 2)
    else null
  end;
$$;

comment on function private.read_moodle_grade_v1(numeric, numeric, text) is
  'Nota de Moodle llevada a escala 1-10 segun el contrato de la tarea. NULL = el numero no es una nota usable. Espejo SQL de readMoodleGrade del frontend.';

create or replace function private.is_passing_moodle_grade_v1(
  p_grade_value numeric,
  p_grade_max numeric,
  p_mode text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_grade_value is null then false
    when p_mode = 'pass_fail' then p_grade_value > 0
    else coalesce(private.read_moodle_grade_v1(p_grade_value, p_grade_max, p_mode) >= 4, false)
  end;
$$;

comment on function private.is_passing_moodle_grade_v1(numeric, numeric, text) is
  'Aprobacion segun el contrato de escala de la tarea. Un numero no interpretable nunca aprueba.';

grant execute on function private.read_moodle_grade_v1(numeric, numeric, text) to authenticated, service_role;
grant execute on function private.is_passing_moodle_grade_v1(numeric, numeric, text) to authenticated, service_role;

------------------------------------------------------------------------
-- 1. El trigger que escribe practicas.nota
------------------------------------------------------------------------
-- Era el que convertia el 0 de Moodle en nota = '0' e informe_estado =
-- 'calificado'. Ahora, si el numero no es una nota, no escribe nota y deja el
-- informe como entregado: Moodle dice "calificado" pero la correccion real
-- todavia no esta registrada.
create or replace function private.apply_moodle_grade_observation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_note text;
  note_text text;
  normalized_grade numeric;
  conversion_mode text;
  conversion_rule text;
  current_revision integer := 1;
  current_scan_closed boolean := false;
  application_id uuid;
  next_report_status text;
  grade_is_usable boolean := false;
begin
  select a.grade_conversion_mode
    into conversion_mode
  from public.aula_entregas a
  where a.id = new.aula_entrega_id;

  if new.task_status = 'graded' then
    grade_is_usable := conversion_mode = 'pass_fail'
      or private.read_moodle_grade_v1(new.grade_value, new.grade_max, conversion_mode) is not null;
  end if;

  next_report_status := case
    when new.task_status = 'graded' and grade_is_usable then 'calificado'
    -- Moodle marca la tarea calificada pero el numero no es una nota: el
    -- informe sigue esperando su correccion real.
    when new.task_status = 'graded' then 'entregado'
    when new.task_status = 'submitted' then 'entregado'
    when new.task_status = 'not_submitted' then 'sin_entrega'
    else 'a_revisar'
  end;

  -- El estado operativo progresa de forma monotona y ya no contamina nota.
  update public.practicas p
  set informe_estado = case
    when p.informe_estado = 'calificado' then p.informe_estado
    when p.informe_estado = 'entregado' and next_report_status in ('sin_entrega', 'a_revisar')
      then p.informe_estado
    when p.informe_estado = 'sin_entrega' and next_report_status = 'a_revisar'
      then p.informe_estado
    else next_report_status
  end
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id;

  if new.task_status <> 'graded'
     or new.grade_value is null
     or new.grade_max is null
     or new.grade_max <= 0
     or not grade_is_usable then
    return new;
  end if;

  select s.grade_revision, s.scan_closed
    into current_revision, current_scan_closed
  from public.moodle_grade_snapshots s
  where s.practica_id = new.practica_id
    and s.cmid = new.cmid
  for update;

  -- Sin fila previa es la revision inicial (1), no NULL: SELECT INTO vacio
  -- asigna NULL aunque exista el inicializador.
  if not found then
    current_revision := 1;
    current_scan_closed := false;
  else
    current_revision := coalesce(current_revision, 1);
  end if;

  if found and current_scan_closed then
    return new;
  end if;

  if exists (
    select 1 from private.moodle_grade_finalizations f
    where f.practica_id = new.practica_id
      and f.cmid = new.cmid
      and f.grade_revision = current_revision
  ) then
    return new;
  end if;

  if conversion_mode = 'pass_fail' then
    normalized_grade := null;
    note_text := case when new.grade_value > 0 then 'Aprobado' else 'Desaprobado' end;
    conversion_rule := 'explicit_pass_fail';
  else
    normalized_grade := private.read_moodle_grade_v1(
      new.grade_value, new.grade_max, conversion_mode
    );
    note_text := rtrim(rtrim(to_char(normalized_grade, 'FM999999990.00'), '0'), '.');
    conversion_rule := case
      when conversion_mode = 'direct_10' then 'explicit_direct_10'
      when normalized_grade = round(new.grade_value, 2)
        and (new.grade_value / new.grade_max) * 10 < 4 then 'recovered_ten_scale'
      else 'explicit_percentage'
    end;
  end if;

  if normalized_grade is not null and (normalized_grade < 0 or normalized_grade > 10) then
    raise exception 'La nota Moodle normalizada queda fuera del rango 0-10.'
      using errcode = '22003';
  end if;

  select p.nota into current_note
  from public.practicas p
  where p.id = new.practica_id
    and p.estudiante_id = new.estudiante_id
  for update;

  if not found then
    raise exception 'La practica observada no pertenece al estudiante validado.'
      using errcode = '23503';
  end if;

  update public.practicas
  set nota = note_text,
      informe_estado = 'calificado',
      nota_moodle = normalized_grade,
      nota_fuente = new.confidence,
      nota_actualizada_at = new.observed_at,
      nota_moodle_cmid = new.cmid
  where id = new.practica_id;

  insert into private.moodle_grade_applications (
    source_observation_id, source_observed_at, estudiante_id, practica_id,
    cmid, previous_note, applied_note, grade_value, grade_max,
    conversion_rule, confidence, changed, grade_revision
  ) values (
    new.id, new.observed_at, new.estudiante_id, new.practica_id,
    new.cmid, current_note, note_text, new.grade_value, new.grade_max,
    conversion_rule, new.confidence, current_note is distinct from note_text,
    current_revision
  ) returning id into application_id;

  insert into private.moodle_grade_finalizations (
    practica_id, cmid, grade_revision, source_observation_id, application_id
  ) values (
    new.practica_id, new.cmid, current_revision, new.id, application_id
  );

  return new;
end;
$function$;

------------------------------------------------------------------------
-- 2. Diagnostico de discrepancias para coordinacion
------------------------------------------------------------------------
-- Tenia su propia heuristica (grade_max > 10 and grade_value <= 10) que no
-- miraba el modo ni aplicaba el piso, asi que un 0 figuraba como nota 0 y las
-- tareas direct_10 aparecian como discrepancias inventadas.
create or replace function public.get_moodle_grade_discrepancies()
returns table(
  practica_id uuid, estudiante_id uuid, estudiante_nombre text, estudiante_dni text,
  institucion text, especialidad text, legacy_nota text, moodle_status text,
  moodle_grade_value numeric, moodle_grade_max numeric, moodle_grade_display text,
  moodle_suggested_10_scale numeric, observed_at timestamptz, comparison_state text,
  cmid bigint, academic_year integer
)
language plpgsql
set search_path to ''
as $function$
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;

  return query
  with normalized as (
    select
      s.*,
      ae0.academic_year as task_academic_year,
      case
        when s.task_status <> 'graded' then null
        else private.read_moodle_grade_v1(s.grade_value, s.grade_max, ae0.grade_conversion_mode)
      end as panel_grade
    from public.moodle_grade_snapshots s
    left join public.aula_entregas ae0 on ae0.id = s.aula_entrega_id
  )
  select
    p.id,
    p.estudiante_id,
    nullif(btrim(concat_ws(' ', e.nombre, e.apellido)), ''),
    e.dni,
    coalesce(p.nombre_institucion, l.nombre_pps),
    p.especialidad,
    p.nota,
    s.task_status,
    s.grade_value,
    s.grade_max,
    s.grade_display,
    s.panel_grade,
    s.observed_at,
    case
      when s.task_status <> 'graded' then 'not_graded'
      -- Campus dice calificado pero el numero no es una nota posible.
      when s.panel_grade is null then 'unusable_moodle_grade'
      when nullif(btrim(coalesce(p.nota, '')), '') is null
        or lower(btrim(p.nota)) = 'sin calificar' then 'legacy_missing'
      when replace(btrim(p.nota), ',', '.') !~ '^[0-9]+([.][0-9]+)?$' then 'legacy_text'
      when replace(btrim(p.nota), ',', '.')::numeric = s.panel_grade then 'matches_moodle'
      else 'different_from_moodle'
    end,
    s.cmid,
    s.task_academic_year
  from normalized s
  join public.practicas p on p.id = s.practica_id
  join public.estudiantes e on e.id = p.estudiante_id
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  order by s.observed_at desc, e.apellido, e.nombre, coalesce(p.nombre_institucion, l.nombre_pps);
end;
$function$;

------------------------------------------------------------------------
-- 3. Aprobacion en los resumenes por unidad
------------------------------------------------------------------------
do $patch$
declare
  v_src text;
  v_anchor text;
  v_count integer;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_moodle_task_unit_summaries_v1';

  if v_src is null then
    raise exception 'No se encontro get_moodle_task_unit_summaries_v1';
  end if;

  v_anchor := 'when ae.grade_conversion_mode = ''pass_fail'' then s.grade_value > 0
        when ae.grade_conversion_mode = ''direct_10'' then s.grade_value >= 4
        when coalesce(s.grade_max, 0) > 0 then (s.grade_value / s.grade_max) * 10 >= 4
        else false end as passing_grade';

  v_count := (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor);
  if v_count <> 1 then
    raise exception 'Se esperaba 1 ancla de passing_grade; hay %', v_count;
  end if;

  v_src := replace(v_src, v_anchor,
    'else private.is_passing_moodle_grade_v1(
          s.grade_value, s.grade_max, ae.grade_conversion_mode
        ) end as passing_grade');

  execute v_src;
end;
$patch$;

commit;
