-- LOCAL-ONLY SCHEMA OVERLAY. DO NOT DEPLOY.
-- Reconstructs the production object created outside the migration ledger.
-- The historical seed remains in reference/legacy and is intentionally omitted.
create table public.aula_entregas (
  id bigint generated always as identity primary key,
  area text not null check (area in ('clinica', 'laboral', 'educacional', 'comunitaria')),
  institucion text not null,
  moodle_id text not null,
  orden integer,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.aula_entregas is
  'Espacios de entrega de informes del Aula PPS: cada fila es una tarea de Moodle (mod/assign) por institución y área.';
alter table public.aula_entregas enable row level security;
create policy "aula_entregas_read_all" on public.aula_entregas
  for select to anon, authenticated using (true);
create policy "Admin select aula_entregas" on public.aula_entregas
  for select to authenticated using ((select public.is_admin()));
create policy "Admin insert aula_entregas" on public.aula_entregas
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admin update aula_entregas" on public.aula_entregas
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admin delete aula_entregas" on public.aula_entregas
  for delete to authenticated using ((select public.is_admin()));
