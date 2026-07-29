-- ============================================================================
-- instituciones.convenio_nuevo: text → smallint (año)
-- ----------------------------------------------------------------------------
-- Antes: columna text mezclando 'false'/'2024'/'2025'/NULL (y el código manejaba
-- 'Legacy'/'true' que NO existían en los datos reales).
-- Ahora: smallint nullable. NULL = sin convenio nuevo · 2024/2025/… = año.
--
-- Coordinado con cambios de código (mismo commit):
--   · EditorInstituciones.tsx  (select de años + guardado numérico)
--   · NuevosConvenios.tsx       (ya escribía número)
--   · metricsLists.ts           (.eq con número)
--   · metricsCalculations.ts    (comparación String() robusta a ambos tipos)
--   · RPCs get_admin_metrics_kpis y get_dashboard_metrics (ver nota abajo)
--
-- NOTA RPCs: get_admin_metrics_kpis comparaba `convenio_nuevo = p_year::text` y
-- get_dashboard_metrics usaba `convenio_nuevo is true` (¡inconsistente, asumía
-- booleano!). Ambas se reparan a `convenio_nuevo = p_year` mediante el script
-- de aplicación (scratch/run-convenio-migration.mjs), que parchea el cuerpo
-- vivo de cada función para no transcribir 15k de SQL a mano.
--
-- Esta parte (columna + constraint) es la determinística y queda versionada.
-- ============================================================================

begin;

-- Normalizar: 'false'/'no'/'' → NULL (no son año de convenio)
update instituciones set convenio_nuevo = null
 where convenio_nuevo is not null
   and lower(btrim(convenio_nuevo)) in ('false', 'no', 'legacy', 'true', '');

-- Validación defensiva: lo que quede debe ser un año de 4 dígitos
do $$
declare bad int;
begin
  select count(*) into bad from instituciones
   where convenio_nuevo is not null and convenio_nuevo !~ '^[0-9]{4}$';
  if bad > 0 then
    raise exception 'convenio_nuevo: % valores no-año sin normalizar', bad;
  end if;
end $$;

-- Cambio de tipo
alter table instituciones
  alter column convenio_nuevo type smallint
  using (case when convenio_nuevo ~ '^[0-9]{4}$' then convenio_nuevo::smallint else null end);

-- Rango válido
alter table instituciones
  drop constraint if exists instituciones_convenio_nuevo_check;
alter table instituciones
  add  constraint instituciones_convenio_nuevo_check
  check (convenio_nuevo is null or (convenio_nuevo between 2000 and 2100));

commit;
