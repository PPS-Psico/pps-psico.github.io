-- Panel de jefaturas de área: asignaciones, cola de informes y panorama anual.
--
-- Las asignaciones viven en `private` y se resuelven por el DNI de la ficha
-- autenticada. Los RPC públicos son SECURITY INVOKER y delegan en funciones
-- privadas SECURITY DEFINER con `search_path` vacío. Así PostgREST sólo expone
-- contratos acotados por área, no las tablas auxiliares ni consultas globales.

create schema if not exists private;

create table if not exists private.jefe_area_assignments (
  dni bigint not null,
  area_key text not null check (area_key in ('clinica', 'educacional', 'laboral', 'comunitaria')),
  area_label text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (dni, area_key)
);

comment on table private.jefe_area_assignments is
  'Orientaciones habilitadas para cada jefatura. La identidad se resuelve por DNI de la ficha autenticada.';

revoke all on table private.jefe_area_assignments from public, anon, authenticated;

insert into private.jefe_area_assignments (dni, area_key, area_label, sort_order)
values
  (13842270, 'clinica', 'Clínica', 10),
  (34052382, 'educacional', 'Educacional', 10),
  (26777403, 'laboral', 'Laboral', 10),
  (26777403, 'comunitaria', 'Comunitaria', 20)
on conflict (dni, area_key) do update
set area_label = excluded.area_label,
    sort_order = excluded.sort_order;

-- Fichas mínimas para que el alta desde Moodle conserve el rol Jefe. El flujo
-- de onboarding vincula `user_id` y completa correo/teléfono; no se crean
-- usuarios en auth desde una migración. Cynthia no tiene correo informado en
-- el requerimiento, por eso se completa desde el ticket verificado de Moodle.
insert into public.estudiantes (
  legajo, nombre, nombre_separado, apellido_separado, orientacion_elegida,
  dni, correo, estado, role, must_change_password
)
select *
from (values
  ('13842270', 'Selva Estrella', 'Selva', 'Estrella', 'Clínica', 13842270::numeric, 'selva.estrella@uflouniversidad.edu.ar', 'Activo', 'Jefe', false),
  ('34052382', 'Franco Pedraza', 'Franco', 'Pedraza', 'Educacional', 34052382::numeric, 'franco.pedraza@uflouniversidad.edu.ar', 'Activo', 'Jefe', false),
  ('26777403', 'Cynthia Rossi', 'Cynthia', 'Rossi', 'Laboral', 26777403::numeric, null::text, 'Activo', 'Jefe', false)
) as seed(legajo, nombre, nombre_separado, apellido_separado, orientacion_elegida, dni, correo, estado, role, must_change_password)
where not exists (
  select 1 from public.estudiantes e where e.dni = seed.dni
);

create or replace function private.jefe_orientation_key(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(coalesce(p_value, '')), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+', '', 'g'
  );
$$;

create or replace function private.jefe_text_has_area(p_value text, p_area_key text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select private.jefe_orientation_key(p_value) like '%' || p_area_key || '%';
$$;

create or replace function private.require_jefe_areas_v1()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_dni bigint;
  v_areas text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select e.role, e.dni::bigint
  into v_role, v_dni
  from public.estudiantes e
  where e.user_id = auth.uid()
  order by e.created_at desc nulls last
  limit 1;

  if v_role is distinct from 'Jefe' or v_dni is null then
    raise exception 'Jefe role required' using errcode = '42501';
  end if;

  select array_agg(a.area_key order by a.sort_order, a.area_key)
  into v_areas
  from private.jefe_area_assignments a
  where a.dni = v_dni;

  if coalesce(cardinality(v_areas), 0) = 0 then
    raise exception 'No area assignment configured for this account' using errcode = '42501';
  end if;

  return v_areas;
end;
$$;

create or replace function private.get_my_jefe_areas_v1_impl()
returns table(area_key text, area_label text, sort_order smallint)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select unnest(private.require_jefe_areas_v1()) as area_key
  )
  select a.area_key, a.area_label, a.sort_order
  from private.jefe_area_assignments a
  join public.estudiantes e on e.dni::bigint = a.dni
  join allowed x on x.area_key = a.area_key
  where e.user_id = auth.uid()
    and e.role = 'Jefe'
  order by a.sort_order, a.area_key;
$$;

create or replace function public.get_my_jefe_areas_v1()
returns table(area_key text, area_label text, sort_order smallint)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_my_jefe_areas_v1_impl();
$$;

