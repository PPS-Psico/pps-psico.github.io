-- Cohorte operativa para ofrecer la PPS de Entrevista a Profesionales.
--
-- Incluye estudiantes activos que cumplen al menos uno de los tres criterios
-- de proximidad a la finalización y excluye a quienes ya poseen una práctica
-- de Relevamiento del Ejercicio Profesional o Entrevista a Profesionales.
-- La coincidencia es deliberadamente específica para no confundir estas PPS
-- con Entrevistas de Admisión u otras actividades de entrevista.

begin;

create schema if not exists private;

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
declare
  v_total_target numeric := 250;
  v_specialty_target numeric := 70;
  v_rotations_target integer := 3;
begin
  if not public.is_staff() then
    raise exception 'Acceso restringido al personal autorizado'
      using errcode = '42501';
  end if;

  select
    coalesce(max(horas_objetivo_total), 250),
    coalesce(max(horas_objetivo_orientacion), 70),
    coalesce(max(rotacion_objetivo), 3)::integer
  into v_total_target, v_specialty_target, v_rotations_target
  from public.app_config;

  return query
  with normalized_practices as (
    select
      p.*,
      case
        when translate(lower(trim(coalesce(p.especialidad, ''))), 'áéíóúüñ', 'aeiouun')
          in ('clinica', 'laboral', 'educacional', 'comunitaria')
          then translate(lower(trim(p.especialidad)), 'áéíóúüñ', 'aeiouun')
        when translate(lower(coalesce(p.especialidad, '')), 'áéíóúüñ', 'aeiouun')
          like '%[educacional%'
          then 'educacional'
        else null
      end as orientation_key,
      case
        when translate(lower(trim(coalesce(p.especialidad, ''))), 'áéíóúüñ', 'aeiouun') = 'clinica'
          then 'Clínica'
        when translate(lower(trim(coalesce(p.especialidad, ''))), 'áéíóúüñ', 'aeiouun') = 'laboral'
          then 'Laboral'
        when translate(lower(trim(coalesce(p.especialidad, ''))), 'áéíóúüñ', 'aeiouun') = 'educacional'
          then 'Educacional'
        when translate(lower(trim(coalesce(p.especialidad, ''))), 'áéíóúüñ', 'aeiouun') = 'comunitaria'
          then 'Comunitaria'
        when translate(lower(coalesce(p.especialidad, '')), 'áéíóúüñ', 'aeiouun')
          like '%[educacional%'
          then 'Educacional'
        else null
      end as orientation_label,
      (
        translate(
          lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, ''))),
          'áéíóúüñ',
          'aeiouun'
        ) like '%relevamiento%profesional%'
        or translate(
          lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, ''))),
          'áéíóúüñ',
          'aeiouun'
        ) ~ 'entrevistas?[[:space:]]+a[[:space:]]+profesionales?'
      ) as has_completion_interview
    from public.practicas as p
    left join public.lanzamientos_pps as l on l.id = p.lanzamiento_id
  ),
  practice_rollup as (
    select
      p.estudiante_id,
      coalesce(sum(p.horas_realizadas), 0)::numeric as total_hours,
      count(distinct p.orientation_key)::integer as rotations,
      coalesce(
        array_agg(distinct p.orientation_label order by p.orientation_label)
          filter (where p.orientation_label is not null),
        array[]::text[]
      ) as orientations,
      bool_or(p.has_completion_interview) as has_completion_interview,
      count(*) filter (
        where translate(lower(trim(coalesce(p.estado, ''))), 'áéíóúüñ', 'aeiouun')
          in ('en curso', 'pendiente', 'en proceso')
      )::integer as active_practices
    from normalized_practices as p
    group by p.estudiante_id
  ),
  specialty_rollup as (
    select
      e.id as estudiante_id,
      coalesce(sum(p.horas_realizadas), 0)::numeric as specialty_hours
    from public.estudiantes as e
    left join normalized_practices as p
      on p.estudiante_id = e.id
      and p.orientation_key = translate(
        lower(trim(coalesce(e.orientacion_elegida, ''))),
        'áéíóúüñ',
        'aeiouun'
      )
    group by e.id
  ),
  classified as (
    select
      e.id,
      coalesce(
        nullif(trim(concat_ws(', ', nullif(e.apellido_separado, ''), nullif(e.nombre_separado, ''))), ''),
        nullif(trim(e.nombre), ''),
        'Estudiante sin nombre'
      ) as full_name,
      e.legajo,
      e.cohorte,
      nullif(trim(e.orientacion_elegida), '') as selected_orientation,
      pr.total_hours,
      sr.specialty_hours,
      pr.rotations,
      pr.orientations,
      pr.active_practices,
      greatest(v_total_target - pr.total_hours, 0)::numeric as total_hours_gap,
      greatest(v_specialty_target - sr.specialty_hours, 0)::numeric as specialty_hours_gap,
      greatest(v_rotations_target - pr.rotations, 0)::integer as rotations_gap,
      case
        when pr.total_hours >= v_total_target - 20 and pr.total_hours < v_total_target
          then 'total_hours_230_249'
        when pr.total_hours >= v_total_target and pr.rotations = v_rotations_target - 1
          then 'missing_one_orientation'
        when pr.total_hours >= v_total_target
          and pr.rotations >= v_rotations_target
          and sr.specialty_hours >= v_specialty_target - 20
          and sr.specialty_hours < v_specialty_target
          then 'specialty_gap_20_or_less'
        else null
      end as reason_code,
      case
        when pr.total_hours >= v_total_target - 20 and pr.total_hours < v_total_target
          then 'Le faltan 20 horas o menos para alcanzar las 250 horas totales'
        when pr.total_hours >= v_total_target and pr.rotations = v_rotations_target - 1
          then 'Alcanzó 250 horas y le falta una orientación para completar las tres'
        when pr.total_hours >= v_total_target
          and pr.rotations >= v_rotations_target
          and sr.specialty_hours >= v_specialty_target - 20
          and sr.specialty_hours < v_specialty_target
          then 'Alcanzó 250 horas y le faltan 20 horas o menos de su especialidad'
        else null
      end as reason_label
    from public.estudiantes as e
    join practice_rollup as pr on pr.estudiante_id = e.id
    join specialty_rollup as sr on sr.estudiante_id = e.id
    where e.estado = 'Activo'
      and e.role = 'Alumno'
      and not coalesce(pr.has_completion_interview, false)
      and not exists (
        select 1
        from public.finalizacion_pps as f
        where f.estudiante_id = e.id
      )
  )
  select
    c.id,
    c.full_name,
    c.legajo,
    c.cohorte,
    c.selected_orientation,
    c.total_hours,
    c.specialty_hours,
    c.rotations,
    c.orientations,
    c.reason_code,
    c.reason_label,
    c.total_hours_gap,
    c.specialty_hours_gap,
    c.rotations_gap,
    c.active_practices
  from classified as c
  where c.reason_code is not null
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

revoke all on function private.get_interview_completion_candidates_v1_impl()
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.get_interview_completion_candidates_v1_impl()
  to authenticated;

create or replace function public.get_interview_completion_candidates_v1()
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
security invoker
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Acceso restringido al personal autorizado'
      using errcode = '42501';
  end if;

  return query
  select * from private.get_interview_completion_candidates_v1_impl();
end;
$$;

revoke all on function public.get_interview_completion_candidates_v1()
  from public, anon, authenticated;
grant execute on function public.get_interview_completion_candidates_v1()
  to authenticated;

comment on function public.get_interview_completion_candidates_v1() is
  'Estudiantes próximos a finalizar elegibles para una PPS de Entrevista a Profesionales; excluye quienes ya realizaron Relevamiento o Entrevista a Profesionales.';

commit;
