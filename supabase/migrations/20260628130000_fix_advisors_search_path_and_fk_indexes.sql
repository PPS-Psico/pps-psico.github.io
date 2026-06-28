-- Pulido de base guiado por los advisors de Supabase (security + performance).
--
-- 1) function_search_path_mutable: las 2 funciones restantes (no SECURITY DEFINER,
--    pero igual flaggeadas) reciben search_path fijo.
-- 2) unindexed_foreign_keys: se agregan indices de cobertura para 5 FKs sin indice,
--    para evitar scans en joins/cascades.
--
-- Todo idempotente y aditivo. Reversible:
--   ALTER FUNCTION ... RESET search_path;  DROP INDEX IF EXISTS ...;

ALTER FUNCTION public.safe_date_cast(val text) SET search_path = 'public';
ALTER FUNCTION public.set_gmail_hilos_updated_at() SET search_path = 'public';

CREATE INDEX IF NOT EXISTS idx_admin_action_log_actor_user_id
  ON public.admin_action_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_lanzamiento_id
  ON public.agent_suggestions (lanzamiento_id);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_resolved_by
  ON public.agent_suggestions (resolved_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contactos_institucion_id
  ON public.whatsapp_contactos (institucion_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contactos_validado_por
  ON public.whatsapp_contactos (validado_por);
