-- Limpieza operativa 2024 posterior a la reconstrucción documental.
--
-- Decisiones de dominio confirmadas por coordinación el 2026-07-17:
-- - M-PBI fue una PPS docente realizada externamente en el Centro de
--   Psicoterapia Corporal PATAGONIA por el requisito de institución con convenio.
-- - Barriletes podía acreditar Clínica o Comunitaria según la actividad concreta;
--   no se normaliza la especialidad de las prácticas a una única orientación.
-- - SAU e Investigación fueron modalidades históricas internas de UFLO luego
--   discontinuadas; se preservan como excepciones legacy, no como modelo vigente.
--
-- Coordinación confirmó el 2026-07-17 que el valor académico definitivo de
-- Fútbol Valorado es 20 h. Se conserva en las 33 prácticas pese a que una
-- comunicación intermedia del chat mencionaba 10 h.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table
  public.instituciones,
  public.lanzamientos_pps,
  public.practicas,
  public.agent_suggestions,
  public.convenios,
  public.gmail_hilos,
  public.institucion_resumen,
  public.solicitudes_nueva_pps,
  public.whatsapp_contactos,
  public.whatsapp_mensajes
in share row exclusive mode;

do $$
declare
  v_unmatched_practices integer;
  v_review_offers integer;
  v_duplicate_institutions integer;
  v_existing_reconstructions integer;
begin
  select count(*)::integer
    into v_unmatched_practices
  from public.practicas
  where tipo_actividad = 'pps'
    and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'
    and lanzamiento_id is null;

  select count(*)::integer
    into v_review_offers
  from private.historical_launch_offers
  where source_year = 2024
    and review_status = 'needs_review';

  select count(*)::integer
    into v_duplicate_institutions
  from public.instituciones
  where nombre in (
    'UFLO - Entrevista a Profesionales',
    'UFLO - SAU',
    'UFLO - PPS Investigación'
  );

  select count(*)::integer
    into v_existing_reconstructions
  from public.lanzamientos_pps
  where notas_gestion like '%[reconstruccion_2024:%';

  if v_unmatched_practices <> 44 then
    raise exception
      'Limpieza 2024 abortada: se esperaban 44 prácticas sin lanzamiento y se obtuvieron %',
      v_unmatched_practices;
  end if;

  if v_review_offers <> 20 then
    raise exception
      'Limpieza 2024 abortada: se esperaban 20 ofertas en revisión y se obtuvieron %',
      v_review_offers;
  end if;

  if v_duplicate_institutions <> 8 then
    raise exception
      'Limpieza 2024 abortada: se esperaban 8 filas en los tres grupos UFLO duplicados y se obtuvieron %',
      v_duplicate_institutions;
  end if;

  if v_existing_reconstructions <> 0 then
    raise exception
      'Limpieza 2024 abortada: ya existen % lanzamientos marcados como reconstruidos',
      v_existing_reconstructions;
  end if;
end;
$$;

-- Las ocho filas duplicadas están completamente vacías de referencias. La
-- aserción cubre también columnas institucion_id legacy que no tienen FK.
create temporary table cleanup_2024_institution_dedup
on commit drop
as
select
  id as duplicate_id,
  first_value(id) over (partition by nombre order by id::text) as canonical_id,
  nombre
from public.instituciones
where nombre in (
  'UFLO - Entrevista a Profesionales',
  'UFLO - SAU',
  'UFLO - PPS Investigación'
);

alter table cleanup_2024_institution_dedup
  add primary key (duplicate_id);

do $$
declare
  v_references integer;
begin
  select coalesce(sum(
    (select count(*) from public.agent_suggestions x where x.institucion_id = d.duplicate_id) +
    (select count(*) from public.convenios x where x.institucion_id = d.duplicate_id) +
    (select count(*) from public.gmail_hilos x where x.institucion_id = d.duplicate_id) +
    (select count(*) from public.institucion_resumen x where x.institucion_id = d.duplicate_id) +
    (select count(*) from public.lanzamientos_pps x where x.institucion_id = d.duplicate_id::text) +
    (select count(*) from public.solicitudes_nueva_pps x where x.institucion_id = d.duplicate_id) +
    (select count(*) from public.whatsapp_contactos x where x.institucion_id = d.duplicate_id) +
    (select count(*) from public.whatsapp_mensajes x where x.institucion_id = d.duplicate_id)
  ), 0)::integer
    into v_references
  from cleanup_2024_institution_dedup as d
  where d.duplicate_id <> d.canonical_id;

  if v_references <> 0 then
    raise exception
      'Limpieza 2024 abortada: las instituciones duplicadas a eliminar tienen % referencias',
      v_references;
  end if;
