-- Contrato no destructivo del plazo y los conteos de consentimiento.
begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

do $$
declare
  v_regular timestamptz;
  v_late timestamptz;
  v_delivery timestamptz;
begin
  v_regular := public.consentimiento_deadline(
    '2026-08-21',
    '2026-08-05 12:00:00+00',
    null
  );
  if v_regular <> '2026-08-20 03:00:00+00'::timestamptz then
    raise exception 'Cierre regular incorrecto: %', v_regular;
  end if;

  v_late := public.consentimiento_deadline(
    '2026-08-21',
    '2026-08-20 12:00:00+00',
    null
  );
  if v_late <> '2026-08-21 03:00:00+00'::timestamptz then
    raise exception 'Cierre de selección tardía incorrecto: %', v_late;
  end if;

  v_delivery := public.consentimiento_deadline(
    '2026-08-21',
    '2026-08-05 12:00:00+00',
    '2026-08-10 18:30:00+00'
  );
  if v_delivery <> '2026-08-10 18:30:00+00'::timestamptz then
    raise exception 'La entrega institucional no adelantó el cierre: %', v_delivery;
  end if;
end;
$$;

select set_config('pps_test.consent_launch_id', gen_random_uuid()::text, true);

create temp table consentimiento_test_students as
select generate_series(1, 37) as n, gen_random_uuid() as estudiante_id, gen_random_uuid() as convocatoria_id;

insert into public.estudiantes (id, legajo, nombre, role, estado)
select estudiante_id, 'TEST-CONSENT-' || n, '[TEST] Consentimiento ' || n, 'Alumno', 'Activo'
from consentimiento_test_students;

insert into public.lanzamientos_pps (
  id, nombre_pps, orientacion, fecha_inicio, fecha_finalizacion,
  estado_convocatoria, tipo_actividad, modalidad_cupo
) values (
  current_setting('pps_test.consent_launch_id')::uuid,
  '[TEST] Conteo consentimiento',
  'Clínica',
  '2099-08-21',
  '2099-10-21',
  'Confirmacion',
  'pps',
  'fijo'
);

insert into public.convocatorias (
  id, estudiante_id, lanzamiento_id, estado_inscripcion, selected_at
)
select
  convocatoria_id,
  estudiante_id,
  current_setting('pps_test.consent_launch_id')::uuid,
  'Seleccionado',
  '2099-08-01 12:00:00+00'
from consentimiento_test_students;

insert into public.compromisos_pps (
  estudiante_id, convocatoria_id, lanzamiento_id, version, estado, texto_acta,
  acepta_lectura, acepta_compromiso, nombre_completo, dni, legajo, firma_texto
)
select
  estudiante_id,
  convocatoria_id,
  current_setting('pps_test.consent_launch_id')::uuid,
  'test-v1',
  'aceptado',
  'Acta de prueba',
  true,
  true,
  '[TEST] Consentimiento ' || n,
  10000000 + n,
  'TEST-CONSENT-' || n,
  '[TEST] Consentimiento ' || n
from consentimiento_test_students
where n <= 25;

do $$
declare
  v_counts jsonb;
begin
  v_counts := public.get_consent_counts_by_launch(
    array[current_setting('pps_test.consent_launch_id')::uuid]
  ) -> current_setting('pps_test.consent_launch_id');

  if (v_counts ->> 'aceptados')::integer <> 25
     or (v_counts ->> 'total')::integer <> 37
     or (v_counts ->> 'pendientes')::integer <> 12 then
    raise exception 'Conteo no reconciliado; se esperaba 25/37 con 12 pendientes: %', v_counts;
  end if;
end;
$$;

rollback;
