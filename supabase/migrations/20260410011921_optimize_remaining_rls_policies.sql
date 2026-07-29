-- Tighten remaining legacy admin checks and optimize student-facing RLS policies.

-- backup_history: use the central admin helper instead of JWT role text checks.
drop policy if exists "Allow admin read backup_history" on public.backup_history;
drop policy if exists "Allow admin insert backup_history" on public.backup_history;
drop policy if exists "Allow admin delete backup_history" on public.backup_history;

create policy "Allow admin read backup_history"
on public.backup_history
for select
to authenticated
using ((select public.is_admin()));

create policy "Allow admin insert backup_history"
on public.backup_history
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Allow admin delete backup_history"
on public.backup_history
for delete
to authenticated
using ((select public.is_admin()));

-- fcm_tokens: keep self-service token management, but use authenticated role
-- and trusted admin detection.
drop policy if exists "Admins can view all tokens" on public.fcm_tokens;
drop policy if exists "Users can view own tokens" on public.fcm_tokens;
drop policy if exists "Users can insert own tokens" on public.fcm_tokens;
drop policy if exists "Users can update own tokens" on public.fcm_tokens;
drop policy if exists "Users can delete own tokens" on public.fcm_tokens;

create policy "Admins can view all tokens"
on public.fcm_tokens
for select
to authenticated
using ((select public.is_admin()));

create policy "Users can view own tokens"
on public.fcm_tokens
for select
to authenticated
using (((select auth.uid()) = user_id));

create policy "Users can insert own tokens"
on public.fcm_tokens
for insert
to authenticated
with check (((select auth.uid()) = user_id));

create policy "Users can update own tokens"
on public.fcm_tokens
for update
to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

create policy "Users can delete own tokens"
on public.fcm_tokens
for delete
to authenticated
using (((select auth.uid()) = user_id));

-- convocatorias: authenticated ownership policies plus wrapped auth helper.
drop policy if exists "Crear inscripcion propia" on public.convocatorias;
drop policy if exists "Ver inscripciones propias" on public.convocatorias;
drop policy if exists "Ver seleccionados publicos" on public.convocatorias;

create policy "Crear inscripcion propia"
on public.convocatorias
for insert
to authenticated
with check (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);

create policy "Ver inscripciones propias"
on public.convocatorias
for select
to authenticated
using (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);

create policy "Ver seleccionados publicos"
on public.convocatorias
for select
to public
using (
  estado_inscripcion ilike '%Seleccionado%'
  or estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);

-- finalizacion_pps: authenticated ownership policies plus wrapped auth helper.
drop policy if exists "Crear finalizacion propia" on public.finalizacion_pps;
drop policy if exists "Ver finalizacion propia" on public.finalizacion_pps;

create policy "Crear finalizacion propia"
on public.finalizacion_pps
for insert
to authenticated
with check (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);

create policy "Ver finalizacion propia"
on public.finalizacion_pps
for select
to authenticated
using (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);

-- penalizaciones: authenticated ownership policy plus wrapped auth helper.
drop policy if exists "Ver penalizaciones propias" on public.penalizaciones;

create policy "Ver penalizaciones propias"
on public.penalizaciones
for select
to authenticated
using (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);

-- practicas: remove the duplicate select policy and keep the wrapped version.
drop policy if exists "Estudiante ver propias" on public.practicas;

-- solicitudes_modificacion_pps: authenticated role and wrapped auth helper.
drop policy if exists "Admins can view all modification requests" on public.solicitudes_modificacion_pps;
drop policy if exists "Admins can update all modification requests" on public.solicitudes_modificacion_pps;
drop policy if exists "Users can create own modification requests" on public.solicitudes_modificacion_pps;
drop policy if exists "Users can view own modification requests" on public.solicitudes_modificacion_pps;

create policy "Admins can view all modification requests"
on public.solicitudes_modificacion_pps
for select
to authenticated
using ((select public.is_admin()));

create policy "Admins can update all modification requests"
on public.solicitudes_modificacion_pps
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Users can create own modification requests"
on public.solicitudes_modificacion_pps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.id = solicitudes_modificacion_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
);

create policy "Users can view own modification requests"
on public.solicitudes_modificacion_pps
for select
to authenticated
using (
  exists (
    select 1
    from public.estudiantes e
    where e.id = solicitudes_modificacion_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
);

-- solicitudes_nueva_pps: authenticated role and wrapped auth helper.
drop policy if exists "Admins can view all new pps requests" on public.solicitudes_nueva_pps;
drop policy if exists "Admins can update all new pps requests" on public.solicitudes_nueva_pps;
drop policy if exists "Users can create own new pps requests" on public.solicitudes_nueva_pps;
drop policy if exists "Users can view own new pps requests" on public.solicitudes_nueva_pps;

create policy "Admins can view all new pps requests"
on public.solicitudes_nueva_pps
for select
to authenticated
using ((select public.is_admin()));

create policy "Admins can update all new pps requests"
on public.solicitudes_nueva_pps
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Users can create own new pps requests"
on public.solicitudes_nueva_pps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.id = solicitudes_nueva_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
);

create policy "Users can view own new pps requests"
on public.solicitudes_nueva_pps
for select
to authenticated
using (
  exists (
    select 1
    from public.estudiantes e
    where e.id = solicitudes_nueva_pps.estudiante_id
      and e.user_id = (select auth.uid())
  )
);

-- solicitudes_pps: keep self-service actions, but wrap auth helper consistently.
drop policy if exists "Usuarios pueden borrar sus propias solicitudes" on public.solicitudes_pps;
drop policy if exists "Usuarios pueden editar sus propias solicitudes" on public.solicitudes_pps;

create policy "Usuarios pueden borrar sus propias solicitudes"
on public.solicitudes_pps
for delete
to authenticated
using (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);

create policy "Usuarios pueden editar sus propias solicitudes"
on public.solicitudes_pps
for update
to authenticated
using (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
)
with check (
  estudiante_id in (
    select estudiantes.id
    from public.estudiantes
    where estudiantes.user_id = (select auth.uid())
  )
);
