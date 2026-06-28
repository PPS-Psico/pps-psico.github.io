-- ============================================================================
-- Tabla `convenios`: modelo de convenios con renovaciones y vencimientos
-- ----------------------------------------------------------------------------
-- Antes: `instituciones.convenio_nuevo` (smallint, año) era el único registro,
-- mezclaba "convenio nuevo" (institución sin vínculo previo) con la realidad de
-- que los convenios duran ~2 años y se renuevan. No había dónde anotar
-- renovaciones ni vencimientos.
--
-- Ahora: tabla `convenios` (1 institución → N convenios) como fuente de verdad.
--   · es_renovacion = false  → primer convenio (la institución es NUEVA ese año)
--   · es_renovacion = true   → renovación de un vínculo existente
-- `instituciones.convenio_nuevo` queda como CACHE DERIVADO (= año del primer
-- convenio no-renovación), mantenido por trigger, para no reescribir las
-- lecturas existentes (get_admin_metrics_kpis, fetchConveniosList, reportes…).
--
-- Decisiones (2026-06-25): vencimiento default = firma + 24 meses; panel de
-- próximos a vencer (ver get_convenios_por_vencer). RLS admin-only vía is_admin().
-- ============================================================================

begin;

-- ── Tabla ────────────────────────────────────────────────────────────────────
create table if not exists public.convenios (
  id                uuid primary key default gen_random_uuid(),
  institucion_id    uuid not null references public.instituciones(id) on delete cascade,
  tipo              text not null default 'marco' check (tipo in ('marco', 'especifico')),
  fecha_firma       date not null,
  fecha_vencimiento date,
  es_renovacion     boolean not null default false,
  archivo_url       text,
  notas             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_convenios_institucion   on public.convenios (institucion_id);
create index if not exists idx_convenios_vencimiento    on public.convenios (fecha_vencimiento);
create index if not exists idx_convenios_firma          on public.convenios (fecha_firma);

-- ── RLS (admin-only, patrón is_admin() como el resto de tablas de gestión) ────
alter table public.convenios enable row level security;

drop policy if exists "Admin select convenios" on public.convenios;
create policy "Admin select convenios"
  on public.convenios for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin insert convenios" on public.convenios;
create policy "Admin insert convenios"
  on public.convenios for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admin update convenios" on public.convenios;
create policy "Admin update convenios"
  on public.convenios for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin delete convenios" on public.convenios;
create policy "Admin delete convenios"
  on public.convenios for delete to authenticated
  using ((select public.is_admin()));

-- ── Trigger: vencimiento default = firma + 24 meses si no se especifica ───────
create or replace function public.convenios_set_vencimiento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fecha_vencimiento is null and new.fecha_firma is not null then
    new.fecha_vencimiento := new.fecha_firma + interval '24 months';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_convenios_set_vencimiento on public.convenios;
create trigger trg_convenios_set_vencimiento
  before insert or update on public.convenios
  for each row execute function public.convenios_set_vencimiento();

-- ── Trigger: mantener instituciones.convenio_nuevo = año del primer convenio ──
-- (solo considera es_renovacion = false; NULL si la institución no tiene ninguno)
create or replace function public.convenios_sync_convenio_nuevo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_inst uuid := coalesce(new.institucion_id, old.institucion_id);
  v_year smallint;
begin
  select extract(year from min(fecha_firma))::smallint
    into v_year
    from public.convenios
   where institucion_id = v_inst
     and es_renovacion = false;

  update public.instituciones
     set convenio_nuevo = v_year
   where id = v_inst;

  return null; -- AFTER trigger
end;
$$;

drop trigger if exists trg_convenios_sync_cache on public.convenios;
create trigger trg_convenios_sync_cache
  after insert or update or delete on public.convenios
  for each row execute function public.convenios_sync_convenio_nuevo();

-- ── Backfill desde el cache plano existente ──────────────────────────────────
-- Cada institución con convenio_nuevo no nulo → 1 convenio marco, no-renovación,
-- firmado el 1-ene de ese año (no tenemos fecha exacta), vence +24 meses.
-- Idempotente: solo inserta si la institución aún no tiene convenios.
insert into public.convenios (institucion_id, tipo, fecha_firma, fecha_vencimiento, es_renovacion, notas)
select i.id,
       'marco',
       make_date(i.convenio_nuevo::int, 1, 1),
       make_date(i.convenio_nuevo::int, 1, 1) + interval '24 months',
       false,
       'Backfill automático desde instituciones.convenio_nuevo (fecha estimada 1-ene).'
from public.instituciones i
where i.convenio_nuevo is not null
  and not exists (select 1 from public.convenios c where c.institucion_id = i.id);

-- ── RPC: KPIs de convenios (renovaciones + por vencer; nuevos por coherencia) ─
drop function if exists public.get_convenios_kpis(int);
create or replace function public.get_convenios_kpis(p_year int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'nuevos_convenios', (
      -- instituciones cuyo PRIMER convenio (no-renovación) cae en el año
      select count(distinct institucion_id) from public.convenios
      where es_renovacion = false
        and extract(year from fecha_firma) = p_year
    ),
    'renovaciones', (
      select count(*) from public.convenios
      where es_renovacion = true
        and extract(year from fecha_firma) = p_year
    ),
    'convenios_por_vencer', (
      -- convenios cuyo vencimiento cae dentro de los próximos 90 días y que
      -- no fueron ya renovados (no hay convenio posterior para esa institución)
      select count(*) from public.convenios c
      where c.fecha_vencimiento is not null
        and c.fecha_vencimiento >= current_date
        and c.fecha_vencimiento <= current_date + interval '90 days'
        and not exists (
          select 1 from public.convenios c2
          where c2.institucion_id = c.institucion_id
            and c2.fecha_firma > c.fecha_firma
        )
    ),
    'target_year', p_year
  ) into result;
  return result;
end;
$$;

-- ── RPC: lista de convenios próximos a vencer (para el panel) ─────────────────
drop function if exists public.get_convenios_por_vencer(int);
create or replace function public.get_convenios_por_vencer(p_days int default 90)
returns table (
  convenio_id       uuid,
  institucion_id    uuid,
  institucion       text,
  tipo              text,
  fecha_firma       date,
  fecha_vencimiento date,
  dias_restantes    int
)
language sql
security definer
set search_path = public
as $$
  select c.id,
         c.institucion_id,
         i.nombre,
         c.tipo,
         c.fecha_firma,
         c.fecha_vencimiento,
         (c.fecha_vencimiento - current_date)::int as dias_restantes
  from public.convenios c
  join public.instituciones i on i.id = c.institucion_id
  where c.fecha_vencimiento is not null
    and c.fecha_vencimiento >= current_date
    and c.fecha_vencimiento <= current_date + (p_days || ' days')::interval
    and not exists (
      select 1 from public.convenios c2
      where c2.institucion_id = c.institucion_id
        and c2.fecha_firma > c.fecha_firma
    )
  order by c.fecha_vencimiento asc;
$$;

-- ── RPC: drill de convenios (nuevos | renovaciones) por año ──────────────────
drop function if exists public.get_convenios_list(int, text);
create or replace function public.get_convenios_list(p_year int, p_kind text)
returns table (
  nombre            text,
  tipo              text,
  fecha_firma       date,
  fecha_vencimiento date
)
language sql
security definer
set search_path = public
as $$
  select i.nombre, c.tipo, c.fecha_firma, c.fecha_vencimiento
  from public.convenios c
  join public.instituciones i on i.id = c.institucion_id
  where extract(year from c.fecha_firma) = p_year
    and (
      (p_kind = 'renovaciones' and c.es_renovacion = true) or
      (p_kind = 'nuevos' and c.es_renovacion = false and not exists (
        -- solo el primer convenio de la institución cuenta como "nuevo"
        select 1 from public.convenios c0
        where c0.institucion_id = c.institucion_id
          and c0.es_renovacion = false
          and c0.fecha_firma < c.fecha_firma
      ))
    )
  order by c.fecha_firma asc;
$$;

commit;