end;
$$;

delete from public.instituciones as i
using cleanup_2024_institution_dedup as d
where i.id = d.duplicate_id
  and d.duplicate_id <> d.canonical_id;

insert into public.instituciones (nombre, orientaciones, direccion)
select v.nombre, v.orientaciones, v.direccion
from (
  values
    ('Centro de Salud Progreso'::text, null::text, null::text),
    ('Colegio Secundario Virgen del Luján'::text, 'Educacional'::text, 'República de Chile N°520, Centenario'::text)
) as v(nombre, orientaciones, direccion)
where not exists (
  select 1
  from public.instituciones as i
  where i.nombre = v.nombre
);

do $$
declare
  v_bad_names integer;
begin
  select count(*)::integer
    into v_bad_names
  from (
    select expected.nombre
    from (
      values
        ('UFLO - Entrevista a Profesionales'::text),
        ('UFLO - SAU'::text),
        ('UFLO - PPS Investigación'::text),
        ('Centro de Salud Progreso'::text),
        ('Colegio Secundario Virgen del Luján'::text),
        ('Centro Salud Parque Industrial'::text),
        ('Asociación Civil Pensar - AYUN'::text),
        ('Centro de Psicoterapia Corporal PATAGONIA - Mindfulness'::text),
        ('UFLO - Adultos mayores y Sexualidad'::text),
        ('UFLO - PPS Investigación- Relaciones de Pareja y sexualidad'::text)
    ) as expected(nombre)
    left join public.instituciones as i on i.nombre = expected.nombre
    group by expected.nombre
    having count(i.id) <> 1
  ) as invalid;

  if v_bad_names <> 0 then
    raise exception
      'Limpieza 2024 abortada: % nombres institucionales no quedaron unívocos',
      v_bad_names;
  end if;
end;
$$;

