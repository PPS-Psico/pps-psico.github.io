begin;

-- Some legacy practices have the correct institution and both cohort dates, but
-- their orientation disagrees with the launch row. The two exact boundaries are
-- stronger evidence than that inconsistent orientation field. Only unique
-- launch candidates are accepted and every repair remains privately audited.
create temporary table exact_date_moodle_practice_repairs on commit drop as
with candidates as (
  select p.id as practice_id, min(l.id::text)::uuid as lanzamiento_id
  from public.practicas p
  join public.lanzamientos_pps l
    on lower(regexp_replace(trim(replace(l.nombre_pps, chr(160), ' ')), '[[:space:]]+', ' ', 'g')) =
       lower(regexp_replace(trim(replace(p.nombre_institucion, chr(160), ' ')), '[[:space:]]+', ' ', 'g'))
   and left(l.fecha_inicio, 10) is not distinct from left(p.fecha_inicio, 10)
   and left(l.fecha_finalizacion, 10) is not distinct from left(p.fecha_finalizacion, 10)
  where p.lanzamiento_id is null
    and p.tipo_actividad = 'pps'
    and l.tipo_actividad = 'pps'
    and p.fecha_inicio is not null
    and p.fecha_finalizacion is not null
  group by p.id
  having count(distinct l.id) = 1
)
select * from candidates;

insert into private.moodle_practice_link_repair_audit (
  practice_id,
  previous_lanzamiento_id,
  repaired_lanzamiento_id,
  evidence_sources
)
select p.id,
       p.lanzamiento_id,
       r.lanzamiento_id,
       array['institution_name_and_both_exact_dates']::text[]
from public.practicas p
join exact_date_moodle_practice_repairs r on r.practice_id = p.id
where p.lanzamiento_id is null
on conflict (practice_id) do nothing;

update public.practicas p
set lanzamiento_id = r.lanzamiento_id
from exact_date_moodle_practice_repairs r
where p.id = r.practice_id
  and p.lanzamiento_id is null;

-- Complete the annual task map for the repaired cohorts and one already-linked
-- Municipalidad cohort that had no task row. Natural launch attributes identify
-- the target; no generated launch UUID is embedded in the migration.
with seed (
  launch_name,
  launch_start,
  launch_end,
  orientation_key,
  moodle_id,
  rationale
) as (
  values
    ('Colegio Psicólogos CPAVZO', '2025-04-10', '2025-08-10', 'clinica', '908739',
      'Tarea clínica anual CPAVZO 2025, corroborada en el catálogo y libro de calificaciones.'),
    ('Colegio Psicólogos CPAVZO', '2025-04-10', '2025-08-10', 'laboral', '817710',
      'Tarea laboral/comunitaria anual CPAVZO 2025, corroborada en el catálogo y libro de calificaciones.'),
    ('Colegio Psicólogos CPAVZO', '2025-08-11', '2025-12-12', 'clinica', '908739',
      'Tarea clínica anual CPAVZO 2025, reutilizada por la segunda cohorte.'),
    ('Colegio Psicólogos CPAVZO', '2025-08-11', '2025-12-12', 'laboral', '817710',
      'Tarea laboral/comunitaria anual CPAVZO 2025, reutilizada por la segunda cohorte.'),
    ('Ministerio de Trabajo y Desarrollo Laboral', '2025-08-12', '2025-12-12', 'laboral', '805659',
      'Tarea laboral anual Ministerio de Trabajo 2025, corroborada en el catálogo y libro de calificaciones.'),
    ('Municipalidad de General Fernandez Oro', '2025-09-03', null, 'laboral', '769021',
      'Tarea laboral anual Municipalidad de Fernández Oro 2025, reutilizada por la cohorte.')
), resolved as (
  select l.id as lanzamiento_id,
         s.orientation_key,
         a.id as aula_entrega_id,
         s.rationale
  from seed s
  join public.lanzamientos_pps l
    on translate(lower(replace(l.nombre_pps, chr(160), ' ')), 'áéíóúüñ', 'aeiouun') =
       translate(lower(replace(s.launch_name, chr(160), ' ')), 'áéíóúüñ', 'aeiouun')
   and left(l.fecha_inicio, 10) = s.launch_start
   and left(l.fecha_finalizacion, 10) is not distinct from s.launch_end
  join public.aula_entregas a
    on a.course_id = 3615
   and a.moodle_id = s.moodle_id
)
insert into public.lanzamiento_moodle_tareas (
  lanzamiento_id,
  orientacion_key,
  aula_entrega_id,
  validation_status,
  link_source,
  rationale,
  validated_at
)
select lanzamiento_id,
       orientation_key,
       aula_entrega_id,
       'confirmed',
       'catalog_exact',
       rationale,
       statement_timestamp()
