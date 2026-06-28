-- ============================================================
-- Migración: el consentimiento digital queda abierto HASTA 24h
-- ANTES de que comience la PPS (en lugar de 24h después de la
-- selección).
-- ============================================================
-- Antes:
--   T=0h  → seleccionado (selected_at)
--   T=12h → recordatorio
--   T=24h → baja automática
-- Esto hacía que un estudiante seleccionado con varios días de
-- anticipación perdiera el lugar (y se le borrara la práctica)
-- aunque la PPS todavía no hubiera empezado.
--
-- Ahora:
--   cierre   = inicio_pps - 24h
--              (si la selección fue tardía —menos de 24h antes del
--               inicio— el cierre pasa a ser el propio inicio: nunca
--               se da de baja antes de que la PPS arranque)
--   recordatorio = 48h antes del cierre (si la ventana es más corta,
--                  se envía apenas se evalúa)
--   baja         = al llegar al cierre, si no firmó
--   sin fecha de inicio conocida → no se da de baja (más seguro)
-- ============================================================

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
  v_start timestamptz;
  v_deadline timestamptz;
begin
  project_url := current_setting('app.settings.project_url', true);
  service_key := current_setting('app.settings.service_key', true);

  -- Recorremos todos los seleccionados que aún no firmaron ni fueron
  -- dados de baja. La fecha de inicio se toma del lanzamiento vinculado
  -- (con fallback a la copia desnormalizada en la convocatoria).
  for rec in
    select
      c.id as conv_id,
      c.estudiante_id,
      c.lanzamiento_id,
      c.nombre_pps,
      c.correo,
      c.selected_at,
      c.reminder_sent_at,
      public.safe_date_cast(coalesce(l.fecha_inicio, c.fecha_inicio)) as start_ts
    from public.convocatorias c
    left join public.lanzamientos_pps l on l.id = c.lanzamiento_id
    where c.estado_inscripcion = 'Seleccionado'
      and c.selected_at is not null
      and c.baja_automatica_at is null
      and not exists (
        select 1 from public.compromisos_pps cp
        where cp.convocatoria_id = c.id
          and cp.estado = 'aceptado'
      )
  loop
    -- Sin fecha de inicio no podemos calcular el plazo → no damos de baja.
    if rec.start_ts is null then
      continue;
    end if;

    v_start := rec.start_ts;

    -- Cierre: 24h antes del inicio. Si la selección ocurrió cuando ya
    -- quedaban menos de 24h, el cierre pasa a ser el inicio mismo, para
    -- no dar de baja antes de que la PPS empiece.
    if rec.selected_at <= v_start - interval '24 hours' then
      v_deadline := v_start - interval '24 hours';
    else
      v_deadline := v_start;
    end if;

    -- Datos del estudiante (nombre + correo con fallback)
    select e.nombre, e.correo into est_nombre, est_correo
    from public.estudiantes e
    where e.id = rec.estudiante_id
    limit 1;

    if rec.correo is not null then
      est_correo := rec.correo;
    end if;

    pps_nombre := coalesce(rec.nombre_pps, 'PPS');

    -- ========================================================
    -- BAJA automática: ya se llegó al cierre sin confirmar
    -- ========================================================
    if now() >= v_deadline then
      update public.convocatorias
      set
        estado_inscripcion = 'Inscripto',
        baja_automatica_at = now()
      where id = rec.conv_id;

      delete from public.practicas
      where estudiante_id = rec.estudiante_id
        and lanzamiento_id = rec.lanzamiento_id;

      -- Email al estudiante
      subject_line := 'Baja automática por falta de confirmación - PPS: ' || pps_nombre;
      text_body := 'Hola ' || coalesce(est_nombre, 'Estudiante') || ',' || chr(10) || chr(10) ||
        'Te informamos que se dio de baja automáticamente tu asignación a la Práctica Profesional Supervisada en:' || chr(10) ||
        'Institución: ' || pps_nombre || chr(10) || chr(10) ||
        'Esto ocurrió porque no se registró la aceptación digital del compromiso antes del cierre (24 horas antes del inicio de la práctica).' || chr(10) || chr(10) ||
        'Si esto fue un error o tenías una razón válida para no confirmar, comunicate con la Coordinación lo antes posible para evaluar la situación.' || chr(10) || chr(10) ||
        'Saludos,' || chr(10) || chr(10) ||
        'Blas' || chr(10) ||
        'Coordinador de Prácticas Profesionales Supervisadas' || chr(10) ||
        'Licenciatura en Psicología' || chr(10) ||
        'UFLO';

      if project_url is not null and service_key is not null and est_correo is not null then
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

      -- Email al coordinador
      subject_line := 'Baja automática de estudiante - PPS: ' || pps_nombre;
      text_body := 'Se dio de baja automáticamente a un estudiante por no confirmar el compromiso digital antes del cierre (24 horas antes del inicio).' || chr(10) || chr(10) ||
        'Estudiante: ' || coalesce(est_nombre, 'Desconocido') || chr(10) ||
        'Correo: ' || coalesce(est_correo, 'No disponible') || chr(10) ||
        'PPS: ' || pps_nombre || chr(10) ||
        'Fecha de selección: ' || coalesce(to_char(rec.selected_at, 'DD/MM/YYYY HH24:MI'), 'N/A') || chr(10) ||
        'Inicio de la PPS: ' || coalesce(to_char(v_start, 'DD/MM/YYYY'), 'N/A') || chr(10) ||
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

      raise notice '[Consentimiento] Baja automática: estudiante % de PPS % (cierre %)', est_nombre, pps_nombre, v_deadline;

    -- ========================================================
    -- RECORDATORIO: faltan <=48h para el cierre y aún no firmó
    -- ========================================================
    elsif rec.reminder_sent_at is null and now() >= v_deadline - interval '48 hours' then
      subject_line := 'Recordatorio: confirmá tu PPS antes del cierre';
      text_body := 'Hola ' || coalesce(est_nombre, 'Estudiante') || ',' || chr(10) || chr(10) ||
        'Te recordamos que fuiste seleccionado/a para la Práctica Profesional Supervisada en:' || chr(10) ||
        'Institución: ' || pps_nombre || chr(10) || chr(10) ||
        'Todavía no registraste tu aceptación digital del compromiso.' || chr(10) || chr(10) ||
        '**Acción requerida** Ingresá a Mi Panel y confirmá tu participación. El consentimiento queda abierto hasta 24 horas antes del inicio de la práctica.' || chr(10) ||
        'Si no confirmás antes de ese momento, se dará de baja automáticamente tu asignación y se liberará la vacante.' || chr(10) || chr(10) ||
        'Si ya no podés realizar la PPS, comunicate con la Coordinación respondiendo este correo.' || chr(10) || chr(10) ||
        'Saludos,' || chr(10) || chr(10) ||
        'Blas' || chr(10) ||
        'Coordinador de Prácticas Profesionales Supervisadas' || chr(10) ||
        'Licenciatura en Psicología' || chr(10) ||
        'UFLO';

      if project_url is not null and service_key is not null and est_correo is not null then
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

      raise notice '[Consentimiento] Recordatorio enviado a % para convocatoria % (cierre %)', est_correo, rec.conv_id, v_deadline;
    end if;
  end loop;
end;
$$;

comment on function public.process_consentimiento_timeouts() is
  'Procesa el consentimiento digital: recordatorio 48h antes del cierre y baja automática en el cierre. El cierre es 24h antes del inicio de la PPS (o el inicio mismo si la selección fue tardía). Ejecutado por pg_cron cada 10 minutos.';

grant execute on function public.process_consentimiento_timeouts() to postgres, service_role;
