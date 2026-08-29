begin;

-- Las vinculaciones inferidas desde una fila realmente observada por Jefatura
-- quedan diferenciadas de las excepciones legacy y de las decisiones manuales.
alter table public.practica_moodle_tareas
  drop constraint practica_moodle_tareas_link_source_check;

alter table public.practica_moodle_tareas
  add constraint practica_moodle_tareas_link_source_check
  check (link_source in ('legacy_orphan', 'manual', 'jefe_observed')) not valid;

alter table public.practica_moodle_tareas
  validate constraint practica_moodle_tareas_link_source_check;

alter table private.moodle_jefe_unmatched_diagnostics
  add column if not exists resolution_status text not null default 'pending',
  add column if not exists resolved_practica_id uuid
    references public.practicas(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_evidence jsonb not null default '{}'::jsonb;

alter table private.moodle_jefe_unmatched_diagnostics
  add constraint moodle_jefe_unmatched_resolution_status_check
  check (
    resolution_status in (
      'pending',
      'auto_linked',
      'ignored_no_area_practice',
      'needs_review'
    )
  ) not valid;

alter table private.moodle_jefe_unmatched_diagnostics
  validate constraint moodle_jefe_unmatched_resolution_status_check;

alter table private.moodle_jefe_unmatched_diagnostics
  add constraint moodle_jefe_unmatched_resolution_evidence_check
  check (jsonb_typeof(resolution_evidence) = 'object') not valid;

alter table private.moodle_jefe_unmatched_diagnostics
  validate constraint moodle_jefe_unmatched_resolution_evidence_check;

create index if not exists moodle_jefe_unmatched_resolved_practice_idx
  on private.moodle_jefe_unmatched_diagnostics (resolved_practica_id)
  where resolved_practica_id is not null;

comment on column private.moodle_jefe_unmatched_diagnostics.resolution_status is
  'Resultado de la auditoría: vínculo seguro, fila no aplicable o revisión humana.';
comment on column private.moodle_jefe_unmatched_diagnostics.resolution_evidence is
  'Evidencia técnica sin PII que justifica la resolución conservadora.';

-- Resuelve sólo vínculos de alta confianza. No importa notas ni cambia estados
-- de acreditación: una lectura posterior de Moodle vuelve a validar la fila
-- completa antes de crear una observación.
create or replace function private.resolve_safe_jefe_moodle_links_v1(
  p_since timestamptz default now() - interval '24 hours'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_links_inserted integer := 0;
  v_diagnostics_linked integer := 0;
  v_diagnostics_ignored integer := 0;
  v_diagnostics_review integer := 0;
begin
  if p_since is null then
    raise exception 'since is required' using errcode = '22023';
  end if;

  with latest_diagnostics as (
    select distinct on (d.estudiante_id, d.cmid)
      d.id as diagnostic_id,
      d.estudiante_id,
      d.cmid,
      d.course_id,
      d.academic_year,
      d.area_keys,
      d.practice_count,
      d.linked_task_count
    from private.moodle_jefe_unmatched_diagnostics d
    where d.observed_at >= p_since
      and d.resolution_status = 'pending'
      and d.reason = 'practice_without_confirmed_task_link'
    order by d.estudiante_id, d.cmid, d.observed_at desc, d.id desc
  ), task_catalog as (
    select
      d.*,
      ae.id as aula_entrega_id,
      ae.area as task_area,
      ae.institucion as task_institution,
      coalesce(ae.academic_year::integer, d.academic_year) as task_year
    from latest_diagnostics d
    join public.aula_entregas ae
      on ae.course_id = d.course_id
     and nullif(
       regexp_replace(coalesce(ae.moodle_id, ''), '\D', '', 'g'),
       ''
     )::bigint = d.cmid
    where private.moodle_orientation_key(ae.area) = any (d.area_keys)
      and d.practice_count = 1
      and d.linked_task_count = 0
  ), eligible_candidates as (
    select
      t.*,
      p.id as practica_id,
      greatest(
        public.similarity(
          translate(lower(coalesce(t.task_institution, '')), 'áéíóúüñ', 'aeiouun'),
          translate(lower(coalesce(p.nombre_institucion, '')), 'áéíóúüñ', 'aeiouun')
        ),
        public.word_similarity(
          translate(lower(coalesce(t.task_institution, '')), 'áéíóúüñ', 'aeiouun'),
          translate(lower(coalesce(p.nombre_institucion, '')), 'áéíóúüñ', 'aeiouun')
        ),
        public.word_similarity(
          translate(lower(coalesce(p.nombre_institucion, '')), 'áéíóúüñ', 'aeiouun'),
          translate(lower(coalesce(t.task_institution, '')), 'áéíóúüñ', 'aeiouun')
        )
      ) as institution_score,
      count(*) over (partition by t.diagnostic_id) as candidate_count
    from task_catalog t
    join public.practicas p
      on p.estudiante_id = t.estudiante_id
     and private.moodle_orientation_key(p.especialidad)
       = private.moodle_orientation_key(t.task_area)
     and t.task_year between
       nullif(
         substring(coalesce(p.fecha_inicio, '') from '(20[0-9]{2})'),
         ''
       )::integer
       and coalesce(
         nullif(
           substring(coalesce(p.fecha_finalizacion, '') from '(20[0-9]{2})'),
           ''
         )::integer,
         nullif(
           substring(coalesce(p.fecha_inicio, '') from '(20[0-9]{2})'),
           ''
         )::integer
       )
    where translate(
      lower(trim(coalesce(p.estado, ''))),
      'áéíóúüñ',
      'aeiouun'
    ) = 'finalizada'
      and coalesce(p.informe_estado, '') <> 'calificado'
      and not exists (
        select 1
        from public.practica_moodle_tareas existing_link
        where existing_link.practica_id = p.id
      )
  ), safe_candidates as (
    select candidate.*
    from eligible_candidates candidate
    where candidate.candidate_count = 1
      and candidate.institution_score >= 0.75
  )
  insert into public.practica_moodle_tareas (
    practica_id,
    aula_entrega_id,
    validation_status,
    link_source,
    rationale,
    validated_at
  )
  select
    candidate.practica_id,
    candidate.aula_entrega_id,
    'confirmed',
    'jefe_observed',
    'jefe-unmatched-repair/v1: tarea observada, institución única, misma orientación y período compatible',
    statement_timestamp()
  from safe_candidates candidate
  on conflict (practica_id) do nothing;

  get diagnostics v_links_inserted = row_count;

  with resolved_links as (
    select
      pmt.practica_id,
      p.estudiante_id,
      ae.course_id,
      nullif(
        regexp_replace(coalesce(ae.moodle_id, ''), '\D', '', 'g'),
        ''
      )::bigint as cmid
    from public.practica_moodle_tareas pmt
    join public.practicas p on p.id = pmt.practica_id
    join public.aula_entregas ae on ae.id = pmt.aula_entrega_id
    where pmt.link_source = 'jefe_observed'
      and pmt.validation_status = 'confirmed'
  )
  update private.moodle_jefe_unmatched_diagnostics d
  set resolution_status = 'auto_linked',
      resolved_practica_id = resolved_link.practica_id,
      resolved_at = statement_timestamp(),
      resolution_evidence = jsonb_build_object(
        'ruleVersion', 'jefe-unmatched-repair/v1',
        'cmid', d.cmid,
        'criteria', jsonb_build_array(
          'observed_assignment',
          'single_practice',
          'institution_score_gte_0_75',
          'same_orientation',
          'compatible_period',
          'no_existing_direct_link'
        )
      )
  from resolved_links resolved_link
  where d.observed_at >= p_since
    and d.resolution_status = 'pending'
    and resolved_link.estudiante_id = d.estudiante_id
    and resolved_link.course_id = d.course_id
    and resolved_link.cmid = d.cmid;

  get diagnostics v_diagnostics_linked = row_count;

  update private.moodle_jefe_unmatched_diagnostics d
  set resolution_status = 'ignored_no_area_practice',
      resolved_at = statement_timestamp(),
      resolution_evidence = jsonb_build_object(
        'ruleVersion', 'jefe-unmatched-repair/v1',
        'reason', 'no_practice_in_scanned_area'
      )
  where d.observed_at >= p_since
    and d.resolution_status = 'pending'
    and d.reason = 'no_practice_in_area';

  get diagnostics v_diagnostics_ignored = row_count;

  update private.moodle_jefe_unmatched_diagnostics d
  set resolution_status = 'needs_review',
      resolution_evidence = jsonb_build_object(
        'ruleVersion', 'jefe-unmatched-repair/v1',
        'reason', d.reason
      )
  where d.observed_at >= p_since
    and d.resolution_status = 'pending';

  get diagnostics v_diagnostics_review = row_count;

  return jsonb_build_object(
    'ruleVersion', 'jefe-unmatched-repair/v1',
    'linksInserted', v_links_inserted,
    'diagnosticsLinked', v_diagnostics_linked,
    'diagnosticsIgnored', v_diagnostics_ignored,
    'diagnosticsNeedingReview', v_diagnostics_review
  );
end;
$$;

revoke all on function private.resolve_safe_jefe_moodle_links_v1(timestamptz)
  from public, anon, authenticated;
grant execute on function private.resolve_safe_jefe_moodle_links_v1(timestamptz)
  to service_role;

comment on function private.resolve_safe_jefe_moodle_links_v1(timestamptz) is
  'Vincula sólo diagnósticos Moodle inequívocos; clasifica el resto sin importar notas ni iniciar acreditaciones.';

-- Backfill controlado sobre las corridas recién auditadas. La función es
-- idempotente: los vínculos existentes y los diagnósticos resueltos se omiten.
select private.resolve_safe_jefe_moodle_links_v1(now() - interval '24 hours');

commit;
