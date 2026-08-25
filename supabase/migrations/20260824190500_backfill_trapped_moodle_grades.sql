begin;

-- Backfill unico de las notas que quedaron atrapadas en moodle_grade_snapshots
-- mientras el candado `scan_closed` bloqueaba la primera aplicacion
-- (ver 20260824190000_unblock_first_moodle_grade_application.sql).
--
-- Reaplica la ultima observacion calificada de cada practica sin nota_fuente,
-- con la misma logica de conversion que usa el trigger.
--
-- Quedan deliberadamente afuera:
--   · Las que Moodle califico con un numero no interpretable como nota.
--   · Las que ya tienen una nota NUMERICA distinta cargada a mano: ahi el texto
--     legacy pudo salir de un comentario de retroalimentacion y el numero suelto
--     de Moodle no alcanza para decidir. Se revisan una por una.
-- Las de texto no numerico ("Sin calificar", "Entregado (sin corregir)") si se
-- pisan: no son notas, son estados.

do $$
declare
  r record;
  v_mode text;
  v_norm numeric;
  v_note text;
  v_rule text;
  v_rev integer;
  v_app uuid;
  v_applied integer := 0;
  v_skipped_conflict integer := 0;
  v_skipped_unreadable integer := 0;
begin
  for r in
    select distinct on (o.practica_id, o.cmid)
      o.id, o.practica_id, o.estudiante_id, o.cmid, o.aula_entrega_id,
      o.grade_value, o.grade_max, o.observed_at, o.confidence,
      p.nota as nota_legacy
    from public.moodle_grade_observations o
    join public.practicas p on p.id = o.practica_id
    where o.task_status = 'graded'
      and o.grade_value is not null
      and o.grade_max is not null
      and o.grade_max > 0
      and p.nota_fuente is null
    order by o.practica_id, o.cmid, o.observed_at desc
  loop
    select a.grade_conversion_mode into v_mode
    from public.aula_entregas a where a.id = r.aula_entrega_id;

    if v_mode = 'pass_fail' then
      v_norm := null;
      v_note := case when r.grade_value > 0 then 'Aprobado' else 'Desaprobado' end;
      v_rule := 'explicit_pass_fail';
    else
      v_norm := private.read_moodle_grade_v1(r.grade_value, r.grade_max, v_mode);
      if v_norm is null or v_norm < 0 or v_norm > 10 then
        v_skipped_unreadable := v_skipped_unreadable + 1;
        continue;
      end if;
      v_note := rtrim(rtrim(to_char(v_norm, 'FM999999990.00'), '0'), '.');
      v_rule := case
        when v_mode = 'direct_10' then 'explicit_direct_10'
        when v_norm = round(r.grade_value, 2)
          and (r.grade_value / r.grade_max) * 10 < 4 then 'recovered_ten_scale'
        else 'explicit_percentage'
      end;
    end if;

    -- Conflicto: ya hay una nota numerica distinta cargada a mano.
    if btrim(coalesce(r.nota_legacy, '')) ~ '^[0-9]'
       and btrim(r.nota_legacy) <> v_note then
      v_skipped_conflict := v_skipped_conflict + 1;
      continue;
    end if;

    select coalesce(s.grade_revision, 1) into v_rev
    from public.moodle_grade_snapshots s
    where s.practica_id = r.practica_id and s.cmid = r.cmid;
    v_rev := coalesce(v_rev, 1);

    if exists (
      select 1 from private.moodle_grade_finalizations f
      where f.practica_id = r.practica_id
        and f.cmid = r.cmid
        and f.grade_revision = v_rev
    ) then
      continue;
    end if;

    update public.practicas
    set nota = v_note,
        informe_estado = 'calificado',
        nota_moodle = v_norm,
        nota_fuente = r.confidence,
        nota_actualizada_at = r.observed_at,
        nota_moodle_cmid = r.cmid
    where id = r.practica_id
      and nota_fuente is null;

    if not found then
      continue;
    end if;

    insert into private.moodle_grade_applications (
      source_observation_id, source_observed_at, estudiante_id, practica_id,
      cmid, previous_note, applied_note, grade_value, grade_max,
      conversion_rule, confidence, changed, grade_revision
    ) values (
      r.id, r.observed_at, r.estudiante_id, r.practica_id,
      r.cmid, r.nota_legacy, v_note, r.grade_value, r.grade_max,
      v_rule, r.confidence, r.nota_legacy is distinct from v_note, v_rev
    ) returning id into v_app;

    insert into private.moodle_grade_finalizations (
      practica_id, cmid, grade_revision, source_observation_id, application_id
    ) values (r.practica_id, r.cmid, v_rev, r.id, v_app);

    v_applied := v_applied + 1;
  end loop;

  raise notice 'Backfill Moodle: % aplicadas, % en conflicto numerico, % no interpretables',
    v_applied, v_skipped_conflict, v_skipped_unreadable;
end $$;

commit;
