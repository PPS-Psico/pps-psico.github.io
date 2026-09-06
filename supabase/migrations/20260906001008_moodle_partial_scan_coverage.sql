begin;
-- A partial table scan preserves its rows but must not certify full coverage.
do $patch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('private.capture_jefe_moodle_evidence_v1(uuid,uuid,bigint,integer,timestamptz,bigint,text,jsonb)'::regprocedure) into v_def;
  v_new := replace(v_def,
    'v_task->>''status'',jsonb_array_length(v_task->''rows''),',
    'case when nullif(v_task->>''errorCode'','''') is not null then ''parse_error'' else v_task->>''status'' end,jsonb_array_length(v_task->''rows''),');
  if v_new=v_def then raise exception 'Coverage status anchor missing'; end if;
  v_new := replace(v_new,'v_task->>''status''=''ok'' then 0 else 1 end',
    'v_task->>''status''=''ok'' and nullif(v_task->>''errorCode'','''') is null then 0 else 1 end');
  v_new := replace(v_new,'v_task->>''status''=''ok'' then interval ''1 day''',
    'v_task->>''status''=''ok'' and nullif(v_task->>''errorCode'','''') is null then interval ''1 day''');
  execute v_new;
end $patch$;
commit;
