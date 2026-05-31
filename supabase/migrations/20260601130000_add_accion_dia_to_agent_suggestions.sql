-- ============================================================================
-- Migración: agregar 'accion_dia' al CHECK de agent_suggestions.tipo
-- ============================================================================
-- Contexto:
--   El endpoint /tasks/plan_today del agente Hermes genera el tablero
--   "Hoy con Hermes" insertando filas con tipo='accion_dia'. Pero el CHECK
--   constraint original (migración 20260526120000) NO incluía ese valor, así
--   que TODOS los INSERT fallaban con:
--     new row ... violates check constraint "agent_suggestions_tipo_check"
--   Resultado: el tablero siempre quedaba vacío ("Todo al día") aunque hubiera
--   gestiones reales (40 correos esperando, 10 solicitudes estancadas, etc.).
--
-- Esta migración recrea el constraint incluyendo 'accion_dia'.
-- Idempotente: dropea el constraint previo si existe y lo vuelve a crear.
-- ============================================================================

alter table public.agent_suggestions
  drop constraint if exists agent_suggestions_tipo_check;

alter table public.agent_suggestions
  add constraint agent_suggestions_tipo_check check (tipo in (
    'daily_brief',
    'email_draft',
    'whatsapp_followup',
    'update_estado',
    'clasificacion',
    'accion_dia'
  ));

comment on constraint agent_suggestions_tipo_check on public.agent_suggestions is
  'Tipos válidos de sugerencia del agente. accion_dia = item del tablero "Hoy con Hermes" (plan_today).';
