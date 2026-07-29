-- Endurecimiento: fijar search_path en funciones SECURITY DEFINER que quedaron
-- sin el set explicito (advertencia function_search_path_mutable de Supabase).
--
-- Estas RPCs de metricas/listas se crearon sin `SET search_path`, lo que las hace
-- vulnerables a search_path hijacking al correr con privilegios del owner. Se fija
-- a 'public' (referencian tablas de public sin calificar; preserva el comportamiento).
--
-- Funciones afectadas (detectadas dinamicamente): get_activos_list,
-- get_admin_metrics_kpis, get_finalizados_list, get_metrics_years,
-- get_proximos_finalizar_list, get_sin_pps_list.
--
-- Idempotente: solo toca funciones SECURITY DEFINER de public que aun no tienen
-- search_path fijado. No modifica el cuerpo de las funciones.
--
-- ROLLBACK (manual, si hiciera falta):
--   ALTER FUNCTION public.<nombre>(<args>) RESET search_path;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''public''', r.proname, r.args);
  END LOOP;
END $$;
