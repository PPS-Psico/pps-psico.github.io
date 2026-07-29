-- Reutiliza la clasificacion ya versionada del informe para Direccion.
-- Asi la KPI y el informe nominal comparten exactamente los mismos tres
-- criterios. La deteccion de las PPS a excluir usa solo patrones ASCII para
-- evitar alteraciones de encoding durante el despliegue.

begin;

create or replace function private.get_interview_completion_candidates_v1_impl()
returns table (
  id uuid,
  nombre text,
  legajo text,
  cohorte smallint,
  orientacion_elegida text,
  horas_total numeric,
  horas_especialidad numeric,
  orientaciones integer,
  orientaciones_cubiertas text[],
  motivo_codigo text,
  motivo text,
  horas_faltantes_total numeric,
  horas_faltantes_especialidad numeric,
  orientaciones_faltantes integer,
  practicas_activas integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff access required'
      using errcode = '42501';
  end if;

  return query
  with director_payload as (
    select private.get_director_report_v1_impl(
      extract(year from current_date)::integer,
      current_date
    ) as payload
  ),
  director_candidates as (
    select candidate
    from director_payload as d
    cross join lateral jsonb_array_elements(
      coalesce(d.payload->'near_completion_students', '[]'::jsonb)
    ) as candidate
  ),
  excluded_students as (
    select distinct p.estudiante_id
    from public.practicas as p
    left join public.lanzamientos_pps as l on l.id = p.lanzamiento_id
    where lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
      like '%relevamiento%profesional%'
      or lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
        ~ 'entrevistas?[[:space:]]+a[[:space:]]+profesionales?'
  ),
  candidates as (
    select
      (d.candidate->>'student_id')::uuid as student_id,
      d.candidate->>'full_name' as full_name,
      d.candidate->>'legajo' as student_number,
      nullif(d.candidate->>'cohort', '')::smallint as student_cohort,
      nullif(d.candidate->>'selected_orientation', '') as selected_orientation,
      coalesce((d.candidate->>'total_hours')::numeric, 0) as total_hours,
      coalesce((d.candidate->>'specialty_hours')::numeric, 0) as specialty_hours,
      coalesce((d.candidate->>'rotations')::integer, 0) as rotations,
      array(
        select jsonb_array_elements_text(
          coalesce(d.candidate->'orientations', '[]'::jsonb)
        )
      ) as covered_orientations,
      d.candidate->>'reason_code' as reason_code,
      d.candidate->>'reason_label' as reason_label,
      coalesce((d.candidate->>'total_hours_gap')::numeric, 0) as total_hours_gap,
      coalesce((d.candidate->>'specialty_hours_gap')::numeric, 0) as specialty_hours_gap,
      coalesce((d.candidate->>'rotations_gap')::integer, 0) as rotations_gap,
      coalesce((d.candidate->>'active_practices')::integer, 0) as active_practices
    from director_candidates as d
  )
  select
    c.student_id,
    c.full_name,
    c.student_number,
    c.student_cohort,
    c.selected_orientation,
    c.total_hours,
    c.specialty_hours,
    c.rotations,
    c.covered_orientations,
    c.reason_code,
    c.reason_label,
    c.total_hours_gap,
    c.specialty_hours_gap,
    c.rotations_gap,
    c.active_practices
  from candidates as c
  where not exists (
    select 1
    from excluded_students as x
    where x.estudiante_id = c.student_id
  )
  order by
    case c.reason_code
      when 'total_hours_230_249' then 1
      when 'missing_one_orientation' then 2
      when 'specialty_gap_20_or_less' then 3
      else 4
    end,
    case
      when c.reason_code = 'total_hours_230_249' then c.total_hours_gap
      when c.reason_code = 'specialty_gap_20_or_less' then c.specialty_hours_gap
      else c.rotations_gap
    end,
    c.full_name;
end;
$$;

commit;