-- Nueve ofertas documentadas sin fila legacy y dos realizaciones internas sin
-- anuncio disponible. Todas quedan ocultas; ninguna reaparece como convocatoria.
with launch_seed (
  resolution_key,
  institution_name,
  launch_name,
  start_date,
  end_date,
  orientation,
  credited_hours,
  capacity,
  capacity_mode,
  publication_date,
  relaunch_date,
  address,
  resolution_note
) as (
  values
    (
      'WA24-001'::text,
      'Centro de Salud Progreso'::text,
      'Centro de Salud Progreso'::text,
      '2024-03-01'::text,
      null::text,
      'No informada'::text,
      120::numeric,
      2::numeric,
      'fijo'::text,
      '2024-02-15'::text,
      null::text,
      null::text,
      'Fuente WhatsApp líneas 535-543. Oferta confirmada; no se observaron prácticas.'::text
    ),
    (
      'WA24-002',
      'Centro Salud Parque Industrial',
      'Centro Salud Parque Industrial — primer período 2024',
      '2024-03-12',
      '2024-11-30',
      'Clínica',
      85,
      9,
      'fijo',
      '2024-03-02',
      null,
      null,
      'Fuente WhatsApp líneas 545-550 y recordatorio línea 571; ocho prácticas observadas.'
    ),
    (
      'WA24-007',
      'UFLO - Adultos mayores y Sexualidad',
      'UFLO - Investigación Relaciones de Pareja y Sexualidad en Adultos Mayores',
      '2024-04-06',
      '2024-06-29',
      'Clínica',
      30,
      4,
      'fijo',
      '2024-03-14',
      null,
      null,
      'Fuente WhatsApp líneas 583-589; una práctica específica observada.'
    ),
    (
      'WA24-011',
      'UFLO - Entrevista a Profesionales',
      'UFLO - Entrevista a Profesionales — convocatoria continua 2024',
      '2024-04-04',
      '2024-12-31',
      'Mixta',
      20,
      12,
      'realizado',
      '2024-04-04',
      null,
      null,
      'Fuente WhatsApp líneas 644-650; capacidad realizada igual a doce prácticas observadas.'
    ),
    (
      'WA24-012',
      'UFLO - SAU',
      'UFLO - SAU/PAOS — primer período legacy 2024',
      '2024-04-06',
      '2024-07-31',
      'Educacional',
      null,
      5,
      'fijo',
      '2024-04-08',
      null,
      null,
      'Fuente WhatsApp líneas 656-668. Modalidad interna histórica luego discontinuada al normalizar el requisito de institución externa.'
    ),
    (
      'WA24-015',
      'Asociación Civil Pensar - AYUN',
      'Asociación PENSAR — Dispositivo AYUN',
      '2024-04-25',
      '2024-11-30',
      'Comunitaria',
      null,
      null,
      'realizado',
      '2024-04-25',
      null,
      null,
      'Fuente WhatsApp líneas 704-708. Capacidad y resultado no documentados.'
    ),
    (
      'WA24-018',
      'Centro de Psicoterapia Corporal PATAGONIA - Mindfulness',
      'Centro de Psicoterapia Corporal PATAGONIA — Mindfulness M-PBI',
      '2024-06-28',
      '2024-08-17',
      'Clínica',
      25,
      21,
      'fijo',
      '2024-05-27',
      null,
      null,
      'Confirmado por coordinación: PPS de una docente UFLO alojada externamente en Psicoterapia Corporal por el requisito de institución con convenio. No se inventan prácticas ausentes.'
    ),
    (
      'WA24-026',
      'UFLO - PPS Investigación- Relaciones de Pareja y sexualidad',
      'UFLO - PPS Investigación — Relaciones de Pareja y Sexualidad 50-70',
      '2024-08-24',
      '2024-11-09',
      'A elección',
      30,
      4,
      'fijo',
      '2024-08-05',
      null,
      null,
      'Fuente WhatsApp líneas 853-858; una práctica específica de 30 horas observada.'
    ),
    (
      'WA24-033',
      'Colegio Secundario Virgen del Luján',
      'Colegio Secundario Virgen del Luján',
      '2024-09-10',
      null,
      'Educacional',
      24,
      6,
      'fijo',
      '2024-08-27',
      '2024-09-06',
      'República de Chile N°520, Centenario',
      'Fuente WhatsApp líneas 960-988 y relanzamiento líneas 1071-1088. No se observaron prácticas.'
    ),
    (
      'DB24-SAU-02',
      'UFLO - SAU',
      'UFLO - SAU — segundo período legacy 2024',
      '2024-08-24',
      '2024-11-10',
      'Educacional',
      30,
      1,
      'realizado',
      null,
      null,
      null,
      'Excepción histórica reconstruida desde una práctica: modalidad interna UFLO luego discontinuada; sin anuncio 2024 disponible.'
    ),
    (
      'DB24-INV-02',
      'UFLO - PPS Investigación',
      'UFLO - PPS Investigación — registros agosto 2024',
      '2024-08-27',
      '2024-08-29',
      'Clínica',
      20,
      2,
      'realizado',
      null,
      null,
      null,
      'Excepción histórica reconstruida desde dos prácticas: Investigación se admitía como PPS y luego fue discontinuada; sin anuncio disponible.'
    )
)
insert into public.lanzamientos_pps (
  nombre_pps,
  fecha_inicio,
  fecha_finalizacion,
  direccion,
  orientacion,
  horas_acreditadas,
  cupos_disponibles,
  estado_convocatoria,
  estado_gestion,
  notas_gestion,
  fecha_relanzamiento,
  fecha_publicacion,
  institucion_id,
  tipo_actividad,
  modalidad_cupo,
  updated_at
)
select
  s.launch_name,
  s.start_date,
  s.end_date,
  s.address,
  s.orientation,
  s.credited_hours,
  s.capacity,
  'Oculto',
  'Archivado',
  '[reconstruccion_2024:' || s.resolution_key || '] ' || s.resolution_note,
  s.relaunch_date,
  s.publication_date,
  i.id::text,
  'pps',
  s.capacity_mode,
  statement_timestamp()
