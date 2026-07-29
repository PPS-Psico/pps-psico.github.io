-- ============================================================================
-- Tablas para el agente Hermes-PPS
-- Ver docs/plan_hermes_pps.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- agent_suggestions: cosas que Hermes propone y el humano aprueba/edita/descarta
-- ----------------------------------------------------------------------------
create table if not exists public.agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'daily_brief',
    'email_draft',
    'whatsapp_followup',
    'update_estado',
    'clasificacion'
  )),
  estado text not null default 'pending' check (estado in (
    'pending',
    'approved',
    'edited',
    'discarded',
    'expired'
  )),
  payload jsonb not null,
  contexto jsonb,
  institucion_id uuid,
  lanzamiento_id uuid references public.lanzamientos_pps(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  edited_payload jsonb
);

create index if not exists idx_agent_suggestions_estado
  on public.agent_suggestions(estado)
  where estado = 'pending';
create index if not exists idx_agent_suggestions_tipo
  on public.agent_suggestions(tipo);
create index if not exists idx_agent_suggestions_institucion
  on public.agent_suggestions(institucion_id)
  where institucion_id is not null;
create index if not exists idx_agent_suggestions_created_at
  on public.agent_suggestions(created_at desc);

alter table public.agent_suggestions enable row level security;

drop policy if exists "agent_suggestions_admin_all" on public.agent_suggestions;
create policy "agent_suggestions_admin_all"
on public.agent_suggestions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- agent_audit_log: append-only. Cada tool call del agente queda registrada.
-- ----------------------------------------------------------------------------
create table if not exists public.agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  invocation_id uuid not null,
  tool text not null,
  input jsonb,
  output jsonb,
  suggestion_id uuid references public.agent_suggestions(id) on delete set null,
  duration_ms integer,
  error text
);

create index if not exists idx_agent_audit_invocation
  on public.agent_audit_log(invocation_id);
create index if not exists idx_agent_audit_timestamp
  on public.agent_audit_log(timestamp desc);
create index if not exists idx_agent_audit_suggestion
  on public.agent_audit_log(suggestion_id)
  where suggestion_id is not null;

alter table public.agent_audit_log enable row level security;

drop policy if exists "agent_audit_log_admin_select" on public.agent_audit_log;
create policy "agent_audit_log_admin_select"
on public.agent_audit_log
for select
to authenticated
using (public.is_admin());

-- Solo service role escribe (n8n / hermes-pps).
-- No hay policy de insert para authenticated: insert va por service role bypass.

-- ----------------------------------------------------------------------------
-- whatsapp_mensajes: mensajes ingestados desde backups de WhatsApp filtrados
-- ----------------------------------------------------------------------------
create table if not exists public.whatsapp_mensajes (
  id text primary key,
  chat_jid text not null,
  institucion_id uuid,
  from_me boolean not null,
  autor text,
  texto text,
  media_tipo text,
  timestamp timestamptz not null,
  raw jsonb,
  ingested_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_mensajes_chat_jid
  on public.whatsapp_mensajes(chat_jid, timestamp desc);
create index if not exists idx_whatsapp_mensajes_institucion
  on public.whatsapp_mensajes(institucion_id, timestamp desc)
  where institucion_id is not null;
create index if not exists idx_whatsapp_mensajes_timestamp
  on public.whatsapp_mensajes(timestamp desc);

alter table public.whatsapp_mensajes enable row level security;

drop policy if exists "whatsapp_mensajes_admin_select" on public.whatsapp_mensajes;
create policy "whatsapp_mensajes_admin_select"
on public.whatsapp_mensajes
for select
to authenticated
using (public.is_admin());

-- Insert/update solo por service role.

-- ----------------------------------------------------------------------------
-- gmail_hilos: hilos de Gmail PPS normalizados
-- ----------------------------------------------------------------------------
create table if not exists public.gmail_hilos (
  thread_id text primary key,
  institucion_id uuid,
  asunto text,
  participantes jsonb,
  primer_mensaje_at timestamptz,
  ultimo_mensaje_at timestamptz,
  ultimo_mensaje_de text,
  estado text not null default 'nuevo' check (estado in (
    'nuevo',
    'respondido_por_nos',
    'esperando_respuesta',
    'cerrado',
    'archivado'
  )),
  clasificacion text,
  raw_mensajes jsonb,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gmail_hilos_institucion
  on public.gmail_hilos(institucion_id, ultimo_mensaje_at desc)
  where institucion_id is not null;
create index if not exists idx_gmail_hilos_estado
  on public.gmail_hilos(estado, ultimo_mensaje_at desc);
create index if not exists idx_gmail_hilos_ultimo_mensaje
  on public.gmail_hilos(ultimo_mensaje_at desc);

create or replace function public.set_gmail_hilos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gmail_hilos_updated_at on public.gmail_hilos;
create trigger trg_gmail_hilos_updated_at
before update on public.gmail_hilos
for each row
execute function public.set_gmail_hilos_updated_at();

alter table public.gmail_hilos enable row level security;

drop policy if exists "gmail_hilos_admin_select" on public.gmail_hilos;
create policy "gmail_hilos_admin_select"
on public.gmail_hilos
for select
to authenticated
using (public.is_admin());

-- ----------------------------------------------------------------------------
-- institucion_resumen: resumen vivo por institución, mantenido por Hermes
-- ----------------------------------------------------------------------------
create table if not exists public.institucion_resumen (
  institucion_id uuid primary key,
  resumen text not null,
  ultimo_contacto_at timestamptz,
  ultimo_canal text check (ultimo_canal in ('whatsapp', 'gmail', 'panel', 'telefono', 'otro')),
  pendientes_concretos jsonb,
  actualizado_at timestamptz not null default now(),
  version_prompt text
);

create index if not exists idx_institucion_resumen_actualizado
  on public.institucion_resumen(actualizado_at desc);
create index if not exists idx_institucion_resumen_ultimo_contacto
  on public.institucion_resumen(ultimo_contacto_at desc);

alter table public.institucion_resumen enable row level security;

drop policy if exists "institucion_resumen_admin_select" on public.institucion_resumen;
create policy "institucion_resumen_admin_select"
on public.institucion_resumen
for select
to authenticated
using (public.is_admin());

-- ============================================================================
-- Notas:
-- - Las inserciones/updates en estas tablas las hace n8n o hermes-pps con
--   service role, que bypasea RLS.
-- - El panel lee con el rol authenticated, restringido a admins.
-- - Política de retención de whatsapp_mensajes: implementar como cron job
--   (Edge Function o n8n) en Fase 4.
-- ============================================================================
