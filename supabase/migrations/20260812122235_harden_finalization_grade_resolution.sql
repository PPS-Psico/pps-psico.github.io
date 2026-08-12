-- Finalization must never promote an old student-entered practicas.nota to an
-- academic source. Only a Moodle application or an explicit admin correction
-- (both identified by nota_fuente) can participate in the SAC resolution.
create or replace function public.get_finalization_grade_resolution(
  p_finalizacion_id uuid
)
returns table (
  practica_id uuid,
  nota text,
  nota_numeric numeric,
  fuente text,
  observed_at timestamptz,
  moodle_status text,
  cmid bigint,
  grade_display text,
  nota_promedio numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acceso restringido a coordinacion'
      using errcode = '42501';
  end if;

  return query
  with request_items as (
    select distinct (item ->> 'practicaId')::uuid as practica_id
    from public.finalizacion_pps f
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(f.detalle_practicas -> 'items') = 'array'
          then f.detalle_practicas -> 'items'
        else '[]'::jsonb
      end
    ) item
    where f.id = p_finalizacion_id
      and item ->> 'practicaId' ~* '^[0-9a-f-]{36}$'
  ), resolved as (
    select
      p.id as practica_id,
      case
        when p.nota_fuente is null or p.nota_fuente = 'legacy' then null
        when p.nota_moodle is not null
          then rtrim(rtrim(to_char(p.nota_moodle, 'FM999999990.00'), '0'), '.')
        else nullif(btrim(p.nota), '')
      end as nota,
      case
        when p.nota_fuente is null or p.nota_fuente = 'legacy' then null
        else p.nota_moodle
      end as nota_numeric,
      case
        when p.nota_fuente is null or p.nota_fuente = 'legacy' then null
        else p.nota_fuente
      end as fuente,
      case
        when p.nota_fuente is null or p.nota_fuente = 'legacy' then null
        else p.nota_actualizada_at
      end as observed_at,
      s.task_status as moodle_status,
      p.nota_moodle_cmid as cmid,
      s.grade_display
    from request_items r
    join public.practicas p on p.id = r.practica_id
    left join public.moodle_grade_snapshots s
      on s.practica_id = p.id
     and s.cmid = p.nota_moodle_cmid
  )
  select
    r.practica_id,
    r.nota,
    r.nota_numeric,
    r.fuente,
    r.observed_at,
    r.moodle_status,
    r.cmid,
    r.grade_display,
    round(avg(r.nota_numeric) over (), 0) as nota_promedio
  from resolved r
  order by r.practica_id;
end;
$$;

comment on function public.get_finalization_grade_resolution(uuid) is
  'Resuelve para coordinacion solo notas Moodle o correcciones admin con procedencia; ignora el JSON estudiantil y notas legacy sin fuente.';