from launch_seed as s
join public.instituciones as i on i.nombre = s.institution_name
where not exists (
  select 1
  from public.lanzamientos_pps as existing
  where existing.notas_gestion like '%[reconstruccion_2024:' || s.resolution_key || ']%'
);

do $$
declare
  v_reconstructed integer;
begin
  select count(*)::integer
    into v_reconstructed
  from public.lanzamientos_pps
  where notas_gestion like '%[reconstruccion_2024:%';

  if v_reconstructed <> 11 then
    raise exception
      'Limpieza 2024 abortada: se esperaban 11 lanzamientos reconstruidos y se obtuvieron %',
      v_reconstructed;
  end if;
end;
$$;

-- Cada regla tiene un destino unívoco y un conteo esperado. San José usa la
-- fila legacy adicional del 16/09: la fila principal ya tiene sus ocho cupos.
create temporary table cleanup_2024_practice_links
on commit drop
as
select p.id as practica_id, l.id as lanzamiento_id, 'WA24-002'::text as resolution_key
from public.practicas p
join public.lanzamientos_pps l on l.notas_gestion like '%[reconstruccion_2024:WA24-002]%'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'Centro Salud Parque Industrial'
  and p.fecha_inicio = '2024-03-12'

union all

select p.id, l.id, 'WA24-027'
from public.practicas p
join public.lanzamientos_pps l
  on l.nombre_pps = 'Centro Salud Parque Industrial'
 and l.fecha_inicio = '2024-08-12'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'Centro Salud Parque Industrial'
  and p.fecha_inicio = '2024-08-14'
  and p.horas_realizadas = 30

union all

select p.id, l.id, 'WA24-011'
from public.practicas p
join public.lanzamientos_pps l on l.notas_gestion like '%[reconstruccion_2024:WA24-011]%'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'UFLO - Entrevista a Profesionales'
  and p.fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'

union all

select p.id, l.id, 'WA24-007'
from public.practicas p
join public.lanzamientos_pps l on l.notas_gestion like '%[reconstruccion_2024:WA24-007]%'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'UFLO - PPS Investigación'
  and p.fecha_inicio = '2024-04-06'
  and p.horas_realizadas = 30

union all

select p.id, l.id, 'WA24-026'
from public.practicas p
join public.lanzamientos_pps l on l.notas_gestion like '%[reconstruccion_2024:WA24-026]%'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'UFLO - PPS Investigación- Relaciones de Pareja y sexualidad'
  and p.fecha_inicio = '2024-08-24'
  and p.horas_realizadas = 30

union all

select p.id, l.id, 'WA24-012'
from public.practicas p
join public.lanzamientos_pps l on l.notas_gestion like '%[reconstruccion_2024:WA24-012]%'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'UFLO - SAU'
  and p.fecha_inicio in ('2024-04-06', '2024-04-19', '2024-05-01')

union all

select p.id, l.id, 'WA24-032'
from public.practicas p
join public.lanzamientos_pps l
  on l.nombre_pps = 'Asociación Civil Programa Aser'
 and l.fecha_inicio = '2024-09-02'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'Asociación Civil Programa Aser'
  and p.fecha_inicio = '2024-09-05'

union all

select p.id, l.id, 'WA24-034-REPLACEMENT'
from public.practicas p
join public.lanzamientos_pps l
  on l.nombre_pps = 'Colegio San José Obrero de Neuquén'
 and l.fecha_inicio = '2024-09-16'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'Colegio San José Obrero de Neuquén'
  and p.fecha_inicio = '2024-10-09'
  and p.horas_realizadas = 24

union all

select p.id, l.id, 'WA24-005-MARCH'
from public.practicas p
join public.lanzamientos_pps l
  on l.nombre_pps = 'Asociación Civil Pensar - Barriletes'
 and l.fecha_inicio = '2024-03-19'
 and l.orientacion = 'Comunitaria'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'Asociación Civil Pensar - Barriletes'
  and p.fecha_inicio = '2024-03-26'

union all

select p.id, l.id, 'WA24-005-JUNE'
from public.practicas p
join public.lanzamientos_pps l
  on l.nombre_pps = 'Asociación Civil Pensar - Barriletes'
 and l.fecha_inicio = '2024-05-21'
 and l.orientacion = 'Comunitaria'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'Asociación Civil Pensar - Barriletes'
  and p.fecha_inicio = '2024-06-06'

