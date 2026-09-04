begin;

-- Un informe entregado en Campus se pierde cuando el alumno entrega en una tarea
-- de su institución que no es exactamente la que su práctica tiene vinculada.
-- Caso que lo destapó: legajo 35793, PPS "Institución Fernando Ulloa - Ateneos".
-- Entregó en "Entrevistas Ulloa" (cmid 920727); su práctica apunta a "Ateneos
-- Ulloa" (cmid 926287). El barrido vio la fila, matcheó el DNI, y la descartó
-- como `task_mismatch` porque el cmid no coincidía. El alumno ve la nota en el
-- boletín y el panel le dice "sin entrega".
--
-- POR QUÉ PASA
--
-- El modelo asume una tarea de Moodle por (institución, año, área). La realidad
-- del curso es que una institución tiene varias tareas a la vez y a lo largo de
-- los años: Ateneos + Entrevistas de Admisión, Barriletes en Bandada +
-- Asociación Civil Pensar, Kano clínica + Kano laboral. Mientras la práctica
-- apunte a un cmid en vez de a un conjunto, el mismatch es inevitable: no es un
-- bug, es el modelo funcionando como está escrito.
--
-- Tampoco alcanza con agrupar por `lanzamientos_pps.institucion_id`: esa tabla
-- guarda programas, no instituciones ("Fernando Ulloa - Ateneos" y "Fernando
-- Ulloa - Entrevistas de Admisión" son filas distintas), y está null en el 40%
-- de los lanzamientos. Medido sobre producción: agrupar por institucion_id
-- resuelve 42 de 107 casos abiertos; agrupar por la institución real resuelve 96.
--
-- QUÉ HACE ESTA MIGRACIÓN
--
-- Introduce la unidad de entrega: la institución real, con N tareas de Moodle y
-- N lanzamientos colgando. La atribución pasa a aceptar una entrega en
-- cualquier tarea de la unidad, no sólo en el cmid vinculado.
--
-- El sembrado deriva la unidad del prefijo del nombre del lanzamiento (lo que va
-- antes del primer " - "), que es donde vive la identidad institucional real. El
-- prefijo es herramienta de sembrado, no el modelo: escribe una FK y no vuelve a
-- correr. De acá en más las correcciones son updates que el sistema conserva, no
-- heurística que se recalcula.
--
-- LÍMITES CONOCIDOS, QUE SE RESUELVEN A MANO
--
-- * Los lanzamientos "UFLO - ..." quedan sin unidad a propósito: el prefijo
--   fusionaría 5 instituciones distintas (SAU, Investigación, Entrevista a
--   Profesionales). Se asignan a mano.
-- * Cuatro pares de claves son la misma institución escrita distinto y se
--   delatan porque comparten un cmid. Se fusionan a mano.
-- * Tres tareas cajón de sastre de 2024 (614155, 614156, 614159) pertenecen a
--   8-10 unidades cada una: ahí la unidad no informa nada. Se marcan
--   `compartida` y quedan excluidas de la atribución por unidad.

-- ----------------------------------------------------------------- 1. Modelo

create table if not exists public.unidades_entrega (
  id         bigserial primary key,
  clave      text not null unique,
  nombre     text not null,
  nota       text,
  created_at timestamptz not null default now()
);

-- N a N a propósito: un cmid puede servir a varias unidades (cajones de sastre).
create table if not exists public.unidad_entrega_tareas (
  unidad_id       bigint not null references public.unidades_entrega(id) on delete cascade,
  aula_entrega_id bigint not null references public.aula_entregas(id) on delete cascade,
  compartida      boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (unidad_id, aula_entrega_id)
);

create index if not exists unidad_entrega_tareas_aula_idx
  on public.unidad_entrega_tareas (aula_entrega_id);

alter table public.lanzamientos_pps
  add column if not exists unidad_id bigint references public.unidades_entrega(id);

create index if not exists lanzamientos_pps_unidad_idx
  on public.lanzamientos_pps (unidad_id);

alter table public.unidades_entrega      enable row level security;
alter table public.unidad_entrega_tareas enable row level security;

drop policy if exists "unidades_entrega_read_all" on public.unidades_entrega;
create policy "unidades_entrega_read_all" on public.unidades_entrega
  for select to authenticated, anon using (true);

drop policy if exists "Admin write unidades_entrega" on public.unidades_entrega;
create policy "Admin write unidades_entrega" on public.unidades_entrega
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "unidad_entrega_tareas_read_all" on public.unidad_entrega_tareas;
create policy "unidad_entrega_tareas_read_all" on public.unidad_entrega_tareas
  for select to authenticated, anon using (true);

drop policy if exists "Admin write unidad_entrega_tareas" on public.unidad_entrega_tareas;
create policy "Admin write unidad_entrega_tareas" on public.unidad_entrega_tareas
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.unidades_entrega, public.unidad_entrega_tareas to anon, authenticated;
grant all    on public.unidades_entrega, public.unidad_entrega_tareas to service_role;
grant usage, select on sequence public.unidades_entrega_id_seq to service_role;

-- --------------------------------------------------------------- 2. Sembrado

with derivadas as (
  select
    lower(trim(split_part(lp.nombre_pps, ' - ', 1))) as clave,
    min(trim(split_part(lp.nombre_pps, ' - ', 1)))   as nombre
  from public.lanzamientos_pps lp
  where nullif(trim(lp.nombre_pps), '') is not null
    and lower(trim(split_part(lp.nombre_pps, ' - ', 1))) <> 'uflo'
  group by 1
)
insert into public.unidades_entrega (clave, nombre)
select d.clave, d.nombre from derivadas d
on conflict (clave) do nothing;

update public.lanzamientos_pps lp
set unidad_id = u.id
from public.unidades_entrega u
where u.clave = lower(trim(split_part(lp.nombre_pps, ' - ', 1)))
  and lower(trim(split_part(lp.nombre_pps, ' - ', 1))) <> 'uflo'
  and lp.unidad_id is distinct from u.id;

-- Las tareas de la unidad salen sólo de los vínculos de lanzamiento. Los
-- vínculos de práctica (`practica_moodle_tareas`) son overrides por alumno y no
-- definen a la institución, así que no siembran la unidad.
insert into public.unidad_entrega_tareas (unidad_id, aula_entrega_id)
select distinct lp.unidad_id, lmt.aula_entrega_id
from public.lanzamientos_pps lp
join public.lanzamiento_moodle_tareas lmt
  on lmt.lanzamiento_id = lp.id
 and lmt.validation_status = 'confirmed'
where lp.unidad_id is not null
on conflict (unidad_id, aula_entrega_id) do nothing;

update public.unidad_entrega_tareas t
set compartida = true
where t.aula_entrega_id in (
  select aula_entrega_id
  from public.unidad_entrega_tareas
  group by aula_entrega_id
  having count(distinct unidad_id) > 1
);

-- --------------------------------------------------- 3. Atribución por unidad

-- El cuerpo de `sync_jefe_moodle_reports_scoped_v1_impl` son ~25 KB acumulados
-- por ocho migraciones. Transcribirlo entero para insertar dos CTEs es la vía
-- más propensa a error, así que se parchea sobre la definición viva con un ancla
-- exacta. Si el ancla no está (porque otra migración tocó la función), la
-- migración aborta en vez de aplicar un parche a ciegas.
--
-- El parche es puramente aditivo: `unit_candidates` sólo genera candidatos para
-- pares (cmid, DNI) que hoy tienen cero, y `unit_candidates_unique` los descarta
-- si el alumno tiene más de una práctica en la misma unidad. Ninguna atribución
-- que hoy funciona puede cambiar de resultado; los casos ambiguos siguen cayendo
-- en el diagnóstico en vez de resolverse a la suerte.
do $patch$
declare
  v_sig text := 'private.sync_jefe_moodle_reports_scoped_v1_impl(uuid,uuid,bigint,integer,timestamp with time zone,bigint,text,jsonb)';
  v_def text;
  v_new text;
  v_anchor text := E'  ), candidates as (\n    select * from direct_candidates\n    union\n    select * from launch_candidates\n  ), candidate_pool as (';
begin
  v_def := pg_get_functiondef(v_sig::regprocedure);

  if position('unit_candidates' in v_def) > 0 then
    raise notice 'atribucion por unidad ya aplicada, se omite';
    return;
  end if;

  if position(v_anchor in v_def) = 0 then
    raise exception 'ancla de candidates no encontrada en %; revisar migraciones posteriores', v_sig;
  end if;

  v_new := replace(v_def, v_anchor, $repl$  ), base_candidates as (
    select * from direct_candidates
    union
    select * from launch_candidates
  ), unit_candidates as (
    select distinct
      ps.practica_id,
      ps.estudiante_id,
      ps.lanzamiento_id,
      ps.student_dni,
      ps.es_online,
      ae.id as aula_entrega_id,
      ae.moodle_id::bigint as cmid,
      ae.moodle_grade_max,
      ae.grade_conversion_mode
    from practice_scope ps
    join public.lanzamientos_pps lp
      on lp.id = ps.lanzamiento_id
     and lp.unidad_id is not null
    join public.unidad_entrega_tareas uet
      on uet.unidad_id = lp.unidad_id
     and uet.compartida = false
    join public.aula_entregas ae
      on ae.id = uet.aula_entrega_id
     and (ae.academic_year = p_academic_year or ae.moodle_id::bigint in (
        select allowed_scope.cmid
        from private.get_jefe_moodle_sync_tasks_for_areas_v1(v_areas) allowed_scope
      ))
     and ae.course_id = p_course_id
     and ae.moodle_id ~ '^\d+$'
    where not exists (
      select 1
      from base_candidates bc
      where bc.student_dni = ps.student_dni
        and bc.cmid = ae.moodle_id::bigint
    )
  ), unit_candidates_unique as (
    select uc.*
    from unit_candidates uc
    where 1 = (
      select count(distinct u2.practica_id)
      from unit_candidates u2
      where u2.student_dni = uc.student_dni
        and u2.cmid = uc.cmid
    )
  ), candidates as (
    select * from base_candidates
    union
    select * from unit_candidates_unique
  ), candidate_pool as ($repl$);

  if v_new = v_def then
    raise exception 'el parche de atribucion por unidad no modifico nada';
  end if;

  execute v_new;
end
$patch$;

commit;
