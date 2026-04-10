-- Replace broad admin ALL policies with explicit per-operation policies.
-- This preserves behavior while making the authorization model easier to read and audit.

drop policy if exists "Admin todo convocatorias" on public.convocatorias;
create policy "Admin select convocatorias"
on public.convocatorias
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert convocatorias"
on public.convocatorias
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update convocatorias"
on public.convocatorias
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete convocatorias"
on public.convocatorias
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admin todo estudiantes" on public.estudiantes;
create policy "Admin select estudiantes"
on public.estudiantes
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert estudiantes"
on public.estudiantes
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update estudiantes"
on public.estudiantes
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete estudiantes"
on public.estudiantes
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admin todo finalizacion" on public.finalizacion_pps;
create policy "Admin select finalizacion"
on public.finalizacion_pps
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert finalizacion"
on public.finalizacion_pps
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update finalizacion"
on public.finalizacion_pps
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete finalizacion"
on public.finalizacion_pps
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admin instituciones" on public.instituciones;
create policy "Admin select instituciones"
on public.instituciones
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert instituciones"
on public.instituciones
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update instituciones"
on public.instituciones
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete instituciones"
on public.instituciones
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admin lanzamientos" on public.lanzamientos_pps;
create policy "Admin select lanzamientos"
on public.lanzamientos_pps
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert lanzamientos"
on public.lanzamientos_pps
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update lanzamientos"
on public.lanzamientos_pps
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete lanzamientos"
on public.lanzamientos_pps
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admin todo penalizaciones" on public.penalizaciones;
create policy "Admin select penalizaciones"
on public.penalizaciones
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert penalizaciones"
on public.penalizaciones
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update penalizaciones"
on public.penalizaciones
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete penalizaciones"
on public.penalizaciones
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admin todo practicas" on public.practicas;
create policy "Admin select practicas"
on public.practicas
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert practicas"
on public.practicas
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update practicas"
on public.practicas
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete practicas"
on public.practicas
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admin todo solicitudes" on public.solicitudes_pps;
create policy "Admin select solicitudes"
on public.solicitudes_pps
for select
to authenticated
using ((select public.is_admin()));
create policy "Admin insert solicitudes"
on public.solicitudes_pps
for insert
to authenticated
with check ((select public.is_admin()));
create policy "Admin update solicitudes"
on public.solicitudes_pps
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Admin delete solicitudes"
on public.solicitudes_pps
for delete
to authenticated
using ((select public.is_admin()));