union all

select p.id, l.id, 'WA24-005-SEPTEMBER'
from public.practicas p
join public.lanzamientos_pps l
  on l.nombre_pps = 'Asociación Civil Pensar - Barriletes'
 and l.fecha_inicio = '2024-08-05'
 and l.orientacion = 'Clínica'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'Asociación Civil Pensar - Barriletes'
  and p.fecha_inicio = '2024-09-10'

union all

select p.id, l.id, 'DB24-SAU-02'
from public.practicas p
join public.lanzamientos_pps l on l.notas_gestion like '%[reconstruccion_2024:DB24-SAU-02]%'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'UFLO - SAU'
  and p.fecha_inicio = '2024-08-24'

union all

select p.id, l.id, 'DB24-INV-02'
from public.practicas p
join public.lanzamientos_pps l on l.notas_gestion like '%[reconstruccion_2024:DB24-INV-02]%'
where p.lanzamiento_id is null
  and p.nombre_institucion = 'UFLO - PPS Investigación'
  and p.fecha_inicio in ('2024-08-27', '2024-08-29')
  and p.horas_realizadas = 20;

alter table cleanup_2024_practice_links
  add primary key (practica_id);

do $$
declare
  v_links integer;
  v_bad_groups integer;
begin
  select count(*)::integer into v_links
  from cleanup_2024_practice_links;

  select count(*)::integer
    into v_bad_groups
  from (
    select expected.resolution_key
    from (
      values
        ('WA24-002'::text, 8),
        ('WA24-027', 1),
        ('WA24-011', 12),
        ('WA24-007', 1),
        ('WA24-026', 1),
        ('WA24-012', 5),
        ('WA24-032', 2),
        ('WA24-034-REPLACEMENT', 1),
        ('WA24-005-MARCH', 8),
        ('WA24-005-JUNE', 1),
        ('WA24-005-SEPTEMBER', 1),
        ('DB24-SAU-02', 1),
        ('DB24-INV-02', 2)
    ) as expected(resolution_key, expected_count)
    left join (
      select resolution_key, count(*)::integer as actual_count
      from cleanup_2024_practice_links
      group by resolution_key
    ) as actual using (resolution_key)
    where coalesce(actual.actual_count, 0) <> expected.expected_count
  ) as invalid;

  if v_links <> 44 or v_bad_groups <> 0 then
    raise exception
      'Limpieza 2024 abortada: vínculos candidatos %, grupos inválidos %',
      v_links, v_bad_groups;
  end if;
end;
$$;

-- Los dos triggers legacy revierten updates sin sesión admin. Se suspenden sólo
-- para este backfill; el trigger de sincronización de tipo permanece activo.
alter table public.practicas disable trigger trg_check_practica_updates;
alter table public.practicas disable trigger trg_debug_practica;

update public.practicas as p
set lanzamiento_id = c.lanzamiento_id
from cleanup_2024_practice_links as c
where p.id = c.practica_id
  and p.lanzamiento_id is null;

-- Dos fechas estaban invertidas por interpretación MM/DD frente a DD/MM.
update public.practicas as p
set fecha_inicio = '2024-05-31'
from public.lanzamientos_pps as l
where p.lanzamiento_id = l.id
  and l.nombre_pps = 'Hospital Área Programa MOGUILLANSKY  Futbol Valorado'
  and l.fecha_inicio = '2024-08-31'
  and l.fecha_finalizacion = '2024-05-31'
  and p.fecha_inicio = '2024-08-31'
  and p.fecha_finalizacion = '2024-05-31';

update public.practicas
set fecha_finalizacion = '2024-11-08'
where nombre_institucion = 'Ministerio de Trabajo y Desarrollo Laboral'
  and fecha_inicio = '2024-09-04'
  and fecha_finalizacion = '2024-08-11'
  and horas_realizadas = 70;

alter table public.practicas enable trigger trg_debug_practica;
alter table public.practicas enable trigger trg_check_practica_updates;

