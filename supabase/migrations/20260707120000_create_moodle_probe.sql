-- SONDA (temporal): registra qué campos de perfil inyecta el Moodle real vía
-- FilterCodes cuando un estudiante entra a Mi Panel desde el campus.
-- Objetivo: decidir el diseño del alta de estudiantes nuevos sabiendo qué %
-- trae idnumber (¿legajo?), username (¿DNI?) y teléfonos.
-- Escribe SOLO la Edge Function moodle-autologin (service_role); ningún cliente
-- puede leer ni escribir. Borrar tabla + migración cuando el flujo esté decidido.

create table if not exists public.moodle_probe (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Datos crudos que llegaron del campus (ya saneados de tags sin interpolar)
  email text,
  firstname text,
  lastname text,
  idnumber text,
  username text,
  phone1 text,
  phone2 text,

  -- Análisis contra la base al momento de la entrada
  email_match boolean not null default false,     -- ¿email existe en estudiantes.correo?
  username_dni_match boolean not null default false, -- ¿username coincide con estudiantes.dni?
  idnumber_legajo_match boolean not null default false, -- ¿idnumber coincide con estudiantes.legajo?
  autologin_result text                            -- matched / not_registered / etc.
);

comment on table public.moodle_probe is
  'Sonda temporal: campos de perfil que inyecta Moodle (FilterCodes) por entrada al panel, cruzados contra estudiantes. Solo escribe la Edge Function moodle-autologin.';

alter table public.moodle_probe enable row level security;
-- Sin policies: solo service_role (que las bypasea) puede leer/escribir.

-- Evitar que la sonda crezca sin límite: índice para limpieza por fecha.
create index if not exists idx_moodle_probe_created_at on public.moodle_probe (created_at);
