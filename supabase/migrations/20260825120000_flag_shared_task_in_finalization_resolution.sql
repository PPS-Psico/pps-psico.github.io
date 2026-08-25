begin;

-- Marca en la resolucion de notas cuales PPS entregan en una tarea compartida.
--
-- Cuando dos PPS del mismo estudiante entregan en el mismo espacio de Moodle
-- (Fundacion Tiempo con Adultos y Ninos, Ateneos Ulloa con sus dos ateneos),
-- Moodle tiene un unico campo de nota: la catedra pone un numero cualquiera
-- -a veces 0- y reparte las notas reales en el comentario. Son 189 pares
-- (alumno, tarea) repartidos en 17 tareas y 166 alumnos.
--
-- Hasta ahora coordinacion no tenia forma de distinguir esas filas, y el numero
-- suelto de Moodle se leia como si fuera la nota de la PPS. Con `tarea_compartida`
-- la interfaz puede pedir que se confirme contra `feedback_comment`, que ya viaja
-- en la misma respuesta.

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
  tarea_compartida boolean,
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
      s.feedback_comment,
      (
        select count(distinct p3.id)
        from public.practicas p3
        join public.lanzamiento_moodle_tareas lm3 on lm3.lanzamiento_id = p3.lanzamiento_id
        where p3.estudiante_id = p.estudiante_id
          and lm3.aula_entrega_id in (
            select lm4.aula_entrega_id
            from public.lanzamiento_moodle_tareas lm4
            where lm4.lanzamiento_id = p.lanzamiento_id
          )
      ) > 1 as tarea_compartida
    from request_items r
    join public.practicas p on p.id = r.practica_id
    left join public.moodle_grade_snapshots s on s.practica_id = p.id and s.cmid = p.nota_moodle_cmid
  )
  select r.practica_id, r.nota, r.nota_numeric, r.nota_panel, r.fuente, r.observed_at,
    r.moodle_status, r.cmid, r.grade_display, r.feedback_comment, r.tarea_compartida,
    case when count(*) filter (where r.nota_numeric is null) over () = 0
      then round(avg(r.nota_numeric) over (), 0) else null end as nota_promedio
  from resolved r order by r.practica_id;
end;
$function$;

-- `create function` otorga EXECUTE a PUBLIC por defecto; se restablece el alcance original.
revoke all on function public.get_finalization_grade_resolution(uuid) from public, anon;
grant execute on function public.get_finalization_grade_resolution(uuid) to authenticated, service_role;

commit;
