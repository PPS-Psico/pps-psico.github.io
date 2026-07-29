create or replace function public.process_consentimiento_timeouts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  est_nombre text;
  est_correo text;
  pps_nombre text;
  project_url text;
  service_key text;
  text_body text;
  subject_line text;
begin
  project_url := current_setting('app.settings.project_url', true);
  service_key := current_setting('app.settings.service_key', true);

  -- PASO 1: Recordatorio a las 12hs sin consentimiento
  for rec in
    select
      c.id as conv_id,
      c.estudiante_id,
      c.lanzamiento_id,
      c.nombre_pps,
      c.correo,
      c.selected_at,
      c.reminder_sent_at
    from public.convocatorias c
    where c.estado_inscripcion = 'Seleccionado'
      and c.selected_at is not null
      and c.selected_at <= now() - interval '12 hours'
      and c.selected_at > now() - interval '24 hours'
      and c.reminder_sent_at is null
      and c.baja_automatica_at is null
      and not exists (
        select 1 from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and cp.estado = 'aceptado'
      )
  loop
    select nombre into est_nombre
    from public.estudiantes
    where id = rec.estudiante_id
    limit 1;

    if rec.correo is not null then
      est_correo := rec.correo;
    else
      select e.correo into est_correo
      from public.estudiantes e
      where e.id = rec.estudiante_id
      limit 1;
    end if;

    subject_line := 'Recordatorio urgente: Tenés 12 horas para confirmar tu PPS';
    text_body := 'Hola ' || coalesce(est_nombre, 'Estudiante') || ',' || chr(10) || chr(10) ||
      'Te recordamos que fuiste seleccionado/a para la Práctica Profesional Supervisada en:' || chr(10) ||
      'Institución: ' || coalesce(rec.nombre_pps, 'PPS') || chr(10) || chr(10) ||
      'Pasaron 12 horas desde tu selección y aún no registraste tu aceptación digital del compromiso.' || chr(10) || chr(10) ||
      'Tenés 12 horas restantes para ingresar a Mi Panel y confirmar tu participación.' || chr(10) ||
      'Si no confirmás en ese plazo, se dará de baja automáticamente tu asignación.' || chr(10) || chr(10) ||
      'Si ya no podés realizar la PPS, comunicate con la Coordinación respondiendo este correo.' || chr(10) || chr(10) ||
      'Saludos,' || chr(10) || chr(10) ||
      'Blas' || chr(10) ||
      'Coordinador de Prácticas Profesionales Supervisadas' || chr(10) ||
      'Licenciatura en Psicología - UFLO';

    if project_url is not null and service_key is not null then
      perform net.http_post(
        url := project_url || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'to', est_correo,
          'subject', subject_line,
          'text', text_body,
          'name', coalesce(est_nombre, 'Estudiante'),
          'html', ''
        )
      );
    end if;

    update public.convocatorias
    set reminder_sent_at = now()
    where id = rec.conv_id;

    raise notice '[Consentimiento] Reminder enviado a % para convocatoria %', est_correo, rec.conv_id;
  end loop;

  -- PASO 2: Baja automática a las 24hs sin consentimiento
  for rec in
    select
      c.id as conv_id,
      c.estudiante_id,
      c.lanzamiento_id,
      c.nombre_pps,
      c.correo,
      c.selected_at,
      c.reminder_sent_at
    from public.convocatorias c
    where c.estado_inscripcion = 'Seleccionado'
      and c.selected_at is not null
      and c.selected_at <= now() - interval '24 hours'
      and c.baja_automatica_at is null
      and not exists (
        select 1 from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and cp.estado = 'aceptado'
      )
  loop
    select nombre, correo into est_nombre, est_correo
    from public.estudiantes
    where id = rec.estudiante_id
    limit 1;

    if rec.correo is not null then
      est_correo := rec.correo;
    end if;

    pps_nombre := coalesce(rec.nombre_pps, 'PPS');

    -- Revertir estado
    update public.convocatorias
    set
      estado_inscripcion = 'Inscripto',
      baja_automatica_at = now()
    where id = rec.conv_id;

    -- Eliminar práctica asociada
    delete from public.practicas
    where estudiante_id = rec.estudiante_id
      and lanzamiento_id = rec.lanzamiento_id;

    -- Email al estudiante
    subject_line := 'Baja automática por falta de confirmación - PPS: ' || pps_nombre;
    text_body := 'Hola ' || coalesce(est_nombre, 'Estudiante') || ',' || chr(10) || chr(10) ||
      'Te informamos que se dio de baja automáticamente tu asignación a la PPS en:' || chr(10) ||
      'Institución: ' || pps_nombre || chr(10) || chr(10) ||
      'Esto ocurrió porque no se registró la aceptación digital del compromiso dentro del plazo de 24 horas.' || chr(10) || chr(10) ||
      'Si esto fue un error, comunicate con la Coordinación lo antes posible.' || chr(10) || chr(10) ||
      'Saludos,' || chr(10) || chr(10) ||
      'Blas' || chr(10) ||
      'Coordinador de Prácticas Profesionales Supervisadas' || chr(10) ||
      'Licenciatura en Psicología - UFLO';

    if project_url is not null and service_key is not null then
      perform net.http_post(
        url := project_url || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'to', est_correo,
          'subject', subject_line,
          'text', text_body,
          'name', coalesce(est_nombre, 'Estudiante'),
          'html', ''
        )
      );

      -- Email al coordinador
      subject_line := 'Baja automática de estudiante - PPS: ' || pps_nombre;
      text_body := 'Se dio de baja automáticamente a un estudiante por no confirmar el compromiso digital.' || chr(10) || chr(10) ||
        'Estudiante: ' || coalesce(est_nombre, 'Desconocido') || chr(10) ||
        'Correo: ' || coalesce(est_correo, 'No disponible') || chr(10) ||
        'PPS: ' || pps_nombre || chr(10) ||
        'Fecha de selección: ' || coalesce(to_char(rec.selected_at, 'DD/MM/YYYY HH24:MI'), 'N/A') || chr(10) ||
        'Fecha de baja: ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || chr(10) ||
        'Recordatorio enviado: ' || case when rec.reminder_sent_at is not null then 'Sí' else 'No' end || chr(10) || chr(10) ||
        'Se liberó la vacante. Considerá seleccionar un nuevo estudiante si corresponde.';

      perform net.http_post(
        url := project_url || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'to', 'blas.rivera@uflouniversidad.edu.ar',
          'subject', subject_line,
          'text', text_body,
          'name', 'Blas Rivera',
          'html', ''
        )
      );
    end if;

    raise notice '[Consentimiento] Baja automática: % de %', est_nombre, pps_nombre;
  end loop;
end;
$$;

grant execute on function public.process_consentimiento_timeouts() to postgres, service_role;

comment on function public.process_consentimiento_timeouts() is
  'Procesa plazos de consentimiento: recordatorio 12hs, baja automática 24hs. Ejecutado por pg_cron cada 10 minutos.';