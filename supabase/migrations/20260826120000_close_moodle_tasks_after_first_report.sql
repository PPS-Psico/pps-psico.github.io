begin;

-- Cierre de tareas de informe anclado a la primera entrega.
--
-- Cerrar una tarea es poner la Fecha límite (cutoff) en Moodle: a partir de ahí
-- el estudiante ya no puede subir el informe. Es un límite físico, no una señal
-- visual. La corrección sigue después: el jefe de área conserva sus 30 días por
-- informe, plazo que ya modela private.jefe_report_rows_v1 y que este cierre no
-- toca.
--
-- ¿Por qué la primera entrega y no la fecha de finalización? Porque esa fecha es
-- estimada y distinta entre estudiantes de la misma PPS: unos recuperan horas,
-- la institución extiende, caen feriados. La primera entrega observada, en
-- cambio, es un hecho verificable: alguien terminó y subió el informe. Contar 30
-- días desde ahí garantiza que el resto de la cohorte ya tuvo sus 30 días y de
-- sobra.
--
-- POR QUÉ SÓLO APLICA AL MODELO NUEVO
--
-- El argumento anterior se apoya en que la tarea sirva a UNA cohorte. En el
-- modelo viejo una misma tarea de Moodle es reutilizada por hasta cuatro
-- lanzamientos a lo largo del año, así que "la primera entrega de la tarea" es
-- la primera entrega de la primera cohorte. Medido sobre las 967 prácticas
-- vinculadas con ancla, 380 (39%) terminan MÁS de 30 días después de esa
-- primera entrega: cerrar ahí las dejaría afuera antes de haber terminado. Caso
-- extremo verificado: Camioneros (cmid 906141) cerraría el 2025-09-24 con la
-- última cohorte terminando el 2026-09-29.
--
-- Desde agosto 2026 cada PPS lanzada estrena su propia tarea (modo `dedicated`),
-- así que una tarea vuelve a ser una cohorte y el ancla es válida. Las tareas
-- compartidas del modelo viejo quedan explícitamente fuera: se siguen ocultando
-- a fin de año como hasta ahora.
--
-- Alcance del dato: moodle_grade_observations sólo contiene lo que el puente de
-- Campus llegó a leer, es decir entregas de alumnos que abrieron Mi Panel
-- embebido en Moodle. La primera entrega *observada* puede ser posterior a la
-- real, nunca anterior. El error corre siempre hacia dar más plazo.

alter table public.aula_entregas
  add column if not exists closed_at timestamptz,
  add column if not exists close_cutoff_at date,
  add column if not exists closed_by uuid references auth.users(id) on delete set null,
  add column if not exists close_note text;

comment on column public.aula_entregas.closed_at is
  'Momento en que coordinación registró el cierre. Es el acta de algo hecho a mano en Campus: nada en la app pone la Fecha límite en Moodle.';
comment on column public.aula_entregas.close_cutoff_at is
  'Fecha límite efectivamente cargada en Moodle. Desde este día el estudiante no puede subir el informe.';
comment on column public.aula_entregas.closed_by is
  'Usuario de coordinación que registró el cierre.';
comment on column public.aula_entregas.close_note is
  'Obligatoria cuando se cierra una tarea que la regla todavía no habilita.';

