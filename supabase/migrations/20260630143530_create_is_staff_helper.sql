-- is_staff(): true si el usuario logueado es personal (cualquier rol no-alumno).
-- A diferencia de is_admin(), INCLUYE 'Reportero' (que usa los dashboards de métricas).
-- SECURITY DEFINER para poder leer estudiantes saltando RLS; auth.uid() sigue
-- siendo el del usuario que llama (el claim del JWT no cambia por SECURITY DEFINER).
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.estudiantes
    where user_id = (select auth.uid())
      and role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester', 'Reportero')
  );
$function$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;
