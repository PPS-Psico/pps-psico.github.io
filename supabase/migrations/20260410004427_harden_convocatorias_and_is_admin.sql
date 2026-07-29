-- Harden convocatoria permissions without breaking current student flows.
-- Students keep the ability to create and update their own enrollment rows,
-- while unrestricted UPDATE/DELETE access for any authenticated user is removed.
-- Also fixes search_path for the is_admin() helper used by many policies.

drop policy if exists "Permitir borrar convocatorias a usuarios autenticados" on public.convocatorias;
drop policy if exists "Permitir editar todo a usuarios autenticados" on public.convocatorias;
drop policy if exists "Actualizar inscripcion propia" on public.convocatorias;

create policy "Actualizar inscripcion propia"
on public.convocatorias
for update
to authenticated
using (
  (select auth.uid()) is not null
  and estudiante_id in (
    select e.id
    from public.estudiantes e
    where e.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) is not null
  and estudiante_id in (
    select e.id
    from public.estudiantes e
    where e.user_id = (select auth.uid())
  )
);

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.estudiantes
    where user_id = (select auth.uid())
      and role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  );
end;
$$;
