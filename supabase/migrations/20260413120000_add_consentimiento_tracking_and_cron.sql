-- ============================================================
-- Migración: Tracking de consentimiento + pg_cron para bajas automáticas
-- ============================================================
-- Flujo:
--   T=0h  → Estudiante seleccionado (selected_at)
--   T=12h → Si NO aceptó → email recordatorio (reminder_sent_at)
--   T=24h → Si sigue sin aceptar → baja automática + email al coordinador
-- ============================================================

-- 1. Agregar campos de tracking a convocatorias
alter table public.convocatorias
  add column if not exists selected_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists baja_automatica_at timestamptz;

-- 2. Habilitar pg_cron si no está
create extension if not exists pg_cron with schema pg_catalog;

-- 3. Habilitar pg_net para invocar Edge Functions desde SQL
create extension if not exists pg_net with schema extensions;

-- 4. Función que procesa los plazos de consentimiento
-- Se ejecuta cada 10 minutos vía pg_cron
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
  lanz_id text;
  est_id text;
  conv_id text;
  project_url text;
  service_key text;
  html_body text;
  text_body text;
  subject_line text;
begin
  project_url := current_setting('app.settings.project_url', true);
  service_key := current_setting('app.settings.service_key', true);

  -- ============================================================
  -- PASO 1: Enviar recordatorio a las 12hs sin consentimiento
  -- ============================================================
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
    -- Obtener nombre del estudiante
    select nombre into est_nombre
    from public.estudiantes
    where id = rec.estudiante_id
    limit 1;

    -- Obtener correo del estudiante (fallback)
    if rec.correo is not null then
      est_correo := rec.correo;
    else
      select e.correo into est_correo
      from public.estudiantes e
      where e.id = rec.estudiante_id
      limit 1;
    end if;

    -- Enviar email de recordatorio via Edge Function
    subject_line := 'Recordatorio urgente: Tenés 12 horas para confirmar tu PPS';
    text_body := 'Hola ' || coalesce(est_nombre, 'Estudiante') || ',' || chr(10) || chr(10) ||
      'Te recordamos que fuiste seleccionado/a para la Práctica Profesional Supervisada en:' || chr(10) ||
      'Institución: ' || coalesce(rec.nombre_pps, 'PPS') || chr(10) || chr(10) ||
      'Pasaron 12 horas desde tu selección y aún no registraste tu aceptación digital del compromiso.' || chr(10) || chr(10) ||
      '**Acción requerida** Tenés 12 horas restantes para ingresar a Mi Panel y confirmar tu participación.' || chr(10) ||
      'Si no confirmás en ese plazo, se dará de baja automáticamente tu asignación.' || chr(10) || chr(10) ||
      'Si ya no podés realizar la PPS, comunicate con la Coordinación respondiendo este correo.' || chr(10) || chr(10) ||
      'Saludos,' || chr(10) || chr(10) ||
      'Blas' || chr(10) ||
      'Coordinador de Prácticas Profesionales Supervisadas' || chr(10) ||
      'Licenciatura en Psicología' || chr(10) ||
      'UFLO';

    -- Invocar Edge Function send-email usando pg_net
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

    -- Marcar reminder enviado
    update public.convocatorias
    set reminder_sent_at = now()
    where id = rec.conv_id;

    raise notice '[Consentimiento] Reminder enviado a % para convocatoria %', est_correo, rec.conv_id;
  end loop;

  -- ============================================================
  -- PASO 2: Baja automática a las 24hs sin consentimiento
  -- ============================================================
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
    -- Obtener datos del estudiante
    select nombre, correo into est_nombre, est_correo
    from public.estudiantes
    where id = rec.estudiante_id
    limit 1;

    if rec.correo is not null then
      est_correo := rec.correo;
    end if;

    pps_nombre := coalesce(rec.nombre_pps, 'PPS');

    -- 2a. Revertir estado de la convocatoria
    update public.convocatorias
    set
      estado_inscripcion = 'Inscripto',
      baja_automatica_at = now()
    where id = rec.conv_id;

    -- 2b. Eliminar la práctica asociada
    delete from public.practicas
    where estudiante_id = rec.estudiante_id
      and lanzamiento_id = rec.lanzamiento_id;

    -- 2c. Enviar email al estudiante notificando la baja
    subject_line := 'Baja automática por falta de confirmación - PPS: ' || pps_nombre;
    text_body := 'Hola ' || coalesce(est_nombre, 'Estudiante') || ',' || chr(10) || chr(10) ||
      'Te informamos que se dio de baja automáticamente tu asignación a la Práctica Profesional Supervisada en:' || chr(10) ||
      'Institución: ' || pps_nombre || chr(10) || chr(10) ||
      'Esto ocurrió porque no se registró la aceptación digital del compromiso dentro del plazo de 24 horas desde tu selección.' || chr(10) || chr(10) ||
      'Si esto fue un error o tenías una razón válida para no confirmar, comunicate con la Coordinación lo antes posible para evaluar la situación.' || chr(10) || chr(10) ||
      'Saludos,' || chr(10) || chr(10) ||
      'Blas' || chr(10) ||
      'Coordinador de Prácticas Profesionales Supervisadas' || chr(10) ||
      'Licenciatura en Psicología' || chr(10) ||
      'UFLO';

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

    -- 2d. Enviar email al coordinador notificando la baja
    subject_line := 'Baja automática de estudiante - PPS: ' || pps_nombre;
    text_body := 'Se dio de baja automáticamente a un estudiante por no confirmar el compromiso digital dentro del plazo de 24 horas.' || chr(10) || chr(10) ||
      'Estudiante: ' || coalesce(est_nombre, 'Desconocido') || chr(10) ||
      'Correo: ' || coalesce(est_correo, 'No disponible') || chr(10) ||
      'PPS: ' || pps_nombre || chr(10) ||
      'Fecha de selección: ' || coalesce(to_char(rec.selected_at, 'DD/MM/YYYY HH24:MI'), 'N/A') || chr(10) ||
      'Fecha de baja: ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || chr(10) ||
      'Recordatorio enviado: ' || case when rec.reminder_sent_at is not null then 'Sí (' || to_char(rec.reminder_sent_at, 'DD/MM/YYYY HH24:MI') || ')' else 'No' end || chr(10) || chr(10) ||
      'Se liberó la vacante. Considerá seleccionar un nuevo estudiante si corresponde.';

    if project_url is not null and service_key is not null then
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

    raise notice '[Consentimiento] Baja automática: estudiante % de PPS %', est_nombre, pps_nombre;
  end loop;
end;
$$;

-- 5. Programar pg_cron cada 10 minutos
select cron.schedule(
  'check-consentimiento-pendientes',
  '*/10 * * * *',
  $$select public.process_consentimiento_timeouts();$$
);

-- 6. Grant execute
grant execute on function public.process_consentimiento_timeouts() to postgres, service_role;

-- 7. Comentario documental
comment on function public.process_consentimiento_timeouts() is
  'Procesa plazos de consentimiento digital: envía recordatorio a las 12hs y baja automática a las 24hs. Ejecutado por pg_cron cada 10 minutos.';