create or replace function private.jefe_report_rows_v1(p_areas text[])
returns table(
  practica_id uuid,
  estudiante_id uuid,
  student_name text,
  legajo text,
  lanzamiento_id uuid,
  pps_name text,
  institution_name text,
  orientation text,
  submitted boolean,
  submitted_at timestamptz,
  deadline_at date,
  days_remaining integer,
  grade text,
  report_status text,
  urgency text,
  campus_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      p.id as practica_id,
      p.estudiante_id,
      coalesce(nullif(trim(e.nombre), ''), 'Estudiante') as student_name,
      e.legajo,
      p.lanzamiento_id,
      coalesce(nullif(trim(l.nombre_pps), ''), nullif(trim(p.nombre_institucion), ''), 'PPS') as pps_name,
      coalesce(nullif(trim(i.nombre), ''), nullif(trim(p.nombre_institucion), ''), nullif(trim(l.nombre_pps), ''), 'Sin institución') as institution_name,
      coalesce(nullif(trim(p.especialidad), ''), nullif(trim(l.orientacion), ''), 'No informada') as orientation,
      p.nota,
      p.informe_estado,
      s.grade_value,
      s.grade_display,
      s.cmid,
      l.informe as launch_report_url,
      coalesce(
        first_submission.submitted_at,
        case
          when c.fecha_entrega_informe ~ '^\d{4}-\d{2}-\d{2}$'
            then c.fecha_entrega_informe::date::timestamptz
          else null
        end
      ) as submitted_at,
      (
        first_submission.submitted_at is not null
        or coalesce(s.submitted, false)
        or coalesce(c.informe_subido, false)
        or lower(coalesce(p.informe_estado, '')) in ('entregado', 'calificado')
      ) as submitted,
      (
        lower(coalesce(p.informe_estado, '')) = 'calificado'
        or coalesce(p.nota, '') ~ '^(4|5|6|7|8|9|10)([.,]0+)?$'
        or lower(trim(coalesce(p.nota, ''))) = 'desaprobado'
        or s.grade_value is not null
      ) as graded
    from public.practicas p
    left join public.estudiantes e on e.id = p.estudiante_id
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    left join public.instituciones i on i.id::text = coalesce(p.institucion_id::text, l.institucion_id)
    left join lateral (
      select c0.*
      from public.convocatorias c0
      where c0.estudiante_id = p.estudiante_id
        and c0.lanzamiento_id = p.lanzamiento_id
      order by c0.created_at desc nulls last
      limit 1
    ) c on true
    left join lateral (
      select s0.*
      from public.moodle_grade_snapshots s0
      where s0.practica_id = p.id
      order by s0.submitted desc, s0.observed_at desc
      limit 1
    ) s on true
    left join lateral (
      select min(o.observed_at) as submitted_at
      from public.moodle_grade_observations o
      where o.practica_id = p.id
        and o.submitted = true
    ) first_submission on true
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and exists (
        select 1
        from unnest(p_areas) area_key
        where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
      )
  ), classified as (
    select
      b.*,
      case when b.submitted_at is not null then b.submitted_at::date + 30 else null end as deadline_at,
      case
        when b.graded then 'corrected'
        when b.submitted then 'pending'
        else 'waiting'
      end as report_status
    from base b
  )
  select
    c.practica_id,
    c.estudiante_id,
    c.student_name,
    c.legajo,
    c.lanzamiento_id,
    c.pps_name,
    c.institution_name,
    c.orientation,
    c.submitted,
    c.submitted_at,
    c.deadline_at,
    case when c.deadline_at is not null
      then c.deadline_at - (now() at time zone 'America/Argentina/Buenos_Aires')::date
      else null
    end as days_remaining,
    coalesce(nullif(trim(c.nota), ''), nullif(trim(c.grade_display), ''), c.grade_value::text) as grade,
    c.report_status,
    case
      when c.report_status <> 'pending' then c.report_status
      when c.deadline_at is null then 'undated'
      when c.deadline_at < (now() at time zone 'America/Argentina/Buenos_Aires')::date then 'critical'
      when c.deadline_at <= (now() at time zone 'America/Argentina/Buenos_Aires')::date + 7 then 'soon'
      else 'on_time'
    end as urgency,
    coalesce(
      case when c.cmid is not null then 'https://campus.uflo.edu.ar/mod/assign/view.php?id=' || c.cmid::text end,
      nullif(trim(c.launch_report_url), '')
    ) as campus_url
  from classified c
  order by
    case c.report_status when 'pending' then 0 when 'waiting' then 1 else 2 end,
    c.deadline_at asc nulls last,
    c.student_name;
