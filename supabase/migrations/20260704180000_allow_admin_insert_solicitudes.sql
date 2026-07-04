-- Allow admins to insert into solicitudes_nueva_pps (simulation mode)
drop policy if exists "Users can create own new pps requests" on public.solicitudes_nueva_pps;

create policy "Users and admins can create own or student new pps requests"
on public.solicitudes_nueva_pps
for insert
to authenticated
with check (
  (select public.is_admin()) or
  exists (
    select 1
    from public.estudiantes e
    where e.id = solicitudes_nueva_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
);

-- Allow admins to insert into solicitudes_modificacion_pps (simulation mode)
drop policy if exists "Users can create own modification requests" on public.solicitudes_modificacion_pps;

create policy "Users and admins can create own or student modification requests"
on public.solicitudes_modificacion_pps
for insert
to authenticated
with check (
  (select public.is_admin()) or
  exists (
    select 1
    from public.estudiantes e
    where e.id = solicitudes_modificacion_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
);
