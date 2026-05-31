-- ============================================================================
-- RPCs de conteo agregado — evitan traer miles de filas al cliente
-- ----------------------------------------------------------------------------
-- Problema que resuelven: varias vistas (Lanzador) traían TODAS las filas de
-- convocatorias/compromisos al navegador para contarlas en JS. Con 2.000+
-- convocatorias eso pega contra el límite de 1000 filas de PostgREST y obliga
-- a paginar a mano. Estas funciones cuentan en la base (rápido, sin truncado)
-- y devuelven un JSON liviano keyed por lanzamiento_id.
--
-- Patrón: SECURITY DEFINER + search_path fijo (igual que metrics_rpcs.sql).
-- ============================================================================

-- ── Conteo de inscriptos / seleccionados por lanzamiento ────────────────────
-- Devuelve: { "<lanzamiento_id>": { "inscriptos": N, "seleccionados": M }, ... }
-- El conteo de seleccionados normaliza el casing (lower) por robustez, aunque
-- el CHECK constraint ya garantiza 'Seleccionado' canónico.
drop function if exists public.get_convocatoria_counts_by_launch(uuid[]);
create or replace function public.get_convocatoria_counts_by_launch(p_launch_ids uuid[])
returns json
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    json_object_agg(
      lanzamiento_id,
      json_build_object('inscriptos', inscriptos, 'seleccionados', seleccionados)
    ),
    '{}'::json
  )
  from (
    select
      lanzamiento_id,
      count(*) as inscriptos,
      count(*) filter (where lower(estado_inscripcion) = 'seleccionado') as seleccionados
    from convocatorias
    where lanzamiento_id = any(p_launch_ids)
    group by lanzamiento_id
  ) sub;
$$;

-- ── Conteo de consentimientos (compromisos) por lanzamiento ─────────────────
-- Devuelve: { "<lanzamiento_id>": { "aceptados": N, "total": M }, ... }
drop function if exists public.get_consent_counts_by_launch(uuid[]);
create or replace function public.get_consent_counts_by_launch(p_launch_ids uuid[])
returns json
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    json_object_agg(
      lanzamiento_id,
      json_build_object('aceptados', aceptados, 'total', total)
    ),
    '{}'::json
  )
  from (
    select
      lanzamiento_id,
      count(*) as total,
      count(*) filter (where lower(estado) = 'aceptado') as aceptados
    from compromisos_pps
    where lanzamiento_id = any(p_launch_ids)
    group by lanzamiento_id
  ) sub;
$$;

-- Permisos: accesibles por usuarios autenticados (admin usa estas vistas).
grant execute on function public.get_convocatoria_counts_by_launch(uuid[]) to authenticated, anon, service_role;
grant execute on function public.get_consent_counts_by_launch(uuid[]) to authenticated, anon, service_role;