$$;

create or replace function private.jefe_annual_offers_v1(
  p_areas text[],
  p_year integer,
  p_cutoff date
)
returns table(
  offer_id text,
  orientation text,
  institution_name text,
  announced_at date,
  capacity_mode text,
  fixed_capacity integer,
  realized_capacity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    h.offer_id,
    h.orientation,
    h.canonical_name as institution_name,
    h.announcement_at::date as announced_at,
    h.capacity_mode,
    case when h.capacity_mode = 'fijo' then h.offered_capacity else null end as fixed_capacity,
    case when h.capacity_mode = 'realizado' then coalesce(realized.participants, 0) else 0 end as realized_capacity
  from private.historical_launch_offers h
  left join lateral (
    select count(distinct p.estudiante_id)::integer as participants
    from private.historical_launch_members hm
    join public.practicas p on p.lanzamiento_id = hm.lanzamiento_id
    where hm.offer_id = h.offer_id
      and hm.use_for_outcomes = true
  ) realized on true
  where p_year = 2024
    and h.source_year = 2024
    and h.count_in_offer_metrics = true
    and h.announcement_at::date <= p_cutoff
    and exists (
      select 1 from unnest(p_areas) area_key
      where private.jefe_text_has_area(h.orientation, area_key)
    )

  union all

  select
    l.id::text,
    coalesce(nullif(trim(l.orientacion), ''), 'No informada'),
    coalesce(nullif(trim(i.nombre), ''), nullif(trim(l.nombre_pps), ''), 'Sin institución'),
    dates.announced_at,
    l.modalidad_cupo,
    case when l.modalidad_cupo = 'fijo' then coalesce(l.cupos_disponibles, 0)::integer else null end,
    case when l.modalidad_cupo = 'realizado' then coalesce(realized.participants, 0) else 0 end
  from public.lanzamientos_pps l
  cross join lateral (
    select case
      when l.fecha_publicacion ~ '^\d{4}-\d{2}-\d{2}$' then l.fecha_publicacion::date
      else l.created_at::date
    end as announced_at
  ) dates
  left join public.instituciones i on i.id::text = l.institucion_id
  left join lateral (
    select count(distinct p.estudiante_id)::integer as participants
    from public.practicas p
    where p.lanzamiento_id = l.id
  ) realized on true
  where p_year <> 2024
    and l.tipo_actividad = 'pps'
    and lower(coalesce(l.estado_convocatoria, '')) <> 'oculto'
    and extract(year from dates.announced_at)::integer = p_year
    and dates.announced_at <= p_cutoff
    and exists (
      select 1 from unnest(p_areas) area_key
      where private.jefe_text_has_area(l.orientacion, area_key)
    );
$$;

create or replace function private.get_jefe_dashboard_v1_impl(
  p_year integer,
  p_cutoff date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_areas text[];
  v_profile jsonb;
  v_reports jsonb;
  v_queue jsonb;
  v_panorama jsonb;
  v_current jsonb;
  v_effective_cutoff date;
begin
  if p_year < 2024 or p_year > extract(year from current_date)::integer + 1 then
    raise exception 'Year out of range';
  end if;

  v_areas := private.require_jefe_areas_v1();
  v_effective_cutoff := least(
    coalesce(p_cutoff, current_date),
    make_date(p_year, 12, 31)
  );

  select jsonb_build_object(
    'name', coalesce(nullif(trim(e.nombre), ''), 'Jefatura'),
    'dni', e.dni::bigint,
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('key', a.area_key, 'label', a.area_label) order by a.sort_order)
      from private.jefe_area_assignments a
      where a.dni = e.dni::bigint
        and a.area_key = any(v_areas)
    ), '[]'::jsonb)
  )
  into v_profile
  from public.estudiantes e
  where e.user_id = auth.uid()
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  into v_reports
  from private.jefe_report_rows_v1(v_areas) r;

  select jsonb_build_object(
    'pending', count(*) filter (where r.report_status = 'pending'),
    'critical', count(*) filter (where r.report_status = 'pending' and r.urgency = 'critical'),
    'soon', count(*) filter (where r.report_status = 'pending' and r.urgency = 'soon'),
    'on_time', count(*) filter (where r.report_status = 'pending' and r.urgency in ('on_time', 'undated')),
    'waiting', count(*) filter (where r.report_status = 'waiting'),
    'corrected', count(*) filter (where r.report_status = 'corrected')
  )
  into v_queue
  from private.jefe_report_rows_v1(v_areas) r;

  with offers as (
    select * from private.jefe_annual_offers_v1(v_areas, p_year, v_effective_cutoff)
  ), institutions as (
    select
      o.institution_name,
      count(*)::integer as offer_count,
      coalesce(sum(o.fixed_capacity), 0)::integer as fixed_capacity,
      coalesce(sum(o.realized_capacity), 0)::integer as realized_capacity
    from offers o
    group by o.institution_name
  ), months as (
    select
      m.month_number,
      count(o.offer_id)::integer as offers
    from generate_series(1, 12) as m(month_number)
    left join offers o on extract(month from o.announced_at)::integer = m.month_number
    group by m.month_number
    order by m.month_number
  ), areas as (
    select
      a.area_key,
      aa.area_label,
      count(o.offer_id)::integer as offers,
      coalesce(sum(o.fixed_capacity), 0)::integer + coalesce(sum(o.realized_capacity), 0)::integer as registered_capacity
    from unnest(v_areas) a(area_key)
    join private.jefe_area_assignments aa
      on aa.area_key = a.area_key
     and aa.dni = (select e.dni::bigint from public.estudiantes e where e.user_id = auth.uid() limit 1)
    left join offers o on private.jefe_text_has_area(o.orientation, a.area_key)
    group by a.area_key, aa.area_label, aa.sort_order
    order by aa.sort_order
  ), started as (
    select count(distinct p.estudiante_id)::integer as students
    from public.practicas p
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    cross join lateral (
      select case
        when p.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}$' then p.fecha_inicio::date
        when l.fecha_inicio ~ '^\d{4}-\d{2}-\d{2}$' then l.fecha_inicio::date
        else null
      end as start_date
    ) d
    where coalesce(l.tipo_actividad, p.tipo_actividad, 'pps') = 'pps'
      and d.start_date is not null
      and extract(year from d.start_date)::integer = p_year
      and d.start_date <= v_effective_cutoff
      and exists (
        select 1 from unnest(v_areas) area_key
        where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
      )
  ), demand as (
    select
      count(c.id)::integer as applications,
      count(distinct c.estudiante_id)::integer as applicants
    from public.convocatorias c
    join public.lanzamientos_pps l on l.id = c.lanzamiento_id
    where l.tipo_actividad = 'pps'
      and exists (
        select 1
        from offers o
        where o.offer_id = l.id::text
      )
  )
  select jsonb_build_object(
    'year', p_year,
    'cutoff', v_effective_cutoff,
    'source', case when p_year = 2024 then 'historical_documented' else 'operational_live' end,
    'offers', (select count(*) from offers),
    'capacity', jsonb_build_object(
      'total', (select coalesce(sum(fixed_capacity), 0) + coalesce(sum(realized_capacity), 0) from offers),
      'fixed', (select coalesce(sum(fixed_capacity), 0) from offers),
      'realized', (select coalesce(sum(realized_capacity), 0) from offers),
      'unknown_offers', (select count(*) from offers where capacity_mode = 'desconocido')
    ),
    'institutions_count', (select count(*) from institutions),
    'institutions', coalesce((select jsonb_agg(to_jsonb(i) order by i.offer_count desc, i.institution_name) from institutions i), '[]'::jsonb),
    'students_started', (select students from started),
    'applications', (select applications from demand),
    'applicants', (select applicants from demand),
    'months', coalesce((select jsonb_agg(to_jsonb(m) order by m.month_number) from months m), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(to_jsonb(a)) from areas a), '[]'::jsonb)
  )
  into v_panorama;

  select jsonb_build_object(
    'as_of', (now() at time zone 'America/Argentina/Buenos_Aires')::date,
    'active_practices', count(distinct p.id) filter (where lower(coalesce(p.estado, '')) in ('activo', 'activa', 'en curso', 'en_curso')),
    'open_offers', (
      select count(*)
      from public.lanzamientos_pps l
      where l.tipo_actividad = 'pps'
        and lower(coalesce(l.estado_convocatoria, '')) = 'abierta'
        and exists (
          select 1 from unnest(v_areas) area_key
          where private.jefe_text_has_area(l.orientacion, area_key)
        )
    ),
    'pending_reports', (v_queue ->> 'pending')::integer,
    'critical_reports', (v_queue ->> 'critical')::integer
  )
  into v_current
  from public.practicas p
  left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  where exists (
    select 1 from unnest(v_areas) area_key
    where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
  );

  return jsonb_build_object(
    'generated_at', now(),
    'profile', v_profile,
    'queue', v_queue,
    'reports', v_reports,
    'panorama', v_panorama,
    'current', v_current
  );
