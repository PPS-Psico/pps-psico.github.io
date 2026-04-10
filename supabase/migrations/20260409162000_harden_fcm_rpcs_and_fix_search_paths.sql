-- Harden FCM RPCs exposed through the public API and fix mutable search_path
-- on app-specific security definer functions.

create or replace function public.check_fcm_token_exists(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.role()) = 'service_role' then
    return exists(
      select 1
      from public.fcm_tokens
      where user_id = uid
    );
  end if;

  if uid <> (select auth.uid()) and not public.is_admin() then
    return false;
  end if;

  return exists(
    select 1
    from public.fcm_tokens
    where user_id = uid
  );
end;
$function$;

create or replace function public.save_fcm_token(uid uuid, tok text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.role()) <> 'service_role' and uid <> (select auth.uid()) then
    return false;
  end if;

  insert into public.fcm_tokens (user_id, fcm_token)
  values (uid, tok)
  on conflict (user_id, fcm_token)
  do update set updated_at = now();

  return true;
end;
$function$;

create or replace function public.delete_fcm_token_user(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.role()) <> 'service_role' and uid <> (select auth.uid()) then
    return false;
  end if;

  delete from public.fcm_tokens
  where public.fcm_tokens.user_id = uid;

  return true;
end;
$function$;

create or replace function public.delete_fcm_token(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.fcm_tokens
  where user_id = p_user_id
    and (
      (select auth.role()) = 'service_role'
      or (select auth.uid()) = p_user_id
      or public.is_admin()
    );
end;
$function$;

create or replace function public.get_all_fcm_tokens()
returns table(fcm_token text, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'forbidden';
  end if;

  return query
  select t.fcm_token::text, t.user_id
  from public.fcm_tokens t;
end;
$function$;

revoke execute on function public.check_fcm_token_exists(uuid) from public, anon, authenticated;
revoke execute on function public.save_fcm_token(uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_fcm_token_user(uuid) from public, anon, authenticated;
revoke execute on function public.delete_fcm_token(uuid) from public, anon, authenticated;
revoke execute on function public.get_all_fcm_tokens() from public, anon, authenticated;

grant execute on function public.check_fcm_token_exists(uuid) to authenticated, service_role;
grant execute on function public.save_fcm_token(uuid, text) to authenticated, service_role;
grant execute on function public.delete_fcm_token_user(uuid) to authenticated, service_role;
grant execute on function public.delete_fcm_token(uuid) to authenticated, service_role;
grant execute on function public.get_all_fcm_tokens() to service_role;

alter function public.check_practica_updates() set search_path = 'public';
alter function public.log_practica_update() set search_path = 'public';
alter function public.get_student_for_signup(text) set search_path = 'public';
alter function public.get_student_email_by_legajo(text) set search_path = 'public';
alter function public.get_seleccionados(uuid) set search_path = 'public';
alter function public.set_compromisos_pps_updated_at() set search_path = 'public';
alter function public.update_updated_at_column() set search_path = 'public';
alter function public.update_fcm_tokens_updated_at() set search_path = 'public';
alter function public.update_push_subscriptions_updated_at() set search_path = 'public';
