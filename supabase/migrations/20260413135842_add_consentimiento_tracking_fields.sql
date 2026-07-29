alter table public.convocatorias
  add column if not exists selected_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists baja_automatica_at timestamptz;