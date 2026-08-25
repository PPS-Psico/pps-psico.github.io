begin;

-- La solicitud de egreso mostraba "-" en toda PPS sin `nota_fuente`, incluso
-- cuando el panel tenia una nota registrada. Coordinacion veia un guion donde
-- el alumno veia un numero, y no habia forma de distinguir "no hay nota" de
-- "hay una nota sin verificar contra Campus".
--
-- Se agrega `nota_panel`: el texto crudo de practicas.nota, sin la compuerta de
-- procedencia. No participa del promedio -eso sigue exigiendo notas verificadas
-- para las PPS-, solo permite que la interfaz diga cual es y de donde sale.

drop function if exists public.get_finalization_grade_resolution(uuid);

create function public.get_finalization_grade_resolution(p_finalizacion_id uuid)
returns table(
  practica_id uuid,
  nota text,
  nota_numeric numeric,
  nota_panel text,
  fuente text,
  observed_at timestamp with time zone,
  moodle_status text,
  cmid bigint,
  grade_display text,
  feedback_comment text,
  nota_promedio numeric
)
language plpgsql
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'Acceso restringido a coordinacion' using errcode = '42501'; end if;
  return query
  with request_items as (
    select distinct (item ->> 'practicaId')::uuid as practica_id
    from public.finalizacion_pps f
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(f.detalle_practicas -> 'items') = 'array'
        then f.detalle_practicas -> 'items' else '[]'::jsonb end
    ) item
    where f.id = p_finalizacion_id and item ->> 'practicaId' ~* '^[0-9a-f-]{36}$'
  ), resolved as (
    select p.id as practica_id,
      case when p.nota_fuente is null or p.nota_fuente = 'legacy' then null
        when p.nota_moodle is not null then rtrim(rtrim(to_char(p.nota_moodle, 'FM999999990.00'), '0'), '.')
        else nullif(btrim(p.nota), '') end as nota,
      case when p.nota_fuente is null or p.nota_fuente = 'legacy' then null else p.nota_moodle end as nota_numeric,
      nullif(btrim(p.nota), '') as nota_panel,
      case when p.nota_fuente is null or p.nota_fuente = 'legacy' then null else p.nota_fuente end as fuente,
      case when p.nota_fuente is null or p.nota_fuente = 'legacy' then null else p.nota_actualizada_at end as observed_at,
      s.task_status as moodle_status, p.nota_moodle_cmid as cmid, s.grade_display,
      s.feedback_comment
    from request_items r
    join public.practicas p on p.id = r.practica_id
    left join public.moodle_grade_snapshots s on s.practica_id = p.id and s.cmid = p.nota_moodle_cmid
  )
  select r.practica_id, r.nota, r.nota_numeric, r.nota_panel, r.fuente, r.observed_at,
    r.moodle_status, r.cmid, r.grade_display, r.feedback_comment,
    case when count(*) filter (where r.nota_numeric is null) over () = 0
      then round(avg(r.nota_numeric) over (), 0) else null end as nota_promedio
  from resolved r order by r.practica_id;
end;
$function$;

-- `create function` otorga EXECUTE a PUBLIC por defecto. La version anterior
-- solo lo tenia authenticated y service_role: se restablece ese alcance.
revoke all on function public.get_finalization_grade_resolution(uuid) from public, anon;
grant execute on function public.get_finalization_grade_resolution(uuid) to authenticated, service_role;

commit;
