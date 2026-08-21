-- Extiende el reporte de discrepancias con cmid y año académico para que la
-- El cuerpo es identico al original; solo se agregan las dos columnas
-- y el join con aula_entregas. No hay callers previos en el frontend, por lo
-- que el drop/recreate es seguro.

drop function if exists public.get_moodle_grade_discrepancies();

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
  comparison_state text,
  cmid bigint,
  academic_year integer
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
      case
        when s.task_status <> 'graded' or s.grade_max is null or s.grade_max <= 0 then null
        when s.grade_max > 10 and s.grade_value <= 10 then round(s.grade_value, 2)
        else round((s.grade_value / s.grade_max) * 10, 2)
      end as panel_grade
    from public.moodle_grade_snapshots s
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
      when replace(btrim(p.nota), ',', '.') !~ '^[0-9]+([.][0-9]+)?$' then 'legacy_text'
      when replace(btrim(p.nota), ',', '.')::numeric = s.panel_grade then 'matches_moodle'
      else 'different_from_moodle'
    end,
    s.cmid,
    ae.academic_year
  from normalized s
  join public.practicas p on p.id = s.practica_id
  join public.estudiantes e on e.id = p.estudiante_id
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  left join public.aula_entregas ae on ae.id = s.aula_entrega_id
  order by s.observed_at desc, e.apellido, e.nombre, coalesce(p.nombre_institucion, l.nombre_pps);
end;
$$;

comment on function public.get_moodle_grade_discrepancies() is
  'Reporte admin read-only que compara practicas.nota con la conversion Moodle 0-10 aplicada automaticamente. Expone cmid y ano academico para navegacion desde la UI.';