update public.lanzamientos_pps
set
  fecha_inicio = '2024-05-31',
  notas_gestion = concat_ws(
    E'\n',
    nullif(notas_gestion, ''),
    '[reconciliacion_2024:WA24-017] Fecha 31/05 corregida; coordinación confirmó 20 h como acreditación académica definitiva.'
  ),
  updated_at = statement_timestamp()
where nombre_pps = 'Hospital Área Programa MOGUILLANSKY  Futbol Valorado'
  and fecha_inicio = '2024-08-31'
  and fecha_finalizacion = '2024-05-31';

update public.lanzamientos_pps as l
set
  modalidad_cupo = 'realizado',
  cupos_disponibles = (
    select count(*)::numeric
    from public.practicas as p
    where p.lanzamiento_id = l.id
  ),
  notas_gestion = concat_ws(
    E'\n',
    nullif(l.notas_gestion, ''),
    '[reconciliacion_2024:WA24-032] Capacidad no anunciada; se conserva modalidad realizada.'
  ),
  updated_at = statement_timestamp()
where l.nombre_pps = 'Asociación Civil Programa Aser'
  and l.fecha_inicio = '2024-09-02';

update public.lanzamientos_pps
set
  notas_gestion = concat_ws(
    E'\n',
    nullif(notas_gestion, ''),
    '[reconciliacion_2024:WA24-005] Barriletes podía acreditar Clínica o Comunitaria según la actividad; se preserva la especialidad individual.'
  ),
  updated_at = statement_timestamp()
where nombre_pps = 'Asociación Civil Pensar - Barriletes'
  and fecha_inicio in ('2024-03-19', '2024-04-25', '2024-05-21', '2024-08-05');

update public.lanzamientos_pps
set
  notas_gestion = concat_ws(
    E'\n',
    nullif(notas_gestion, ''),
    '[reconciliacion_2024:WA24-034] Fila adicional usada para la realización tardía de 24 h; la fila principal ya conserva los ocho cupos anunciados.'
  ),
  updated_at = statement_timestamp()
where nombre_pps = 'Colegio San José Obrero de Neuquén'
  and fecha_inicio = '2024-09-16';

alter table private.historical_launch_offers
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_resolution text;

comment on column private.historical_launch_offers.reviewed_at is
  'Fecha de resolución humana/documental de la observación de reconstrucción.';
comment on column private.historical_launch_offers.review_resolution is
  'Resolución auditada; conserva la diferencia entre oferta canónica y filas legacy.';

with resolutions (offer_id, resolution) as (
  values
    ('WA24-001'::text, 'Oferta documental verificada; se creó institución y lanzamiento oculto, sin resultado observado.'::text),
    ('WA24-002', 'Oferta y slots verificados; se creó el primer período y se vincularon ocho prácticas.'),
    ('WA24-003', 'Oferta clínica canónica verificada; el año 2023 se conserva como error de la fuente copiada y los miembros legacy continúan señalados por subprograma.'),
    ('WA24-004', 'Oferta laboral canónica separada y verificada; el año 2023 se conserva como error de la fuente copiada.'),
    ('WA24-005', 'Oferta continua y relanzamiento verificados. Coordinación confirmó acreditación Clínica/Comunitaria según actividad; se vincularon las cohortes legacy sin cambiar especialidades.'),
    ('WA24-007', 'Oferta verificada; se creó lanzamiento y se vinculó la práctica de 30 horas del 06/04.'),
    ('WA24-011', 'Oferta continua verificada; se consolidó la institución y se vincularon doce realizaciones.'),
    ('WA24-012', 'Oferta del primer período verificada. SAU queda documentada como modalidad interna histórica discontinuada; la realización de agosto se preserva aparte.'),
    ('WA24-015', 'Oferta documental verificada; se creó lanzamiento oculto con capacidad y resultado desconocidos.'),
    ('WA24-018', 'Coordinación confirmó que M-PBI fue una PPS docente alojada externamente en Psicoterapia Corporal PATAGONIA; se creó la fila sin inventar resultados.'),
    ('WA24-021', 'Oferta y tres slots verificados; las filas legacy se conservan como grupos operativos de una única oferta.'),
    ('WA24-022', 'Oferta y cuatro slots verificados; las filas legacy se conservan como grupos operativos de una única oferta.'),
    ('WA24-023', 'Oferta y slots documentales verificados; la incertidumbre de asignación de filas genéricas permanece explícita en los miembros, sin alterar la oferta canónica.'),
    ('WA24-026', 'Oferta verificada; se creó lanzamiento y se vinculó la práctica específica de 30 horas del 24/08.'),
    ('WA24-029', 'Oferta canónica verificada por convergencia entre la comunicación de dos convocatorias, la reunión de Fundación Tiempo y la fila operativa Adultos.'),
    ('WA24-030', 'Oferta canónica verificada por convergencia entre la comunicación de dos convocatorias, la reunión de Fundación Tiempo y la fila operativa Niños.'),
    ('WA24-031', 'Oferta 2024 verificada por inscripción, recordatorio, prácticas y filas operativas; 2025 se conserva como error tipográfico del anuncio.'),
    ('WA24-033', 'Oferta y relanzamiento verificados; se creó institución y lanzamiento oculto sin prácticas observadas.'),
    ('WA24-034', 'Oferta y tres slots verificados; se adoptó 09/09 para la fila principal y la fila adicional conserva una realización tardía.')
)
update private.historical_launch_offers as o
set
  review_status = 'verified',
  reviewed_at = statement_timestamp(),
  review_resolution = r.resolution
