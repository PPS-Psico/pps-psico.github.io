-- Allow students to hard-delete only their own enrollment rows.
-- This is required for cancellation flows that must fully remove the row
-- so the enrollment disappears from downstream admin selectors.

drop policy if exists "Borrar inscripcion propia" on public.convocatorias;

create policy "Borrar inscripcion propia"
on public.convocatorias
for delete
to authenticated
using (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);
