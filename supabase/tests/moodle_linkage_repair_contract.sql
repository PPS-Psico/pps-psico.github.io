begin;

do $$
declare
  broken_audit_rows integer;
  broken_orientation_rows integer;
  cross_year_san_jose integer;
  wrong_direct_links integer;
  wrong_json_links integer;
  confirmed_orphan_links integer;
begin
  select count(*) into broken_audit_rows
  from private.moodle_practice_link_repair_audit a
  join public.practicas p on p.id = a.practice_id
  where p.lanzamiento_id is distinct from a.repaired_lanzamiento_id
     or coalesce(array_length(a.evidence_sources, 1), 0) = 0;

  if broken_audit_rows <> 0 then
    raise exception 'Moodle linkage audit has % inconsistent rows', broken_audit_rows;
  end if;

  select count(*) into broken_orientation_rows
  from private.moodle_practice_orientation_repair_audit a
  join public.practicas p on p.id = a.practice_id
  where p.especialidad is distinct from a.repaired_orientation
     or nullif(trim(a.assigned_schedule), '') is null;

  if broken_orientation_rows <> 0 then
    raise exception 'Moodle orientation audit has % inconsistent rows', broken_orientation_rows;
  end if;

  select count(*) into cross_year_san_jose
  from public.practicas p
  join public.lanzamientos_pps l on l.id = p.lanzamiento_id
  join public.lanzamiento_moodle_tareas t
    on t.lanzamiento_id = l.id
   and t.orientacion_key = 'educacional'
   and t.validation_status = 'confirmed'
  join public.aula_entregas a on a.id = t.aula_entrega_id
  where l.nombre_pps = 'Colegio San José Obrero de Neuquén'
    and coalesce(left(p.fecha_finalizacion, 4), left(p.fecha_inicio, 4)) = '2024'
    and a.moodle_id <> '625361';

  if cross_year_san_jose <> 0 then
    raise exception 'A 2024 San José practice is linked outside task 625361';
  end if;

  with stored_urls as (
    select l.id as lanzamiento_id,
           coalesce(
             substring(v.url from '[?&]id=([0-9]+)'),
             substring(trim(v.url) from '^([0-9]+)$')
           ) as moodle_id
    from public.lanzamientos_pps l
    cross join lateral (values (l.codigo_tarjeta_campus), (l.informe)) v(url)
    where nullif(trim(v.url), '') is not null
      and left(ltrim(v.url), 1) <> '{'
  ), unique_urls as (
    select lanzamiento_id, min(moodle_id) as moodle_id
    from stored_urls
    where moodle_id is not null
    group by lanzamiento_id
    having count(distinct moodle_id) = 1
  )
  select count(*) into wrong_direct_links
  from unique_urls u
  join public.lanzamiento_moodle_tareas t
    on t.lanzamiento_id = u.lanzamiento_id
   and t.validation_status = 'confirmed'
  join public.aula_entregas a on a.id = t.aula_entrega_id
  where a.moodle_id <> u.moodle_id;

  if wrong_direct_links <> 0 then
    raise exception 'A confirmed Moodle link contradicts a unique stored URL';
  end if;

  with json_urls as (
    select l.id as lanzamiento_id,
           case
             when translate(lower(j.key), 'áéíóúüñ', 'aeiouun') like '%clin%' then 'clinica'
             when translate(lower(j.key), 'áéíóúüñ', 'aeiouun') like '%labor%' then 'laboral'
             when translate(lower(j.key), 'áéíóúüñ', 'aeiouun') like '%educ%' then 'educacional'
             when translate(lower(j.key), 'áéíóúüñ', 'aeiouun') like '%comunit%' then 'comunitaria'
           end as orientation_key,
           substring(j.value from '[?&]id=([0-9]+)') as moodle_id
    from public.lanzamientos_pps l
    cross join lateral jsonb_each_text(
      case
        when left(ltrim(coalesce(l.codigo_tarjeta_campus, '')), 1) = '{'
          then l.codigo_tarjeta_campus::jsonb
        else '{}'::jsonb
      end
    ) j
  )
  select count(*) into wrong_json_links
  from json_urls u
  join public.lanzamiento_moodle_tareas t
    on t.lanzamiento_id = u.lanzamiento_id
   and t.orientacion_key = u.orientation_key
   and t.validation_status = 'confirmed'
  join public.aula_entregas a on a.id = t.aula_entrega_id
  where u.orientation_key is not null
    and u.moodle_id is not null
    and a.moodle_id <> u.moodle_id;

  if wrong_json_links <> 0 then
    raise exception 'A confirmed Moodle link contradicts an orientation-specific stored URL';
  end if;

  select count(*) into confirmed_orphan_links
  from public.practica_moodle_tareas pt
  join public.practicas p on p.id = pt.practica_id
  where pt.validation_status = 'confirmed'
    and p.lanzamiento_id is null;

  if confirmed_orphan_links <> 7 then
    raise exception 'Expected 7 confirmed legacy orphan links, found %', confirmed_orphan_links;
  end if;
end
$$;

set local role authenticated;

do $$
declare
  visible_practice_overrides integer;
begin
  begin
    perform 1 from private.moodle_practice_link_repair_audit limit 1;
    raise exception 'authenticated unexpectedly read private Moodle repair audit';
  exception
    when insufficient_privilege then null;
  end;


  select count(*) into visible_practice_overrides
  from public.practica_moodle_tareas;

  if visible_practice_overrides <> 0 then
    raise exception 'authenticated without a user unexpectedly read % practice overrides',
      visible_practice_overrides;
  end if;
end
$$;

rollback;