from resolutions as r
where o.offer_id = r.offer_id;

update private.historical_launch_offers
set
  review_status = 'verified',
  reviewed_at = statement_timestamp(),
  review_resolution = 'Fecha imposible 31/08→31/05 corregida. Coordinación confirmó 20 h como valor académico definitivo para las 33 prácticas; no se modifican horas.'
where offer_id = 'WA24-017';

-- Las nueve ofertas documentadas ya tienen una fila legacy auditable.
with member_seed (offer_id, resolution_key, notes) as (
  values
    ('WA24-001'::text, 'WA24-001'::text, 'Lanzamiento reconstruido desde el anuncio; sin prácticas observadas.'::text),
    ('WA24-002', 'WA24-002', 'Primer período reconstruido y conciliado con ocho prácticas.'),
    ('WA24-007', 'WA24-007', 'Lanzamiento reconstruido y conciliado con la práctica del 06/04.'),
    ('WA24-011', 'WA24-011', 'Lanzamiento continuo reconstruido y conciliado con doce prácticas.'),
    ('WA24-012', 'WA24-012', 'Primer período SAU reconstruido; excepción interna histórica documentada.'),
    ('WA24-015', 'WA24-015', 'Lanzamiento reconstruido sin capacidad ni prácticas observadas.'),
    ('WA24-018', 'WA24-018', 'M-PBI conciliada con Psicoterapia Corporal PATAGONIA por confirmación de coordinación.'),
    ('WA24-026', 'WA24-026', 'Lanzamiento reconstruido y conciliado con la práctica específica del 24/08.'),
    ('WA24-033', 'WA24-033', 'Lanzamiento y relanzamiento reconstruidos; sin prácticas observadas.')
)
insert into private.historical_launch_members (
  offer_id,
  lanzamiento_id,
  match_confidence,
  use_for_outcomes,
  notes
)
select
  s.offer_id,
  l.id,
  'high',
  false,
  s.notes
from member_seed as s
join public.lanzamientos_pps as l
  on l.notas_gestion like '%[reconstruccion_2024:' || s.resolution_key || ']%'
on conflict (offer_id, lanzamiento_id) do update
set
  match_confidence = excluded.match_confidence,
  notes = excluded.notes;

-- El lanzamiento clínico de agosto también pertenece a la oferta continua de
-- Barriletes; la orientación de cada práctica se conserva sin coerción.
insert into private.historical_launch_members (
  offer_id,
  lanzamiento_id,
  match_confidence,
  use_for_outcomes,
  notes
)
select
  'WA24-005',
  l.id,
  'high',
  false,
  'Cohorte operativa de agosto de la oferta continua Barriletes; coordinación confirmó acreditación por actividad en ambas categorías.'
from public.lanzamientos_pps as l
where l.nombre_pps = 'Asociación Civil Pensar - Barriletes'
  and l.fecha_inicio = '2024-08-05'
on conflict (offer_id, lanzamiento_id) do update
set
  match_confidence = excluded.match_confidence,
  notes = excluded.notes;

