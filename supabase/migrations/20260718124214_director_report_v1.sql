-- Informe nominal y operativo para Dirección de Carrera.
--
-- La función pública es SECURITY INVOKER y delega el cálculo en una función
-- privada SECURITY DEFINER. Ambas validan que la persona autenticada sea staff.
-- El resultado excluye DNI, correo, teléfono y cualquier otro dato de contacto.

begin;

create schema if not exists private;

create or replace function private.get_director_report_v1_impl(
  p_year integer,
  p_snapshot_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_target numeric := 250;
  v_specialty_target numeric := 70;
  v_rotations_target integer := 3;
  v_snapshot_date date := least(coalesce(p_snapshot_date, current_date), current_date);
  v_result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Acceso restringido al personal autorizado'
      using errcode = '42501';
  end if;

  if p_year < 2024 or p_year > extract(year from current_date)::integer then
    raise exception 'Año fuera del rango disponible'
      using errcode = '22023';
  end if;

  select
    coalesce(horas_objetivo_total, 250),
    coalesce(horas_objetivo_orientacion, 70),
    coalesce(rotacion_objetivo, 3)::integer
  into v_total_target, v_specialty_target, v_rotations_target
  from public.app_config
  order by created_at desc
  limit 1;

  with normalized_practices as (
    select
      p.*,
      case
        when translate(lower(trim(coalesce(p.especialidad, ''))), 'áéíóúüñ', 'aeiouun')
          in ('clinica', 'laboral', 'educacional', 'comunitaria')
          then translate(lower(trim(p.especialidad)), 'áéíóúüñ', 'aeiouun')
        -- Dos registros legacy conservan una descripción concatenada cuyo tramo
        -- final identifica explícitamente la orientación Educacional.
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
      end as orientation_label
    from public.practicas as p
  ),
  practice_rollup as (
    select
      p.estudiante_id,
      count(*)::integer as practice_count,
      coalesce(sum(p.horas_realizadas), 0)::numeric as total_hours,
      count(distinct p.orientation_key)::integer as rotations,
      coalesce(
        array_agg(distinct p.orientation_label order by p.orientation_label)
          filter (where p.orientation_label is not null),
        array[]::text[]
      ) as orientations,
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
  application_rollup as (
    select
      c.estudiante_id,
      count(*)::integer as application_count,
      count(*) filter (where c.estado_inscripcion = 'Inscripto')::integer as pending_applications
    from public.convocatorias as c
    group by c.estudiante_id
  ),
  finalization_rollup as (
    select
      f.estudiante_id,
      true as has_finalization_request,
      (array_agg(f.estado order by f.created_at desc nulls last))[1] as latest_status
    from public.finalizacion_pps as f
    group by f.estudiante_id
  ),
  student_base as (
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
      coalesce(pr.practice_count, 0) as practice_count,
      coalesce(pr.total_hours, 0)::numeric as total_hours,
      coalesce(sr.specialty_hours, 0)::numeric as specialty_hours,
      coalesce(pr.rotations, 0) as rotations,
      coalesce(pr.orientations, array[]::text[]) as orientations,
      coalesce(pr.active_practices, 0) as active_practices,
      coalesce(ar.application_count, 0) as application_count,
      coalesce(ar.pending_applications, 0) as pending_applications,
      coalesce(fr.has_finalization_request, false) as has_finalization_request,
      fr.latest_status as finalization_status
    from public.estudiantes as e
    left join practice_rollup as pr on pr.estudiante_id = e.id
    left join specialty_rollup as sr on sr.estudiante_id = e.id
    left join application_rollup as ar on ar.estudiante_id = e.id
    left join finalization_rollup as fr on fr.estudiante_id = e.id
    where e.estado = 'Activo'
      and e.role = 'Alumno'
  ),
  classified_students as (
    select
      s.*,
      greatest(v_total_target - s.total_hours, 0)::numeric as total_hours_gap,
      greatest(v_specialty_target - s.specialty_hours, 0)::numeric as specialty_hours_gap,
      greatest(v_rotations_target - s.rotations, 0)::integer as rotations_gap,
      case
        when s.total_hours >= v_total_target - 20 and s.total_hours < v_total_target
          then 'total_hours_230_249'
        when s.total_hours >= v_total_target and s.rotations = v_rotations_target - 1
          then 'missing_one_orientation'
        when s.total_hours >= v_total_target
          and s.rotations >= v_rotations_target
          and s.specialty_hours >= v_specialty_target - 20
          and s.specialty_hours < v_specialty_target
          then 'specialty_gap_20_or_less'
        else null
      end as near_reason_code,
      case
        when s.total_hours >= v_total_target - 20 and s.total_hours < v_total_target
          then 'Le faltan 20 horas o menos para alcanzar las 250 horas totales'
        when s.total_hours >= v_total_target and s.rotations = v_rotations_target - 1
          then 'Alcanzó 250 horas y le falta una orientación para completar las tres'
        when s.total_hours >= v_total_target
          and s.rotations >= v_rotations_target
          and s.specialty_hours >= v_specialty_target - 20
          and s.specialty_hours < v_specialty_target
          then 'Alcanzó 250 horas y le faltan 20 horas o menos de su especialidad'
        else null
      end as near_reason_label
    from student_base as s
  ),
  student_summary as (
    select
      count(*)::integer as active_students,
      count(*) filter (where practice_count > 0)::integer as students_with_pps,
      count(*) filter (where practice_count = 0)::integer as without_pps,
      count(*) filter (
        where practice_count > 0
          and not has_finalization_request
          and near_reason_code is not null
      )::integer as near_completion,
      count(*) filter (
        where practice_count > 0
          and not has_finalization_request
          and near_reason_code = 'total_hours_230_249'
      )::integer as near_total_hours,
      count(*) filter (
        where practice_count > 0
          and not has_finalization_request
          and near_reason_code = 'missing_one_orientation'
      )::integer as near_rotation,
      count(*) filter (
        where practice_count > 0
          and not has_finalization_request
          and near_reason_code = 'specialty_gap_20_or_less'
      )::integer as near_specialty,
      count(*) filter (where has_finalization_request)::integer as in_accreditation,
      count(*) filter (
        where total_hours >= v_total_target
          and rotations >= v_rotations_target
          and specialty_hours >= v_specialty_target
          and active_practices = 0
          and not has_finalization_request
      )::integer as ready_to_request,
      count(*) filter (
        where total_hours >= v_total_target
          and rotations >= v_rotations_target
          and specialty_hours >= v_specialty_target
          and active_practices > 0
          and not has_finalization_request
      )::integer as criteria_complete_active
    from classified_students
  ),
  open_offer_rows as (
    select
      l.id,
      l.nombre_pps as offer_name,
      l.orientacion as orientation,
      greatest(coalesce(l.cupos_disponibles, 0), 0)::integer as capacity,
      count(c.id) filter (where c.estado_inscripcion = 'Seleccionado')::integer as selected,
      count(c.id) filter (where c.estado_inscripcion = 'Inscripto')::integer as pending_applications,
      count(distinct c.estudiante_id) filter (where c.estado_inscripcion = 'Inscripto')::integer
        as pending_students
    from public.lanzamientos_pps as l
    left join public.convocatorias as c on c.lanzamiento_id = l.id
    where l.estado_convocatoria = 'Abierta'
      and coalesce(l.tipo_actividad, 'pps') = 'pps'
      and coalesce(l.modalidad_cupo, 'fijo') = 'fijo'
    group by l.id, l.nombre_pps, l.orientacion, l.cupos_disponibles
  ),
  pressure_offers as (
    select
      o.*,
      greatest(o.capacity - o.selected, 0)::integer as remaining_places,
      case
        when greatest(o.capacity - o.selected, 0) = 0 and o.pending_applications > 0 then null
        when greatest(o.capacity - o.selected, 0) = 0 then 0
        else round(o.pending_applications::numeric / greatest(o.capacity - o.selected, 0), 2)
      end as pending_per_remaining_place,
      case
        when greatest(o.capacity - o.selected, 0) = 0 and o.pending_applications > 0 then 'saturated'
        when o.pending_applications::numeric / greatest(o.capacity - o.selected, 1) >= 2 then 'high'
        when o.pending_applications::numeric / greatest(o.capacity - o.selected, 1) >= 1 then 'moderate'
        else 'low'
      end as pressure_level
    from open_offer_rows as o
  ),
  pressure_summary as (
    select
      count(*)::integer as open_offers,
      coalesce(sum(capacity), 0)::integer as finite_capacity,
      coalesce(sum(selected), 0)::integer as selected,
      coalesce(sum(remaining_places), 0)::integer as remaining_places,
      coalesce(sum(pending_applications), 0)::integer as pending_applications,
      coalesce(sum(pending_students), 0)::integer as pending_student_offer_pairs,
      count(*) filter (where pressure_level in ('high', 'saturated'))::integer as high_pressure_offers
    from pressure_offers
  ),
  distinct_pending_students as (
    select count(distinct c.estudiante_id)::integer as pending_students
    from public.convocatorias as c
    join public.lanzamientos_pps as l on l.id = c.lanzamiento_id
    where l.estado_convocatoria = 'Abierta'
      and coalesce(l.tipo_actividad, 'pps') = 'pps'
      and coalesce(l.modalidad_cupo, 'fijo') = 'fijo'
      and c.estado_inscripcion = 'Inscripto'
  )
  select jsonb_build_object(
    'metric_version', 'director-report-v1',
    'annual_year', p_year,
    'snapshot_date', v_snapshot_date,
    'generated_at', now(),
    'privacy', jsonb_build_object(
      'classification', 'circulacion_interna',
      'contains_personal_data', true,
      'excluded_fields', jsonb_build_array('dni', 'correo', 'telefono', 'direccion')
    ),
    'criteria', jsonb_build_object(
      'total_hours_target', v_total_target,
      'specialty_hours_target', v_specialty_target,
      'rotations_target', v_rotations_target,
      'near_total_hours_min', v_total_target - 20,
      'near_specialty_hours_min', v_specialty_target - 20
    ),
    'student_summary', jsonb_build_object(
      'active_students', ss.active_students,
      'students_with_pps', ss.students_with_pps,
      'without_pps', ss.without_pps,
      'near_completion', ss.near_completion,
      'near_by_reason', jsonb_build_object(
        'total_hours_230_249', ss.near_total_hours,
        'missing_one_orientation', ss.near_rotation,
        'specialty_gap_20_or_less', ss.near_specialty
      ),
      'ready_to_request', ss.ready_to_request,
      'in_accreditation', ss.in_accreditation,
      'criteria_complete_active', ss.criteria_complete_active
    ),
    'without_pps_students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id,
        'full_name', s.full_name,
        'legajo', s.legajo,
        'cohort', s.cohorte,
        'selected_orientation', s.selected_orientation,
        'application_count', s.application_count,
        'pending_applications', s.pending_applications
      ) order by s.full_name, s.legajo)
      from classified_students as s
      where s.practice_count = 0
    ), '[]'::jsonb),
    'near_completion_students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id,
        'full_name', s.full_name,
        'legajo', s.legajo,
        'cohort', s.cohorte,
        'selected_orientation', s.selected_orientation,
        'total_hours', s.total_hours,
        'specialty_hours', s.specialty_hours,
        'rotations', s.rotations,
        'orientations', to_jsonb(s.orientations),
        'active_practices', s.active_practices,
        'reason_code', s.near_reason_code,
        'reason_label', s.near_reason_label,
        'total_hours_gap', s.total_hours_gap,
        'specialty_hours_gap', s.specialty_hours_gap,
        'rotations_gap', s.rotations_gap
      ) order by
        case s.near_reason_code
          when 'total_hours_230_249' then 1
          when 'missing_one_orientation' then 2
          else 3
        end,
        s.full_name,
        s.legajo)
      from classified_students as s
      where s.practice_count > 0
        and not s.has_finalization_request
        and s.near_reason_code is not null
    ), '[]'::jsonb),
    'ready_to_request_students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id,
        'full_name', s.full_name,
        'legajo', s.legajo,
        'cohort', s.cohorte,
        'selected_orientation', s.selected_orientation,
        'total_hours', s.total_hours,
        'specialty_hours', s.specialty_hours,
        'rotations', s.rotations
      ) order by s.full_name, s.legajo)
      from classified_students as s
      where s.total_hours >= v_total_target
        and s.rotations >= v_rotations_target
        and s.specialty_hours >= v_specialty_target
        and s.active_practices = 0
        and not s.has_finalization_request
    ), '[]'::jsonb),
    'accreditation_students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id,
        'full_name', s.full_name,
        'legajo', s.legajo,
        'cohort', s.cohorte,
        'selected_orientation', s.selected_orientation,
        'status', s.finalization_status
      ) order by s.full_name, s.legajo)
      from classified_students as s
      where s.has_finalization_request
    ), '[]'::jsonb),
    'pressure', jsonb_build_object(
      'open_offers', ps.open_offers,
      'finite_capacity', ps.finite_capacity,
      'selected', ps.selected,
      'remaining_places', ps.remaining_places,
      'pending_applications', ps.pending_applications,
      'pending_students', dps.pending_students,
      'pending_per_remaining_place', case
        when ps.remaining_places = 0 and ps.pending_applications > 0 then null
        when ps.remaining_places = 0 then 0
        else round(ps.pending_applications::numeric / ps.remaining_places, 2)
      end,
      'high_pressure_offers', ps.high_pressure_offers,
      'offers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'offer_id', o.id,
          'offer_name', o.offer_name,
          'orientation', o.orientation,
          'capacity', o.capacity,
          'selected', o.selected,
          'remaining_places', o.remaining_places,
          'pending_applications', o.pending_applications,
          'pending_students', o.pending_students,
          'pending_per_remaining_place', o.pending_per_remaining_place,
          'pressure_level', o.pressure_level
        ) order by
          case o.pressure_level
            when 'saturated' then 1
            when 'high' then 2
            when 'moderate' then 3
            else 4
          end,
          o.pending_applications desc,
          o.offer_name)
        from pressure_offers as o
      ), '[]'::jsonb)
    )
  )
  into v_result
  from student_summary as ss
  cross join pressure_summary as ps
  cross join distinct_pending_students as dps;

  return v_result;
end;
$$;

revoke all on function private.get_director_report_v1_impl(integer, date)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.get_director_report_v1_impl(integer, date)
  to authenticated;

create or replace function public.get_director_report_v1(
  p_year integer,
  p_snapshot_date date default current_date
)
returns jsonb
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

  return private.get_director_report_v1_impl(p_year, p_snapshot_date);
end;
$$;

revoke all on function public.get_director_report_v1(integer, date)
  from public, anon, authenticated;
grant execute on function public.get_director_report_v1(integer, date)
  to authenticated;

comment on function public.get_director_report_v1(integer, date) is
  'Informe nominal restringido para Dirección: seguimiento estudiantil y presión de convocatorias.';

commit;
