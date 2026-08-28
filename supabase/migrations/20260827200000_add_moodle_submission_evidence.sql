begin;

-- Evidencia derivada de la composición de una entrega Moodle.
--
-- La lista de nombres se usa sólo dentro de la Edge Function. Estas tablas no
-- guardan nombres, URLs ni archivos: únicamente conteos, tipos y códigos de
-- decisión. Así podemos medir el clasificador en modo sombra sin duplicar el
-- almacenamiento del Campus ni introducir documentos personales en Supabase.

alter table public.moodle_grade_observations
  add column if not exists submission_file_count integer,
  add column if not exists submission_logical_file_count integer,
  add column if not exists submission_file_types jsonb,
  add column if not exists attendance_evidence text,
  add column if not exists attendance_confidence numeric(4,3),
  add column if not exists attendance_evidence_reasons jsonb,
  add column if not exists submission_classifier_version text;

alter table public.moodle_grade_snapshots
  add column if not exists submission_file_count integer,
  add column if not exists submission_logical_file_count integer,
  add column if not exists submission_file_types jsonb,
  add column if not exists attendance_evidence text,
  add column if not exists attendance_confidence numeric(4,3),
  add column if not exists attendance_evidence_reasons jsonb,
  add column if not exists submission_classifier_version text;

do $$
declare
  v_table regclass;
  v_prefix text;
begin
  foreach v_table in array array[
    'public.moodle_grade_observations'::regclass,
    'public.moodle_grade_snapshots'::regclass
  ]
  loop
    v_prefix := case
      when v_table = 'public.moodle_grade_observations'::regclass then 'moodle_grade_observations'
      else 'moodle_grade_snapshots'
    end;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_table and conname = v_prefix || '_submission_file_count_check'
    ) then
      execute format(
        'alter table %s add constraint %I check (submission_file_count between 0 and 20)',
        v_table,
        v_prefix || '_submission_file_count_check'
      );
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_table and conname = v_prefix || '_submission_logical_count_check'
    ) then
      execute format(
        'alter table %s add constraint %I check (submission_logical_file_count between 0 and submission_file_count)',
        v_table,
        v_prefix || '_submission_logical_count_check'
      );
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_table and conname = v_prefix || '_submission_file_types_check'
    ) then
      execute format(
        'alter table %s add constraint %I check (submission_file_types is null or jsonb_typeof(submission_file_types) = ''object'')',
        v_table,
        v_prefix || '_submission_file_types_check'
      );
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_table and conname = v_prefix || '_attendance_evidence_check'
    ) then
      execute format(
        'alter table %s add constraint %I check (attendance_evidence is null or attendance_evidence in (''not_required'', ''missing'', ''single_file'', ''duplicate_only'', ''needs_review'', ''assumed'', ''detected''))',
        v_table,
        v_prefix || '_attendance_evidence_check'
      );
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_table and conname = v_prefix || '_attendance_confidence_check'
    ) then
      execute format(
        'alter table %s add constraint %I check (attendance_confidence between 0 and 1)',
        v_table,
        v_prefix || '_attendance_confidence_check'
      );
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_table and conname = v_prefix || '_attendance_reasons_check'
    ) then
      execute format(
        'alter table %s add constraint %I check (attendance_evidence_reasons is null or jsonb_typeof(attendance_evidence_reasons) = ''array'')',
        v_table,
        v_prefix || '_attendance_reasons_check'
      );
    end if;
  end loop;
end;
$$;

comment on column public.moodle_grade_observations.submission_file_count is
  'Cantidad de adjuntos visibles en Moodle. Null significa que la lista no pudo observarse; no se guardan nombres ni archivos.';
comment on column public.moodle_grade_observations.submission_logical_file_count is
  'Cantidad luego de colapsar copias obvias y el mismo nombre en formatos distintos.';
comment on column public.moodle_grade_observations.submission_file_types is
  'Conteos agregados por tipo: image, pdf, word y other.';
comment on column public.moodle_grade_observations.attendance_evidence is
  'Resultado conservador para la planilla: not_required, missing, single_file, duplicate_only, needs_review, assumed o detected.';
comment on column public.moodle_grade_observations.attendance_confidence is
  'Confianza 0-1 del clasificador; sólo sirve para rollout medido, no acredita por sí sola.';
comment on column public.moodle_grade_observations.attendance_evidence_reasons is
  'Códigos de evidencia sin nombres de archivo ni contenido documental.';
comment on column public.moodle_grade_observations.submission_classifier_version is
  'Versión reproducible del clasificador de composición de archivos.';

comment on column public.moodle_grade_snapshots.submission_file_count is
  'Último conteo derivado de adjuntos observado para la práctica y tarea.';
comment on column public.moodle_grade_snapshots.submission_logical_file_count is
  'Último conteo lógico luego de colapsar copias obvias.';
comment on column public.moodle_grade_snapshots.submission_file_types is
  'Último resumen agregado de tipos; no contiene nombres ni URLs.';
comment on column public.moodle_grade_snapshots.attendance_evidence is
  'Último estado de evidencia de planilla de asistencia.';
comment on column public.moodle_grade_snapshots.attendance_confidence is
  'Confianza 0-1 de la evidencia de planilla.';
comment on column public.moodle_grade_snapshots.attendance_evidence_reasons is
  'Códigos de la decisión vigente sin datos del documento.';
comment on column public.moodle_grade_snapshots.submission_classifier_version is
  'Versión del clasificador que produjo el snapshot.';

-- Métricas del modo sombra. No inicia acreditaciones y no expone detalle de
-- estudiantes. Coordinación puede medir cobertura y falsos positivos antes de
-- habilitar cualquier efecto automático.
create or replace function public.get_moodle_submission_evidence_health_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinación'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'observed', count(*) filter (where s.submission_classifier_version is not null),
    'submittedWithoutFileObservation', count(*) filter (
      where s.task_status in ('submitted', 'graded')
        and s.submission_classifier_version is null
    ),
    'onlineNotRequired', count(*) filter (where s.attendance_evidence = 'not_required'),
    'onsiteDetected', count(*) filter (where s.attendance_evidence = 'detected'),
    'onsiteAssumed', count(*) filter (where s.attendance_evidence = 'assumed'),
    'onsiteNeedsReview', count(*) filter (where s.attendance_evidence = 'needs_review'),
    'onsiteInsufficient', count(*) filter (
      where s.attendance_evidence in ('missing', 'single_file', 'duplicate_only')
    ),
    'eligibleAtStrictThreshold', count(*) filter (
      where s.attendance_evidence = 'detected' and s.attendance_confidence >= 0.99
    ),
    'eligibleAtAssumedThreshold', count(*) filter (
      where s.attendance_evidence in ('detected', 'assumed')
        and s.attendance_confidence >= 0.90
    ),
    'classifierVersions', coalesce(
      jsonb_agg(distinct s.submission_classifier_version)
        filter (where s.submission_classifier_version is not null),
      '[]'::jsonb
    )
  )
  into v_result
  from public.moodle_grade_snapshots s;

  return v_result;
end;
$$;

revoke all on function public.get_moodle_submission_evidence_health_v1()
  from public, anon;
grant execute on function public.get_moodle_submission_evidence_health_v1()
  to authenticated;

comment on function public.get_moodle_submission_evidence_health_v1() is
  'Agregado administrativo para evaluar el clasificador de adjuntos en modo sombra antes de automatizar acreditaciones.';

commit;