end;
$$;

create or replace function public.get_jefe_dashboard_v1(
  p_year integer default extract(year from current_date)::integer,
  p_cutoff date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_jefe_dashboard_v1_impl(p_year, p_cutoff);
$$;

create or replace function private.update_jefe_report_grade_v1_impl(
  p_practica_id uuid,
  p_grade text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_areas text[];
  v_grade text;
  v_row public.practicas%rowtype;
begin
  v_areas := private.require_jefe_areas_v1();
  v_grade := trim(coalesce(p_grade, ''));

  if v_grade not in ('Sin calificar', 'Desaprobado', '4', '5', '6', '7', '8', '9', '10') then
    raise exception 'Invalid grade';
  end if;

  if not exists (
    select 1
    from public.practicas p
    left join public.lanzamientos_pps l on l.id = p.lanzamiento_id
    where p.id = p_practica_id
      and exists (
        select 1 from unnest(v_areas) area_key
        where private.jefe_text_has_area(coalesce(p.especialidad, l.orientacion), area_key)
      )
  ) then
    raise exception 'Practice outside assigned areas' using errcode = '42501';
  end if;

  update public.practicas p
  set
    nota = case when v_grade = 'Sin calificar' then null else v_grade end,
    informe_estado = case when v_grade = 'Sin calificar' then 'entregado' else 'calificado' end,
    nota_fuente = 'jefe_panel',
    nota_actualizada_at = now()
  where p.id = p_practica_id
  returning p.* into v_row;

  return jsonb_build_object(
    'practica_id', v_row.id,
    'grade', v_row.nota,
    'report_status', v_row.informe_estado,
    'updated_at', v_row.nota_actualizada_at
  );
end;
$$;

create or replace function public.update_jefe_report_grade_v1(
  p_practica_id uuid,
  p_grade text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_jefe_report_grade_v1_impl(p_practica_id, p_grade);
$$;

revoke all on function private.jefe_orientation_key(text) from public;
revoke all on function private.jefe_text_has_area(text, text) from public;
revoke all on function private.require_jefe_areas_v1() from public;
revoke all on function private.get_my_jefe_areas_v1_impl() from public;
revoke all on function private.jefe_report_rows_v1(text[]) from public;
revoke all on function private.jefe_annual_offers_v1(text[], integer, date) from public;
revoke all on function private.get_jefe_dashboard_v1_impl(integer, date) from public;
revoke all on function private.update_jefe_report_grade_v1_impl(uuid, text) from public;

grant usage on schema private to authenticated;
grant execute on function private.get_my_jefe_areas_v1_impl() to authenticated;
grant execute on function private.get_jefe_dashboard_v1_impl(integer, date) to authenticated;
grant execute on function private.update_jefe_report_grade_v1_impl(uuid, text) to authenticated;
grant execute on function private.require_jefe_areas_v1() to authenticated;
grant execute on function private.jefe_report_rows_v1(text[]) to authenticated;
grant execute on function private.jefe_annual_offers_v1(text[], integer, date) to authenticated;
grant execute on function private.jefe_text_has_area(text, text) to authenticated;
grant execute on function private.jefe_orientation_key(text) to authenticated;

revoke all on function public.get_my_jefe_areas_v1() from public, anon;
revoke all on function public.get_jefe_dashboard_v1(integer, date) from public, anon;
revoke all on function public.update_jefe_report_grade_v1(uuid, text) from public, anon;
grant execute on function public.get_my_jefe_areas_v1() to authenticated;
grant execute on function public.get_jefe_dashboard_v1(integer, date) to authenticated;
grant execute on function public.update_jefe_report_grade_v1(uuid, text) to authenticated;

comment on function public.get_jefe_dashboard_v1(integer, date) is
  'Panel de jefatura acotado por DNI y orientación: cola de informes (30 días corridos), panorama anual analytics-v2 compatible y stock operativo actual.';
comment on function public.update_jefe_report_grade_v1(uuid, text) is
  'Registra una calificación sólo si la práctica pertenece a un área asignada al jefe autenticado.';
