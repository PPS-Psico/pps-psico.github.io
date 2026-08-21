-- Digest semanal de SLA de correccion para jefaturas de area.
--
-- Agrupa los informes pendientes por jefatura (dni), separando vencidos
-- (critical) y por vencer dentro de 7 dias (soon), reutilizando el calculo
-- canonico de private.jefe_report_rows_v1. La Edge Function
-- check-informe-sla solo consume este digest y envia emails.
--
-- Nota: preview_key NO distingue jefe real de simulacion; toda asignacion
-- tiene clave de preview y el jefe real se resuelve por dni.

create or replace function private.get_informe_sla_digest_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with jefes as (
    select
      a.dni,
      array_agg(distinct a.area_key order by a.area_key) as area_keys,
      string_agg(distinct a.area_label, ', ' order by a.area_label) as areas_label,
      max(c.nombre) as jefe_nombre,
      max(c.correo) as jefe_correo
    from private.jefe_area_assignments a
    left join lateral (
      select candidate.nombre, candidate.correo
      from public.estudiantes candidate
      where candidate.dni::bigint = a.dni
      order by (candidate.role = 'Jefe') desc, candidate.created_at desc nulls last
      limit 1
    ) c on true
    group by a.dni
  ),
  items as (
    select
      j.dni,
      j.jefe_nombre,
      j.jefe_correo,
      j.areas_label,
      r.student_name,
      r.pps_name,
      r.institution_name,
      r.deadline_at,
      r.days_remaining,
      r.campus_url,
      r.urgency
    from jefes j
    cross join lateral private.jefe_report_rows_v1(j.area_keys) r
    where r.report_status = 'pending'
      and r.urgency in ('critical', 'soon')
  ),
  grouped as (
    select
      dni,
      max(jefe_nombre) as jefe_nombre,
      max(jefe_correo) as jefe_correo,
      max(areas_label) as areas_label,
      jsonb_agg(
        jsonb_build_object(
          'estudiante', student_name,
          'pps', pps_name,
          'institucion', institution_name,
          'deadline', deadline_at,
          'dias', days_remaining,
          'url', campus_url
        ) order by deadline_at nulls last, student_name
      ) filter (where urgency = 'critical') as vencidos,
      jsonb_agg(
        jsonb_build_object(
          'estudiante', student_name,
          'pps', pps_name,
          'institucion', institution_name,
          'deadline', deadline_at,
          'dias', days_remaining,
          'url', campus_url
        ) order by deadline_at nulls last, student_name
      ) filter (where urgency = 'soon') as por_vencer
    from items
    group by dni
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'dni', dni,
        'jefe_nombre', jefe_nombre,
        'jefe_correo', jefe_correo,
        'areas', areas_label,
        'vencidos', coalesce(vencidos, '[]'::jsonb),
        'por_vencer', coalesce(por_vencer, '[]'::jsonb)
      ) order by dni
    ),
    '[]'::jsonb
  )
  from grouped
  where coalesce(vencidos, '[]'::jsonb) <> '[]'::jsonb
     or coalesce(por_vencer, '[]'::jsonb) <> '[]'::jsonb
$$;

revoke all on function private.get_informe_sla_digest_v1()
  from public, anon, authenticated;
grant execute on function private.get_informe_sla_digest_v1() to service_role;

comment on function private.get_informe_sla_digest_v1() is
  'Digest para el recordatorio semanal de SLA: informes vencidos o por vencer en 7 dias, agrupados por jefatura (dni).';
