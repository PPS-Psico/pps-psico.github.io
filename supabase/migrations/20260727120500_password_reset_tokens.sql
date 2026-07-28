-- Recuperación de contraseña por enlace de un solo uso al correo registrado.
--
-- Reemplaza a `reset_student_password_verified`, que verificaba identidad con
-- PII ESTÁTICA (legajo + DNI + correo + teléfono) y reescribía directamente
-- auth.users.encrypted_password. Esos cuatro datos no son secretos, no cambian
-- nunca, y hasta el cierre de `convocatorias` eran cosechables anónimamente: se
-- verificó que alcanzaban para tomar 256 cuentas.
--
-- El modelo nuevo verifica CONTROL DEL CANAL, no conocimiento de datos: sólo
-- quien puede leer el correo registrado completa el cambio.
--
-- El token nunca se guarda en claro: se almacena su SHA-256. Si alguien lee
-- esta tabla, no puede reconstruir ningún enlace válido.

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  user_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_lookup
  on public.password_reset_tokens (token_hash) where used_at is null;

create index if not exists idx_password_reset_tokens_estudiante
  on public.password_reset_tokens (estudiante_id, created_at desc);

alter table public.password_reset_tokens enable row level security;

-- Sin políticas y sin grants: sólo el service_role de las Edge Functions la usa.
-- Ningún cliente, ni anónimo ni autenticado, debe poder mirarla.
revoke all on table public.password_reset_tokens from anon, authenticated, public;
grant all on table public.password_reset_tokens to service_role;

comment on table public.password_reset_tokens is
  'Tokens de un solo uso para recuperar contraseña. Se guarda sólo el SHA-256 del token; expiran a la hora.';

-- Se retira del alcance público la recuperación por PII estática.
revoke execute on function public.reset_student_password_verified(text, bigint, text, text, text)
  from anon, authenticated, public;
