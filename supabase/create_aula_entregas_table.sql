-- ============================================================================
-- Aula · Espacios de entrega de informes (tareas de Moodle)
-- ----------------------------------------------------------------------------
-- Permite a coordinación agregar/desactivar espacios de entrega SIN deploy:
-- el panel (hook useAulaEntregas) lee esta tabla y, si no existe o está
-- vacía, cae al listado embebido en el código.
--
-- Cómo usar: ejecutar este archivo una vez en el SQL Editor de Supabase.
-- Para sumar una entrega nueva: INSERT con area/institucion/moodle_id.
-- Para ocultar una: UPDATE ... SET activo = false.
-- ============================================================================

create table if not exists public.aula_entregas (
  id          bigint generated always as identity primary key,
  area        text not null check (area in ('clinica', 'laboral', 'educacional', 'comunitaria')),
  institucion text not null,
  moodle_id   text not null,
  orden       integer,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.aula_entregas is
  'Espacios de entrega de informes del Aula PPS: cada fila es una tarea de Moodle (mod/assign) por institución y área.';

-- Lectura pública (el Aula funciona también sin login para los matriculados
-- nuevos); escritura solo con service role / desde el dashboard.
alter table public.aula_entregas enable row level security;

drop policy if exists "aula_entregas_read_all" on public.aula_entregas;
create policy "aula_entregas_read_all"
  on public.aula_entregas for select
  to anon, authenticated
  using (true);

-- Seed: listado vigente al momento de integrar el Aula (jul 2026).
insert into public.aula_entregas (area, institucion, moodle_id, orden) values
  ('clinica',     'Cita Salud',            '946366',  1),
  ('clinica',     'Fundación Tiempo',      '1085731', 2),
  ('clinica',     'Dige',                  '1014110', 3),
  ('clinica',     'Ateneos Ulloa',         '926287',  4),
  ('clinica',     'Entrevistas Ulloa',     '920727',  5),
  ('clinica',     'Kano',                  '914852',  6),
  ('clinica',     'Relevamiento Prof.',    '906164',  7),
  ('clinica',     'Barriletes en Bandada', '805657',  8),
  ('clinica',     'Programa Aser',         '805658',  9),
  ('laboral',     'Randstad',              '1085736', 10),
  ('laboral',     'Human',                 '1074975', 11),
  ('laboral',     'Prevención en Colonias','1009867', 12),
  ('laboral',     'Camioneros',            '906141',  13),
  ('educacional', 'Relevamiento Prof.',    '906167',  14)
on conflict do nothing;
