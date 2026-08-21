-- Resolucion determinista de ambiguedades y clasificacion de externos en el
-- barrido de jefaturas (parche sobre sync_jefe_moodle_reports_scoped_v1_impl).
--
-- Problema observado en produccion (simulador Selva, clinica):
--  - 61 "entregas con practicas duplicadas": una tarea compartida entre
--    relanzamientos mapea a varias practicas del mismo alumno.
--  - 142 "filas sin PPS coincidente": cohorts viejas que existen en Campus
--    pero ni siquiera figuran en Mi Panel.
--
-- Reglas nuevas (validadas contra datos reales: quedan 0 casos arbitrarios):
--  1. Si un grupo (cmid, dni) mezcla practicas terminales y activas, las
--     terminales salen del grupo.
--  2. Se elige por precedencia determinista: En curso > lanzamiento mas nuevo
--     > practica mas nueva > id estable.
--  3. Las filas cuyo DNI no existe en estudiantes se cuentan aparte en
--     'unmatched_external' para no asustar a la jefatura.
--
-- El parche opera por anclas sobre pg_get_functiondef y aborta si el codigo
-- fuente vigente no coincide, para nunca aplicar un remiendo a ciegas.

do $patch$
declare
  v_src text;
  pos_a integer;
  pos_b integer;
  pos_c integer;
  pos_d integer;
  v_new_cte text;
begin
  select p.oid::regprocedure::text, pg_get_functiondef(p.oid)
    into v_new_cte, v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'sync_jefe_moodle_reports_scoped_v1_impl';

  if v_src is null then
    raise exception 'No se encontro sync_jefe_moodle_reports_scoped_v1_impl';
  end if;

  -- ── 1) Nuevas variables de conteo ──────────────────────────────────────
  if position('v_unmatched_external integer := 0;' in v_src) = 0 then
    pos_a := position('  v_scope text;' in v_src);
    if pos_a = 0 then raise exception 'Ancla declaraciones no encontrada'; end if;
    v_src := substr(v_src, 1, pos_a - 1)
      || '  v_unmatched_external integer := 0;'
      || chr(10) || '  v_deduplicated integer := 0;'
      || chr(10) || substr(v_src, pos_a);
  end if;

  -- ── 2) Resolucion de candidatos por precedencia ────────────────────────
  pos_a := position('), candidate_counts as (' in v_src);
  pos_b := position('), classified as (' in v_src);
  if pos_a = 0 or pos_b = 0 or pos_b <= pos_a then
    raise exception 'Anclas candidate_counts/classified no encontradas';
  end if;

  v_new_cte := '), candidate_pool as (
    select
      c.*,
      (lower(coalesce(p.estado, '''')) = ''en curso'') as en_curso,
      p.created_at as practica_created,
      (select max(l2.created_at)
        from public.lanzamientos_pps l2
        where l2.id = c.lanzamiento_id) as launch_created
    from candidates c
    join public.practicas p on p.id = c.practica_id
  ), candidate_scope as (
    select cp.*
    from candidate_pool cp
    where not (
      cp.en_curso = false
      and exists (
        select 1
        from candidate_pool activa
        where activa.cmid = cp.cmid
          and activa.student_dni = cp.student_dni
          and activa.en_curso
      )
    )
  ), candidate_counts as (
    select
      s.cmid,
      s.student_dni,
      count(*)::integer as candidate_count,
      (array_agg(s.practica_id order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as practica_id,
      (array_agg(s.estudiante_id order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as estudiante_id,
      (array_agg(s.lanzamiento_id order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as lanzamiento_id,
      (array_agg(s.aula_entrega_id order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as aula_entrega_id,
      (array_agg(s.moodle_grade_max order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as configured_grade_max,
      (array_agg(s.grade_conversion_mode order by s.en_curso desc, s.launch_created desc nulls last, s.practica_created desc nulls last, s.practica_id))[1] as grade_conversion_mode
    from candidate_scope s
    group by s.cmid, s.student_dni
  ';

  v_src := substr(v_src, 1, pos_a - 1) || v_new_cte || substr(v_src, pos_b);

  -- ── 3) Condicion de aceptacion: ya no exige candidato unico ────────────
  pos_c := position('where c.candidate_count = 1
      and c.fully_valid
    on conflict' in v_src);
  if pos_c = 0 then raise exception 'Ancla condicion de insercion no encontrada'; end if;
  v_src := replace(v_src,
    'where c.candidate_count = 1
      and c.fully_valid
    on conflict',
    'where c.practica_id is not null
      and c.fully_valid
    on conflict');

  -- ── 4) Contadores finales ──────────────────────────────────────────────
  pos_c := position('  select
    count(*) filter (where c.candidate_count = 1 and c.fully_valid)::integer,' in v_src);
  pos_d := position('  from classified c;' in v_src);
  if pos_c = 0 or pos_d = 0 or pos_d <= pos_c then
    raise exception 'Anclas bloque de contadores no encontradas';
  end if;

  v_new_cte := '  select
    count(*) filter (where c.practica_id is not null and c.fully_valid)::integer,
    (select count(*) from inserted)::integer,
    (select count(*) from snapshot_upserts)::integer,
    count(*) filter (where c.practica_id is null and coalesce(c.candidate_count, 0) > 1)::integer,
    count(*) filter (where coalesce(c.candidate_count, 0) = 0)::integer,
    count(*) filter (
      where c.practica_id is not null and not c.fully_valid
    )::integer,
    count(*) filter (
      where coalesce(c.candidate_count, 0) = 0
        and c.student_dni ~ ''^\d{6,12}$''
        and not exists (
          select 1
          from public.estudiantes e2
          where regexp_replace(coalesce(e2.dni::text, ''''), ''\D'', '''', ''g'') = c.student_dni
        )
    )::integer,
    count(*) filter (
      where c.practica_id is not null and c.fully_valid and c.candidate_count > 1
    )::integer
  into
    v_accepted,
    v_stored,
    v_snapshot_updated,
    v_ambiguous,
    v_unmatched,
    v_invalid,
    v_unmatched_external,
    v_deduplicated
  ';

  v_src := substr(v_src, 1, pos_c - 1) || v_new_cte || substr(v_src, pos_d);

  -- ── 5) Resultado enriquecido ───────────────────────────────────────────
  if position('''unmatched_external''' in v_src) = 0 then
    pos_c := position('''invalid'', v_invalid,' in v_src);
    if pos_c = 0 then raise exception 'Ancla resultado jsonb no encontrada'; end if;
    v_src := replace(v_src,
      '''invalid'', v_invalid,',
      '''invalid'', v_invalid,
    ''unmatched_external'', v_unmatched_external,
    ''deduplicated'', v_deduplicated,');
  end if;

  -- ── 6) La desambiguacion ya no marca la corrida como parcial ───────────
  v_src := replace(v_src, 'v_ambiguous + v_invalid', 'v_invalid');

  execute v_src;
end;
$patch$;
