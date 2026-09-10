begin;

-- Moodle's grading table can return an abbreviated feedback preview. A report
-- label inside that preview is not sufficient to infer the complete allocation.
do $$ declare def text; anchor text; begin
  def:=pg_get_functiondef('private.plan_moodle_case_v1(uuid)'::regprocedure);
  anchor:='  select count(*) into report_mentions from regexp_matches';
  if position(anchor in def)=0 then raise exception 'Unexpected allocation planner'; end if;
  def:=replace(def,anchor,
    '  if labels>0 and coalesce(v.content->>''feedbackComment'','''') ~ ''(\.\.\.|…)[[:space:]]*$'' then'||chr(10)||
    '    return jsonb_build_object(''reason'',''incomplete_allocation_feedback''); end if;'||chr(10)||anchor);
  execute def;
end $$;

commit;
