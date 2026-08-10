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
    raise exception 'Acceso restringido a coordinación'
      using errcode = '42501';
  end if;

  return query
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
    case
      when s.task_status = 'graded' and s.grade_max > 0
        then round((s.grade_value / s.grade_max) * 10, 2)
      else null
    end,
    s.observed_at,
    case
      when s.task_status <> 'graded' then 'not_graded'
      when nullif(btrim(coalesce(p.nota, '')), '') is null
        or lower(btrim(p.nota)) = 'sin calificar' then 'legacy_missing'
      when btrim(p.nota) !~ '^\d+(?:[.,]\d+)?$' then 'legacy_text'
      when s.grade_max = 10
        and replace(btrim(p.nota), ',', '.')::numeric = s.grade_value then 'matches_raw'
      when s.grade_max = 10 then 'different_raw'
      else 'requires_scale_decision'
    end
  from public.moodle_grade_snapshots s
  join public.practicas p on p.id = s.practica_id
  join public.estudiantes e on e.id = p.estudiante_id
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  order by s.observed_at desc, e.apellido, e.nombre, coalesce(p.nombre_institucion, l.nombre_pps);
end;
$$;

revoke all on function public.get_moodle_grade_discrepancies() from public, anon;
grant execute on function public.get_moodle_grade_discrepancies() to authenticated;

comment on function public.get_moodle_grade_discrepancies() is
  'Reporte admin read-only. Compara el legacy con Moodle sin aplicar ni asumir una conversión de escala.';
