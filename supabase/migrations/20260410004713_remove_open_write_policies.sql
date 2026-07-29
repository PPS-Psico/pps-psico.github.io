-- Remove overly broad write policies from tables whose real product usage is
-- either admin-only or already covered by ownership-based rules.

drop policy if exists "Permitir borrar estudiantes a usuarios autenticados" on public.estudiantes;
drop policy if exists "Permitir editar todo a usuarios autenticados" on public.estudiantes;

drop policy if exists "Permitir borrar instituciones a usuarios autenticados" on public.instituciones;
drop policy if exists "Permitir editar todo a usuarios autenticados" on public.instituciones;

drop policy if exists "Permitir borrar lanzamientos a usuarios autenticados" on public.lanzamientos_pps;
drop policy if exists "Permitir editar todo a usuarios autenticados" on public.lanzamientos_pps;

drop policy if exists "Permitir borrar penalizaciones a usuarios autenticados" on public.penalizaciones;