update private.historical_launch_members
set
  match_confidence = 'high',
  notes = 'Cohorte operativa de la oferta continua Barriletes; orientación y horas se determinan por actividad realizada.'
where offer_id = 'WA24-005';

update private.historical_launch_members
set
  match_confidence = 'high',
  notes = 'Fila operativa de la oferta San José Obrero; principal y realización tardía documentadas bajo una oferta canónica.'
where offer_id = 'WA24-034';

do $$
declare
  v_unmatched integer;
  v_linked integer;
  v_launches integer;
  v_invalid_launch_ranges integer;
  v_invalid_practice_ranges integer;
  v_verified_offers integer;
  v_review_offers integer;
  v_mapped_offers integer;
  v_member_links integer;
  v_bad_duplicate_names integer;
begin
  select count(*)::integer
    into v_unmatched
  from public.practicas
  where tipo_actividad = 'pps'
    and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'
    and lanzamiento_id is null;

  select count(*)::integer
    into v_linked
  from public.practicas
  where tipo_actividad = 'pps'
    and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'
    and lanzamiento_id is not null;

  select count(*)::integer
    into v_launches
  from public.lanzamientos_pps
  where tipo_actividad = 'pps'
    and fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$';

  select count(*)::integer
    into v_invalid_launch_ranges
  from public.lanzamientos_pps
  where fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'
    and fecha_finalizacion ~ '^2024-[0-9]{2}-[0-9]{2}$'
    and fecha_finalizacion::date < fecha_inicio::date;

  select count(*)::integer
    into v_invalid_practice_ranges
  from public.practicas
  where fecha_inicio ~ '^2024-[0-9]{2}-[0-9]{2}$'
    and fecha_finalizacion ~ '^2024-[0-9]{2}-[0-9]{2}$'
    and fecha_finalizacion::date < fecha_inicio::date;

  select
    count(*) filter (where review_status = 'verified')::integer,
    count(*) filter (where review_status = 'needs_review')::integer
    into v_verified_offers, v_review_offers
  from private.historical_launch_offers
  where source_year = 2024;

  select
    count(distinct o.offer_id)::integer,
    count(m.lanzamiento_id)::integer
    into v_mapped_offers, v_member_links
  from private.historical_launch_offers as o
  left join private.historical_launch_members as m on m.offer_id = o.offer_id
  where o.source_year = 2024
    and m.offer_id is not null;

  select count(*)::integer
    into v_bad_duplicate_names
  from (
    select expected.nombre
    from (
      values
        ('UFLO - Entrevista a Profesionales'::text),
        ('UFLO - SAU'::text),
        ('UFLO - PPS Investigación'::text)
    ) as expected(nombre)
    left join public.instituciones as i on i.nombre = expected.nombre
    group by expected.nombre
    having count(i.id) <> 1
  ) as invalid;

  if v_unmatched <> 0 or v_linked <> 363 then
    raise exception
      'Validación post-limpieza falló: prácticas sin vínculo %, vinculadas %',
      v_unmatched, v_linked;
  end if;

  if v_launches <> 80 then
    raise exception
      'Validación post-limpieza falló: se esperaban 80 lanzamientos 2024 y se obtuvieron %',
      v_launches;
  end if;

  if v_invalid_launch_ranges <> 0 or v_invalid_practice_ranges <> 0 then
    raise exception
      'Validación post-limpieza falló: rangos inválidos en lanzamientos %, prácticas %',
      v_invalid_launch_ranges, v_invalid_practice_ranges;
  end if;

  if v_verified_offers <> 42 or v_review_offers <> 0 then
    raise exception
      'Validación post-limpieza falló: ofertas verificadas %, pendientes %',
      v_verified_offers, v_review_offers;
  end if;

  if v_mapped_offers <> 42 or v_member_links <> 60 then
    raise exception
      'Validación post-limpieza falló: ofertas mapeadas %, vínculos legacy %',
      v_mapped_offers, v_member_links;
  end if;

  if v_bad_duplicate_names <> 0 then
    raise exception
      'Validación post-limpieza falló: quedaron % grupos institucionales duplicados',
      v_bad_duplicate_names;
  end if;
end;
$$;

commit;
