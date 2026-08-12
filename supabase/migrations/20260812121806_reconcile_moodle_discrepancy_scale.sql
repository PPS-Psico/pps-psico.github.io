-- Keep the read-only discrepancy report on exactly the same explicit scale
-- contract as the automatic grade application trigger.
create or replace function public.get_moodle_grade_discrepancies()
returns table (
  practica_id uuid,
  estudiante_id uuid,
  estudiante_nombre text,
  estudiante_dni text,
  institucion text,
  especialidad text,
  legacy_nota text,
  moodle_status text,
  moodle_grade_value numeric,
  moodle_grade_max numeric,
  moodle_grade_display text,
  moodle_suggested_10_scale numeric,
  observed_at timestamptz,
  comparison_state text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;

  return query
  with normalized as (
    select
      s.*,
      a.grade_conversion_mode,
      case
        when s.task_status <> 'graded' or s.grade_value is null
          or s.grade_max is null or s.grade_max <= 0 then null
        when a.grade_conversion_mode = 'direct_10' then round(s.grade_value, 2)
        when a.grade_conversion_mode = 'pass_fail' then null
        else round((s.grade_value / s.grade_max) * 10, 2)
      end as panel_grade,
      case
        when a.grade_conversion_mode = 'pass_fail' and s.grade_value > 0 then 'Aprobado'
        when a.grade_conversion_mode = 'pass_fail' then 'Desaprobado'
        else null
      end as panel_grade_text
    from public.moodle_grade_snapshots s
    join public.aula_entregas a on a.id = s.aula_entrega_id
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
      when nullif(btrim(coalesce(p.nota, '')), '') is null
        or lower(btrim(p.nota)) = 'sin calificar' then 'legacy_missing'
      when s.grade_conversion_mode = 'pass_fail'
        and lower(btrim(p.nota)) = lower(s.panel_grade_text) then 'matches_moodle'
      when s.grade_conversion_mode = 'pass_fail' then 'different_from_moodle'
      when replace(btrim(p.nota), ',', '.') !~ '^[0-9]+([.][0-9]+)?$' then 'legacy_text'
      when replace(btrim(p.nota), ',', '.')::numeric = s.panel_grade then 'matches_moodle'
      else 'different_from_moodle'
    end
  from normalized s
  join public.practicas p on p.id = s.practica_id
  join public.estudiantes e on e.id = p.estudiante_id
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  order by s.observed_at desc, e.apellido, e.nombre,
    coalesce(p.nombre_institucion, l.nombre_pps);
end;
$$;

comment on function public.get_moodle_grade_discrepancies() is
  'Reporte admin read-only que compara practicas.nota con la regla explicita de conversion configurada para cada tarea Moodle.';
