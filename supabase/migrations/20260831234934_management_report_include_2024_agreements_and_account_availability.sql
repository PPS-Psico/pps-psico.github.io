create or replace function private.get_management_report_v1_impl(
  p_cutoff date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with params as (
  select
    least(coalesce(p_cutoff, current_date), current_date) as cutoff,
    date '2024-09-01' as management_start,
    extract(
      year from least(coalesce(p_cutoff, current_date), current_date)
    )::integer as cutoff_year
),
years as (
  select generate_series(2024, (select cutoff_year from params))::integer as year
),
recent_years as (
  select generate_series(
    greatest(2024, (select cutoff_year from params) - 1),
    (select cutoff_year from params)
  )::integer as year
),
institution_norm as (
  select
    i.id,
    i.nombre,
    lower(
      regexp_replace(
        translate(
          i.nombre,
          'ÁÉÍÓÚÜÑáéíóúüñ ',
          'AEIOUUNaeiouun '
        ),
        '[^a-zA-Z0-9]+',
        '',
        'g'
      )
    ) as normalized_name
  from public.instituciones as i
),
practice_institution_links as (
  select
    p.lanzamiento_id,
    count(distinct p.institucion_id) filter (
      where p.institucion_id is not null
    )::integer as institution_count,
    (
      array_agg(distinct p.institucion_id) filter (
        where p.institucion_id is not null
      )
    )[1] as institution_id
  from public.practicas as p
  where p.tipo_actividad = 'pps'
  group by p.lanzamiento_id
),
selected_pairs as (
  select c.lanzamiento_id, c.estudiante_id
  from public.convocatorias as c
  where c.estado_inscripcion = 'Seleccionado'
    and c.estudiante_id is not null
  union
  select p.lanzamiento_id, p.estudiante_id
  from public.practicas as p
  where p.tipo_actividad = 'pps'
    and p.lanzamiento_id is not null
    and p.estudiante_id is not null
),
launch_base as (
  select
    l.id,
    l.nombre_pps,
    left(l.fecha_inicio, 10)::date as start_date,
    l.orientacion,
    l.modalidad_cupo,
    l.cupos_disponibles,
    case
      when l.institucion_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then l.institucion_id::uuid
      else null
    end as direct_institution_id,
    lower(
      regexp_replace(
        translate(
          l.nombre_pps,
          'ÁÉÍÓÚÜÑáéíóúüñ ',
          'AEIOUUNaeiouun '
        ),
        '[^a-zA-Z0-9]+',
        '',
        'g'
      )
    ) as normalized_name,
    count(sp.estudiante_id)::integer as selected_students
  from public.lanzamientos_pps as l
  cross join params as bounds
  left join selected_pairs as sp on sp.lanzamiento_id = l.id
  where l.tipo_actividad = 'pps'
    and l.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}'
    and left(l.fecha_inicio, 10)::date between date '2024-01-01' and bounds.cutoff
  group by l.id
),
launch_matches as (
  select
    lb.*,
    direct_institution.id as verified_direct_id,
    practice_link.institution_count as practice_institution_count,
    practice_link.institution_id as practice_institution_id,
    count(name_match.id)::integer as exact_name_match_count,
    min(name_match.id::text)::uuid as exact_name_match_id
  from launch_base as lb
  left join institution_norm as direct_institution
    on direct_institution.id = lb.direct_institution_id
  left join practice_institution_links as practice_link
    on practice_link.lanzamiento_id = lb.id
  left join institution_norm as name_match
    on name_match.normalized_name = lb.normalized_name
  group by
    lb.id,
    lb.nombre_pps,
    lb.start_date,
    lb.orientacion,
    lb.modalidad_cupo,
    lb.cupos_disponibles,
    lb.direct_institution_id,
    lb.normalized_name,
    lb.selected_students,
    direct_institution.id,
    practice_link.institution_count,
    practice_link.institution_id
),
resolved_launches as (
  select
    lm.id,
    lm.nombre_pps,
    lm.start_date,
    lm.orientacion,
    lm.modalidad_cupo,
    case
      when lm.modalidad_cupo = 'fijo'
        then coalesce(lm.cupos_disponibles, 0)::integer
      else 0
    end as fixed_offered,
    case
      when lm.modalidad_cupo = 'realizado'
        then lm.selected_students
      else 0
    end as realized,
    coalesce(
      lm.verified_direct_id,
      case
        when lm.practice_institution_count = 1
          then lm.practice_institution_id
      end,
      case
        when lm.exact_name_match_count = 1
          then lm.exact_name_match_id
      end
    ) as institution_id,
    case
      when lm.verified_direct_id is not null then 'direct'
      when lm.practice_institution_count = 1 then 'practice'
      when lm.exact_name_match_count = 1 then 'exact_name'
      else 'unresolved'
    end as mapping_source
  from launch_matches as lm
),
orientation_tokens as (
  select distinct
    rl.id as launch_id,
    case translate(
      lower(trim(token.value)),
      'áéíóúüñ',
      'aeiouun'
    )
      when 'clinica' then 'clinica'
      when 'educacional' then 'educacional'
      when 'laboral' then 'laboral'
      when 'juridica' then 'juridica'
      when 'comunitaria' then 'comunitaria'
      when 'investigacion' then 'investigacion'
      else 'sin-definir'
    end as orientation
  from resolved_launches as rl
  cross join lateral regexp_split_to_table(
    coalesce(rl.orientacion, ''),
    '\s*,\s*'
  ) as token(value)
  where trim(token.value) <> ''
),
auth_history as (
  select
    min((u.created_at at time zone 'America/Argentina/Buenos_Aires')::date)
      as history_start
  from public.estudiantes as e
  join auth.users as u on u.id = e.user_id
  where e.role = 'Alumno'
),
account_cohorts as (
  select
    y.year,
    case
      when history.history_start is null
        or make_date(y.year, 12, 31) < history.history_start
        then null
      else count(distinct e.id) filter (
        where (u.created_at at time zone 'America/Argentina/Buenos_Aires')::date
          between make_date(y.year, 1, 1)
          and least(make_date(y.year, 12, 31), bounds.cutoff)
      )::integer
    end as accounts_created,
    case
      when history.history_start is null
        or make_date(y.year, 12, 31) < history.history_start
        then null
      else count(distinct e.id) filter (
        where (u.created_at at time zone 'America/Argentina/Buenos_Aires')::date
          between make_date(y.year, 1, 1)
          and least(make_date(y.year, 12, 31), bounds.cutoff)
          and e.estado = 'Activo'
      )::integer
    end as currently_active,
    not (
      history.history_start is null
      or make_date(y.year, 12, 31) < history.history_start
    ) as available
  from years as y
  cross join params as bounds
  cross join auth_history as history
  left join public.estudiantes as e on e.role = 'Alumno'
  left join auth.users as u on u.id = e.user_id
  group by y.year, bounds.cutoff, history.history_start
),
current_student_stock as (
  select
    count(distinct e.id) filter (where e.estado = 'Activo')::integer
      as active_students,
    count(distinct p.estudiante_id) filter (
      where e.estado = 'Activo'
        and p.tipo_actividad = 'pps'
        and lower(coalesce(p.estado, '')) in ('en curso', 'en proceso')
    )::integer as active_students_with_current_pps
  from public.estudiantes as e
  left join public.practicas as p on p.estudiante_id = e.id
  where e.role = 'Alumno'
),
agreement_scope as (
  select
    c.id,
    c.institucion_id,
    i.nombre as institution,
    c.tipo,
    c.fecha_firma,
    c.fecha_vencimiento,
    case
      when extract(month from c.fecha_firma) = 1
        and extract(day from c.fecha_firma) = 1
        then 'year'
      else 'day'
    end as date_precision
  from public.convenios as c
  join public.instituciones as i on i.id = c.institucion_id
  cross join params as bounds
  where not coalesce(c.es_renovacion, false)
    and (
      c.fecha_firma between bounds.management_start and bounds.cutoff
      or (
        c.fecha_firma = date '2024-01-01'
        and c.notas = 'Backfill automático desde instituciones.convenio_nuevo (fecha estimada 1-ene).'
        and bounds.cutoff >= bounds.management_start
      )
    )
),
agreement_yearly as (
  select
    agreement.id as agreement_id,
    y.year,
    count(launch.id)::integer as launches,
    coalesce(sum(launch.fixed_offered), 0)::integer as fixed_offered,
    coalesce(sum(launch.realized), 0)::integer as realized
  from agreement_scope as agreement
  cross join years as y
  cross join params as bounds
  left join resolved_launches as launch
    on launch.institution_id = agreement.institucion_id
    and extract(year from launch.start_date)::integer = y.year
    and launch.start_date >= agreement.fecha_firma
    and launch.start_date <= bounds.cutoff
  group by agreement.id, y.year
),
agreement_orientation as (
  select
    agreement.id as agreement_id,
    coalesce(
      jsonb_agg(distinct orientation.orientation order by orientation.orientation)
        filter (where orientation.orientation is not null),
      '[]'::jsonb
    ) as orientations
  from agreement_scope as agreement
  left join resolved_launches as launch
    on launch.institution_id = agreement.institucion_id
    and launch.start_date >= agreement.fecha_firma
    and launch.start_date <= (select cutoff from params)
  left join orientation_tokens as orientation on orientation.launch_id = launch.id
  group by agreement.id
),
agreement_rows as (
  select
    agreement.id,
    agreement.institucion_id,
    agreement.institution,
    agreement.tipo,
    agreement.fecha_firma,
    agreement.fecha_vencimiento,
    agreement.date_precision,
    case
      when agreement.fecha_vencimiento is not null
        and agreement.fecha_vencimiento < (select cutoff from params)
        then 'expired'
      else 'confirmed'
    end as validity,
    orientation.orientations,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'year', yearly.year,
          'launches', yearly.launches,
          'fixed_offered', yearly.fixed_offered,
          'realized', yearly.realized
        ) order by yearly.year
      ),
      '[]'::jsonb
    ) as contributions,
    coalesce(sum(yearly.launches), 0)::integer as total_launches,
    coalesce(sum(yearly.fixed_offered), 0)::integer as total_fixed_offered,
    coalesce(sum(yearly.realized), 0)::integer as total_realized
  from agreement_scope as agreement
  join agreement_orientation as orientation on orientation.agreement_id = agreement.id
  left join agreement_yearly as yearly on yearly.agreement_id = agreement.id
  group by
    agreement.id,
    agreement.institucion_id,
    agreement.institution,
    agreement.tipo,
    agreement.fecha_firma,
    agreement.fecha_vencimiento,
    agreement.date_precision,
    orientation.orientations
),
recent_launches as (
  select launch.*
  from resolved_launches as launch
  cross join params as bounds
  where launch.start_date >= make_date(greatest(2024, bounds.cutoff_year - 1), 1, 1)
    and launch.start_date <= bounds.cutoff
),
network_groups as (
  select
    coalesce(
      launch.institution_id::text,
      'unresolved:' || lower(launch.nombre_pps)
    ) as group_key,
    launch.institution_id,
    coalesce(institution.nombre, launch.nombre_pps) as institution,
    max(launch.start_date) as last_activity,
    count(launch.id)::integer as total_launches,
    bool_and(launch.institution_id is not null) as mapping_complete
  from recent_launches as launch
  left join public.instituciones as institution on institution.id = launch.institution_id
  group by 1, launch.institution_id, 3
),
network_yearly as (
  select
    network.group_key,
    y.year,
    count(launch.id)::integer as launches
  from network_groups as network
  cross join recent_years as y
  left join recent_launches as launch
    on coalesce(
      launch.institution_id::text,
      'unresolved:' || lower(launch.nombre_pps)
    ) = network.group_key
    and extract(year from launch.start_date)::integer = y.year
  group by network.group_key, y.year
),
network_orientation as (
  select
    network.group_key,
    coalesce(
      jsonb_agg(distinct orientation.orientation order by orientation.orientation)
        filter (where orientation.orientation is not null),
      '[]'::jsonb
    ) as orientations
  from network_groups as network
  left join recent_launches as launch
    on coalesce(
      launch.institution_id::text,
      'unresolved:' || lower(launch.nombre_pps)
    ) = network.group_key
  left join orientation_tokens as orientation on orientation.launch_id = launch.id
  group by network.group_key
),
network_rows as (
  select
    network.group_key,
    network.institution_id,
    network.institution,
    orientation.orientations,
    network.last_activity,
    network.total_launches,
    network.mapping_complete,
    latest_agreement.fecha_firma as agreement_date,
    latest_agreement.fecha_vencimiento as agreement_expiry,
    case
      when network.institution_id is null then 'pending_mapping'
      when latest_agreement.id is null then 'pending_agreement'
      when latest_agreement.fecha_vencimiento is not null
        and latest_agreement.fecha_vencimiento < (select cutoff from params)
        then 'inconsistent_expiry'
      else 'confirmed'
    end as validity,
    coalesce(
      jsonb_object_agg(yearly.year::text, yearly.launches order by yearly.year),
      '{}'::jsonb
    ) as launches_by_year
  from network_groups as network
  join network_orientation as orientation on orientation.group_key = network.group_key
  left join network_yearly as yearly on yearly.group_key = network.group_key
  left join lateral (
    select c.id, c.fecha_firma, c.fecha_vencimiento
    from public.convenios as c
    where c.institucion_id = network.institution_id
      and c.fecha_firma <= (select cutoff from params)
    order by c.fecha_firma desc, c.created_at desc
    limit 1
  ) as latest_agreement on true
  group by
    network.group_key,
    network.institution_id,
    network.institution,
    orientation.orientations,
    network.last_activity,
    network.total_launches,
    network.mapping_complete,
    latest_agreement.id,
    latest_agreement.fecha_firma,
    latest_agreement.fecha_vencimiento
),
mapping_quality as (
  select
    count(*)::integer as launches,
    count(*) filter (where institution_id is not null)::integer as resolved,
    count(*) filter (where institution_id is null)::integer as unresolved
  from recent_launches
)
select jsonb_build_object(
  'report_version', 'management-report-v1',
  'cutoff', bounds.cutoff,
  'generated_at', statement_timestamp(),
  'management_start', bounds.management_start,
  'population', jsonb_build_object(
    'account_state_as_of', statement_timestamp(),
    'account_history_start', (select history_start from auth_history),
    'account_cohorts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'year', cohort.year,
          'accounts_created', cohort.accounts_created,
          'currently_active', cohort.currently_active,
          'available', cohort.available
        ) order by cohort.year
      )
      from account_cohorts as cohort
    ), '[]'::jsonb),
    'current_stock', (
      select jsonb_build_object(
        'active_students', stock.active_students,
        'active_students_with_current_pps', stock.active_students_with_current_pps,
        'historically_comparable', false
      )
      from current_student_stock as stock
    ),
    'administrative_enrollment', jsonb_build_array(
      jsonb_build_object('year', 2022, 'cycle', '2022/1', 'students', 39),
      jsonb_build_object('year', 2023, 'cycle', '2023/1', 'students', 87),
      jsonb_build_object('year', 2024, 'cycle', '2024/1', 'students', 101),
      jsonb_build_object('year', 2025, 'cycle', '2025/1', 'students', 242)
    ),
    'administrative_source', 'Registro administrativo informado por la Facultad; fuente externa a Mi Panel'
  ),
  'agreements', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', row.id,
        'institution_id', row.institucion_id,
        'institution', row.institution,
        'type', row.tipo,
        'signed_at', row.fecha_firma,
        'expires_at', row.fecha_vencimiento,
        'date_precision', row.date_precision,
        'validity', row.validity,
        'orientations', row.orientations,
        'contributions', row.contributions,
        'total_launches', row.total_launches,
        'total_fixed_offered', row.total_fixed_offered,
        'total_realized', row.total_realized
      ) order by row.fecha_firma, row.institution
    )
    from agreement_rows as row
  ), '[]'::jsonb),
  'recent_network', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'key', row.group_key,
        'institution_id', row.institution_id,
        'institution', row.institution,
        'orientations', row.orientations,
        'launches_by_year', row.launches_by_year,
        'total_launches', row.total_launches,
        'last_activity', row.last_activity,
        'agreement_date', row.agreement_date,
        'agreement_expiry', row.agreement_expiry,
        'validity', row.validity,
        'mapping_complete', row.mapping_complete
      ) order by row.institution
    )
    from network_rows as row
  ), '[]'::jsonb),
  'quality', (
    select jsonb_build_object(
      'recent_launches', quality.launches,
      'resolved_institution_launches', quality.resolved,
      'unresolved_institution_launches', quality.unresolved,
      'institution_mapping_coverage_pct', case
        when quality.launches = 0 then null
        else round(100.0 * quality.resolved / quality.launches, 1)
      end
    )
    from mapping_quality as quality
  )
)
from params as bounds;
$$;

revoke all on function private.get_management_report_v1_impl(date)
  from public, anon, authenticated;

create or replace function public.get_management_report_v1(
  p_cutoff date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Acceso restringido al personal autorizado'
      using errcode = '42501';
  end if;

  if p_cutoff is not null and p_cutoff < date '2024-01-01' then
    raise exception 'La fecha de corte debe ser igual o posterior al 01/01/2024'
      using errcode = '22023';
  end if;

  return private.get_management_report_v1_impl(p_cutoff);
end;
$$;

revoke all on function public.get_management_report_v1(date) from public, anon;
grant execute on function public.get_management_report_v1(date)
  to authenticated, service_role;

comment on function public.get_management_report_v1(date) is
  'Contrato agregado y sin PII para el informe dinámico de gestión PPS desde 2024.';