from resolved
on conflict (lanzamiento_id, orientacion_key) do update
set aula_entrega_id = excluded.aula_entrega_id,
    validation_status = 'confirmed',
    link_source = excluded.link_source,
    rationale = excluded.rationale,
    validated_at = excluded.validated_at,
    updated_at = statement_timestamp();

-- A small set of imported practices predates or bypassed the launch relation.
-- Keep these exceptions explicit instead of attaching them to an unrelated
-- launch merely to make the UI work.
create table if not exists public.practica_moodle_tareas (
  id bigint generated always as identity primary key,
  practica_id uuid not null unique references public.practicas(id) on delete cascade,
  aula_entrega_id bigint not null references public.aula_entregas(id) on delete restrict,
  validation_status text not null default 'review'
    check (validation_status in ('confirmed', 'review', 'rejected')),
  link_source text not null
    check (link_source in ('legacy_orphan', 'manual')),
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null
);

comment on table public.practica_moodle_tareas is
  'Excepciones canónicas práctica→tarea Moodle para registros legacy que no poseen un lanzamiento confiable.';
comment on column public.practica_moodle_tareas.validation_status is
  'Sólo confirmed puede alimentar lecturas automáticas de entrega o calificación.';

alter table public.practica_moodle_tareas enable row level security;

create policy "Student read own practica moodle tarea"
  on public.practica_moodle_tareas
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.practicas p
      join public.estudiantes e on e.id = p.estudiante_id
      where p.id = practica_moodle_tareas.practica_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "Admin insert practica moodle tarea"
  on public.practica_moodle_tareas
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admin update practica moodle tarea"
  on public.practica_moodle_tareas
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin delete practica moodle tarea"
  on public.practica_moodle_tareas
  for delete to authenticated
  using ((select public.is_admin()));

with override_candidates as (
  select
    p.id as practica_id,
    case
      when coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2024'
        and p.nombre_institucion ilike '%SENSUS%' then '614156'
      when coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2024'
        and p.nombre_institucion ilike '%San Rafael%' then '614156'
      when coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2025'
        and p.nombre_institucion ilike '%Ulloa%Ateneos%' then '926287'
      when coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2025'
        and p.nombre_institucion ilike '%Alma Comahue%' then '918630'
      when coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2025'
        and (p.nombre_institucion ilike '%CRYBE%'
          or p.nombre_institucion ilike '%Bienestar Emocional%') then '818025'
      when coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2026'
        and p.nombre_institucion ilike '%Randstad%' then '1085736'
      else null
    end as moodle_id,
    case
      when p.nombre_institucion ilike '%Ulloa%Ateneos%'
        then 'Tarea institucional Ateneos Ulloa 2025; el registro importado no identifica una cohorte única.'
      when p.nombre_institucion ilike '%Randstad%'
        then 'Tarea institucional Randstad 2026; práctica de prueba sin lanzamiento histórico compatible.'
      when coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2024'
        then 'Tarea clínica general 2024 para práctica histórica sin lanzamiento compatible.'
      else 'Tarea institucional anual inequívoca para práctica legacy sin lanzamiento compatible.'
    end as rationale
  from public.practicas p
  where p.tipo_actividad = 'pps'
    and p.lanzamiento_id is null
), resolved_overrides as (
  select c.practica_id, a.id as aula_entrega_id, c.rationale
  from override_candidates c
  join public.aula_entregas a
    on a.course_id = 3615
   and a.moodle_id = c.moodle_id
  where c.moodle_id is not null
)
insert into public.practica_moodle_tareas (
  practica_id,
  aula_entrega_id,
  validation_status,
  link_source,
  rationale,
  validated_at
)
select practica_id,
       aula_entrega_id,
       'confirmed',
       'legacy_orphan',
       rationale,
       statement_timestamp()
from resolved_overrides
on conflict (practica_id) do update
set aula_entrega_id = excluded.aula_entrega_id,
    validation_status = 'confirmed',
    link_source = excluded.link_source,
    rationale = excluded.rationale,
    validated_at = excluded.validated_at,
    updated_at = statement_timestamp();

commit;
