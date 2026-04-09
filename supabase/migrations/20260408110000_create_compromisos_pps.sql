create table if not exists public.compromisos_pps (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  convocatoria_id uuid not null references public.convocatorias(id) on delete cascade,
  lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete cascade,
  version text not null,
  estado text not null default 'aceptado',
  texto_acta text not null,
  acepta_lectura boolean not null default false,
  acepta_compromiso boolean not null default false,
  nombre_completo text not null,
  dni integer,
  legajo text not null,
  firma_texto text not null,
  accepted_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint compromisos_pps_convocatoria_unique unique (convocatoria_id)
);

create index if not exists idx_compromisos_pps_estudiante_id on public.compromisos_pps(estudiante_id);
create index if not exists idx_compromisos_pps_lanzamiento_id on public.compromisos_pps(lanzamiento_id);

create or replace function public.set_compromisos_pps_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_compromisos_pps_updated_at on public.compromisos_pps;
create trigger trg_compromisos_pps_updated_at
before update on public.compromisos_pps
for each row
execute function public.set_compromisos_pps_updated_at();

alter table public.compromisos_pps enable row level security;

drop policy if exists "compromisos_pps_select_own_or_admin" on public.compromisos_pps;
create policy "compromisos_pps_select_own_or_admin"
on public.compromisos_pps
for select
using (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = auth.uid()
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester', 'Reportero')
  )
);

drop policy if exists "compromisos_pps_insert_own_or_admin" on public.compromisos_pps;
create policy "compromisos_pps_insert_own_or_admin"
on public.compromisos_pps
for insert
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = auth.uid()
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  )
);

drop policy if exists "compromisos_pps_update_own_or_admin" on public.compromisos_pps;
create policy "compromisos_pps_update_own_or_admin"
on public.compromisos_pps
for update
using (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = auth.uid()
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  )
)
with check (
  exists (
    select 1
    from public.estudiantes e
    where e.id = compromisos_pps.estudiante_id
      and e.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.estudiantes e
    where e.user_id = auth.uid()
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  )
);
