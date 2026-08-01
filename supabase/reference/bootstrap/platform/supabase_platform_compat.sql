-- LOCAL-ONLY SUPABASE PLATFORM COMPATIBILITY. DO NOT DEPLOY.
-- The raw postgres image includes Auth tables and API roles, but not every
-- helper/extension normally installed by the complete Supabase platform.

-- Production installs pg_trgm in public. Reproducing it explains the 31
-- extension-owned public functions without pretending they are app objects.
create extension if not exists pg_trgm with schema public;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
      'role', nullif(current_setting('request.jwt.claim.role', true), ''),
      'email', nullif(current_setting('request.jwt.claim.email', true), '')
    ))
  );
$$;


-- Storage API helper normally installed by the Storage service migrations.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  select string_to_array(name, '/') into parts;
  return parts[1 : array_length(parts, 1) - 1];
end;
$$;


-- Minimal Storage catalog required to compile project-owned RLS policies. The
-- Storage service owns the full runtime schema; replay validates only the
-- columns and constraints referenced by this project's migrations.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

-- Platform-owned buckets that predate the canonical migration ledger. Their
-- objects are intentionally absent; replay only needs the catalog rows used by
-- storage policies and by the private-bucket migration.
insert into storage.buckets (id, name, public)
values
  ('documentos_finalizacion', 'documentos_finalizacion', false),
  ('documentos_estudiantes', 'documentos_estudiantes', true)
on conflict (id) do nothing;

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[],
  version text,
  owner_id text,
  user_metadata jsonb
);

alter table storage.objects enable row level security;
