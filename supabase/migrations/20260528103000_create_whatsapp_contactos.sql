-- ============================================================================
-- Tabla whatsapp_contactos: contactos clasificados para el agente Hermes-PPS
-- ============================================================================

create table if not exists public.whatsapp_contactos (
  chat_jid text primary key, -- ej: "5491140123456@s.whatsapp.net"
  phone text, -- número normalizado sin @s.whatsapp.net
  nombre_contacto text, -- nombre del contacto o autor
  tipo text not null check (tipo in (
    'autoridad_uflo',
    'institucion_con_convenio',
    'sin_convenio',
    'coordinador_externo',
    'otro'
  )),
  institucion_id uuid references public.instituciones(id) on delete set null,
  confidence numeric check (confidence >= 0 and confidence <= 1), -- confianza asignada
  clasificado_por text not null check (clasificado_por in ('hermes', 'blas', 'manual')),
  validado_por uuid references auth.users(id) on delete set null,
  validado_at timestamptz,
  last_seen_at timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.whatsapp_contactos enable row level security;

-- Policies: solo admins pueden realizar operaciones
drop policy if exists "whatsapp_contactos_admin_all" on public.whatsapp_contactos;
create policy "whatsapp_contactos_admin_all"
on public.whatsapp_contactos
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