-- Primera entrega observada por tarea. Vive en `private` porque agrega filas de
-- todos los alumnos y no debe consultarse directamente desde el cliente.
create or replace function private.moodle_task_first_submission_v1()
returns table(cmid bigint, first_submitted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select o.cmid, min(o.submitted_at)
  from public.moodle_grade_observations o
  where o.submitted = true
    and o.submitted_at is not null
  group by o.cmid;
$fn$;

comment on function private.moodle_task_first_submission_v1() is
  'Fecha de la primera entrega observada en cada tarea de Moodle. Agregado sobre todos los alumnos: no expone quién entregó.';

-- Una tarea entra en la regla sólo si nació del modelo nuevo y no la comparte
-- ninguna cohorte más: al menos una intención `dedicated`, ninguna
-- `legacy_shared`, y a lo sumo un lanzamiento confirmado apuntándole.
create or replace function private.moodle_task_close_eligibility_v1()
returns table(aula_entrega_id bigint, is_eligible boolean)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    ae.id,
    (
      exists (
        select 1 from public.moodle_task_intents i
        where i.aula_entrega_id = ae.id and i.mode = 'dedicated'
      )
      and not exists (
        select 1 from public.moodle_task_intents i
        where i.aula_entrega_id = ae.id and i.mode = 'legacy_shared'
      )
      and (
        select count(*) from public.lanzamiento_moodle_tareas lm
        where lm.aula_entrega_id = ae.id and lm.validation_status = 'confirmed'
      ) <= 1
    )
  from public.aula_entregas ae
  where ae.course_id = 3615;
$fn$;

comment on function private.moodle_task_close_eligibility_v1() is
  'Marca las tareas del modelo nuevo (una tarea = una cohorte). Las compartidas del modelo viejo quedan fuera de la regla de cierre.';

-- Estado de cierre por tarea. Sólo devuelve fechas agregadas -- ningún alumno es
-- identificable -- así que puede leerlo cualquier sesión autenticada. El panel
-- del estudiante lo necesita para distinguir un plazo estimado (que no puede
-- vencer) de un límite real ya cargado en Campus (que sí).
create or replace function public.moodle_task_close_state_v1()
returns table(
  cmid bigint,
  first_submitted_at timestamptz,
  suggested_cutoff_at date,
  closed_at timestamptz,
  close_cutoff_at date,
  is_eligible boolean,
  is_closable boolean
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    ae.moodle_id::bigint as cmid,
    fs.first_submitted_at,
    case
      when el.is_eligible and fs.first_submitted_at is not null
        then (fs.first_submitted_at at time zone 'America/Argentina/Buenos_Aires')::date + 30
    end as suggested_cutoff_at,
    ae.closed_at,
    ae.close_cutoff_at,
    coalesce(el.is_eligible, false) as is_eligible,
    (
      coalesce(el.is_eligible, false)
      and ae.closed_at is null
      and fs.first_submitted_at is not null
      and (fs.first_submitted_at at time zone 'America/Argentina/Buenos_Aires')::date + 30
          <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
    ) as is_closable
  from public.aula_entregas ae
  left join private.moodle_task_first_submission_v1() fs
    on fs.cmid = ae.moodle_id::bigint
  left join private.moodle_task_close_eligibility_v1() el
    on el.aula_entrega_id = ae.id
  where ae.course_id = 3615
    and ae.moodle_id ~ '^\d+$';
$fn$;

comment on function public.moodle_task_close_state_v1() is
  'Ancla de cierre por tarea: primera entrega observada, Fecha límite sugerida (primera entrega + 30 días), si la tarea entra en la regla y si ya corresponde cerrarla.';

revoke all on function public.moodle_task_close_state_v1() from public;
grant execute on function public.moodle_task_close_state_v1() to authenticated;

-- Registrar que la Fecha límite ya fue cargada a mano en Moodle.
create or replace function public.close_moodle_task_v1(
  p_cmid bigint,
  p_cutoff_at date,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_state record;
  v_aula_entrega_id bigint;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not (select public.is_admin()) then
    raise exception 'Sólo coordinación puede cerrar tareas.'
      using errcode = '42501';
  end if;

  if p_cutoff_at is null then
    raise exception 'Indicá la Fecha límite que cargaste en Moodle.'
      using errcode = '22023';
  end if;

  select s.is_closable, s.is_eligible into v_state
  from public.moodle_task_close_state_v1() s
  where s.cmid = p_cmid;

  if v_state is null then
    raise exception 'La tarea % no existe en el catálogo del curso 3615.', p_cmid
      using errcode = '22023';
  end if;

  -- Cerrar una tarea que la regla no habilita -- compartida entre cohortes, o
  -- sin los 30 días cumplidos -- sigue siendo posible, pero deja de estar
  -- amparado por el argumento: exige que quede escrito por qué.
  if not v_state.is_closable and v_note is null then
    if not v_state.is_eligible then
      raise exception 'La tarea % es del modelo viejo y la comparten varias cohortes. Indicá un motivo para cerrarla igual.', p_cmid
        using errcode = '22023';
    end if;
    raise exception 'La tarea % todavía no cumple los 30 días desde la primera entrega. Indicá un motivo para cerrarla igual.', p_cmid
      using errcode = '22023';
  end if;

  update public.aula_entregas
  set closed_at = now(),
      close_cutoff_at = p_cutoff_at,
      closed_by = auth.uid(),
      close_note = v_note
  where course_id = 3615
    and moodle_id = p_cmid::text
  returning id into v_aula_entrega_id;

  -- El aprovisionador compara cutoff_at contra lo observado en Moodle y trata
  -- cualquier diferencia como deriva a corregir. Sin esto, la próxima corrida
  -- vería la Fecha límite recién puesta como una desviación y querría
  -- revertirla, reabriendo la tarea.
  if v_aula_entrega_id is not null then
    update public.moodle_task_intents
    set desired_cutoff_at =
          ((p_cutoff_at + 1)::timestamp - interval '1 second')
          at time zone 'America/Argentina/Buenos_Aires',
        updated_at = now()
    where aula_entrega_id = v_aula_entrega_id
      and mode = 'dedicated';
  end if;
end;
$fn$;

comment on function public.close_moodle_task_v1(bigint, date, text) is
  'Registra el cierre manual de una tarea y alinea desired_cutoff_at para que el aprovisionador no lo lea como deriva. No toca Moodle: la Fecha límite se carga en Campus.';

revoke all on function public.close_moodle_task_v1(bigint, date, text) from public;
grant execute on function public.close_moodle_task_v1(bigint, date, text) to authenticated;

create or replace function public.reopen_moodle_task_v1(p_cmid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_aula_entrega_id bigint;
begin
  if not (select public.is_admin()) then
    raise exception 'Sólo coordinación puede reabrir tareas.'
      using errcode = '42501';
  end if;

  update public.aula_entregas
  set closed_at = null,
      close_cutoff_at = null,
      closed_by = null,
      close_note = null
  where course_id = 3615
    and moodle_id = p_cmid::text
  returning id into v_aula_entrega_id;

  if v_aula_entrega_id is not null then
    update public.moodle_task_intents
    set desired_cutoff_at = null,
        updated_at = now()
    where aula_entrega_id = v_aula_entrega_id
      and mode = 'dedicated';
  end if;
end;
$fn$;

comment on function public.reopen_moodle_task_v1(bigint) is
  'Deshace el registro de cierre y vuelve desired_cutoff_at a null. No reabre la tarea en Moodle.';

revoke all on function public.reopen_moodle_task_v1(bigint) from public;
grant execute on function public.reopen_moodle_task_v1(bigint) to authenticated;

commit;
