-- Read-only reconciliation: no grade, decision or source row is modified.
begin;
do $$
declare area text; row_count integer; distinct_count integer;
begin
  foreach area in array array['clinica','educacional','laboral','comunitaria'] loop
    select count(*),count(distinct practica_id) into row_count,distinct_count
      from private.jefe_report_rows_v1(array[area]);
    if row_count<>distinct_count then raise exception 'Duplicate report in %',area; end if;
    if exists(select 1 from private.jefe_report_rows_v1(array[area]) r
      cross join lateral(select private.moodle_practice_snapshot_v1(r.practica_id) as value) s
      where r.submitted_at is distinct from (s.value->>'submitted_at')::timestamptz
        or r.submitted is distinct from coalesce((s.value->>'submitted')::boolean,false)) then
      raise exception 'Jefe delivery differs from canonical selection in %',area;
    end if;
    if exists(select 1 from private.jefe_report_rows_v1(array[area]) r
      join public.practicas p on p.id=r.practica_id
      where trim(coalesce(p.nota,'')) ~ '^(10|[0-9])([.,][0-9]{1,2})?$'
        and r.grade is distinct from trim(p.nota)) then
      raise exception 'Jefe grade differs from academic record in %',area;
    end if;
  end loop;
  if has_function_privilege('authenticated','private.moodle_practice_snapshot_v1(uuid)','execute')
    or has_function_privilege('anon','public.read_moodle_practice_snapshots_v1(uuid)','execute') then
    raise exception 'Canonical read permission leak';
  end if;
end $$;
select a.area,count(*) as reports,count(*) filter(where r.submitted) as submitted,
  count(*) filter(where r.report_status='pending') as pending,
  count(*) filter(where r.report_status='corrected') as corrected,
  count(*) filter(where r.report_status='waiting') as waiting,
  count(*) filter(where r.report_status='stale') as stale
from unnest(array['clinica','educacional','laboral','comunitaria']) a(area)
cross join lateral private.jefe_report_rows_v1(array[a.area]) r group by a.area;
rollback;
