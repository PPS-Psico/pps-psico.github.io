-- Contrato manual para director-report-v1.
-- Ejecutar autenticado como personal autorizado en un entorno de prueba.

do $$
declare
  v_report jsonb;
begin
  v_report := public.get_director_report_v1(extract(year from current_date)::integer, current_date);

  assert v_report ->> 'metric_version' = 'director-report-v1',
    'metric_version debe ser director-report-v1';
  assert v_report #>> '{privacy,classification}' = 'circulacion_interna',
    'el informe debe marcarse como circulación interna';
  assert (v_report #>> '{privacy,contains_personal_data}')::boolean,
    'el informe debe declarar que contiene datos personales';
  assert jsonb_typeof(v_report -> 'without_pps_students') = 'array',
    'without_pps_students debe ser un array';
  assert jsonb_typeof(v_report -> 'near_completion_students') = 'array',
    'near_completion_students debe ser un array';
  assert jsonb_typeof(v_report #> '{pressure,offers}') = 'array',
    'pressure.offers debe ser un array';
  assert not (v_report::text ~* '"(dni|correo|telefono|direccion)"\s*:'),
    'el payload no debe exponer datos de contacto';
  assert (v_report #>> '{student_summary,near_completion}')::integer =
    jsonb_array_length(v_report -> 'near_completion_students'),
    'el total de próximos a finalizar debe coincidir con el detalle';
  assert (v_report #>> '{criteria,near_completion_actionable,excludes_professional_interview_practice}')::boolean,
    'proximos a finalizar debe excluir la PPS de entrevista ya realizada';
  assert not exists (
    select (student ->> 'student_id')::uuid
    from jsonb_array_elements(v_report -> 'near_completion_students') as rows(student)
    except
    select id
    from public.get_interview_completion_candidates_v1()
  ) and not exists (
    select id
    from public.get_interview_completion_candidates_v1()
    except
    select (student ->> 'student_id')::uuid
    from jsonb_array_elements(v_report -> 'near_completion_students') as rows(student)
  ), 'Direccion y dashboard deben publicar exactamente la misma cohorte proxima a finalizar';
  assert (v_report #>> '{student_summary,without_pps}')::integer =
    jsonb_array_length(v_report -> 'without_pps_students'),
    'el total sin PPS debe coincidir con el detalle';
  assert (v_report #>> '{criteria,without_pps_active_demand,requires_annual_application}')::boolean,
    'sin PPS debe requerir una postulación del ciclo';
  assert not exists (
    select 1
    from jsonb_array_elements(v_report -> 'without_pps_students') as rows(student)
    where (student ->> 'application_count')::integer < 1
  ), 'cada estudiante sin PPS debe tener al menos una postulación del ciclo';
  assert not exists (
    select 1
    from jsonb_array_elements(v_report -> 'without_pps_students') as rows(student)
    where not exists (
      select 1
      from public.convocatorias as c
      join public.lanzamientos_pps as l on l.id = c.lanzamiento_id
      where c.estudiante_id = (student ->> 'student_id')::uuid
        and (c.created_at at time zone 'America/Argentina/Buenos_Aires')::date
          >= make_date(extract(year from current_date)::integer, 1, 1)
        and (c.created_at at time zone 'America/Argentina/Buenos_Aires')::date
          <= current_date
        and coalesce(l.tipo_actividad, 'pps') = 'pps'
    )
  ), 'el listado sin PPS no debe incluir estudiantes sin demanda activa anual';
end;
$$;
