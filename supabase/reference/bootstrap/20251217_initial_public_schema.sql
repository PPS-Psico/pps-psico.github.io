-- LOCAL-ONLY BOOTSTRAP REFERENCE. DO NOT DEPLOY OR APPLY TO HOSTED ENVIRONMENTS.
-- Reconstructs the minimum public schema immediately before migration
-- 20260104152920 so the canonical history can be replayed on an empty local
-- Supabase PostgreSQL 17 instance. It intentionally contains no data, PII,
-- secrets, RLS policies, grants, cron jobs, or post-baseline objects.

-- Extensions required by baseline defaults/functions or by later canonical
-- migrations. Creating the extensions does not create any scheduled jobs.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_net with schema public;
create extension if not exists pg_cron with schema pg_catalog;

create table public.estudiantes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  legajo text unique,
  nombre text,
  nombre_separado text,
  apellido_separado text,
  genero text,
  orientacion_elegida text,
  dni numeric,
  fecha_nacimiento text,
  correo text,
  telefono text,
  notas_internas text,
  fecha_finalizacion text,
  estado text default 'Inactivo',
  role text default 'Alumno',
  must_change_password boolean default true,
  user_id uuid,
  trabaja boolean default false,
  certificado_trabajo text,
  constraint estudiantes_user_id_fkey
    foreign key (user_id) references auth.users (id)
);

create table public.instituciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  nombre text,
  direccion text,
  telefono text,
  convenio_nuevo text,
  tutor text,
  codigo_tarjeta_campus text,
  orientaciones text
);


create table public.lanzamientos_pps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  nombre_pps text,
  fecha_inicio text,
  fecha_finalizacion text,
  direccion text,
  horario_seleccionado text,
  orientacion text,
  horas_acreditadas numeric,
  cupos_disponibles numeric,
  estado_convocatoria text,
  plazo_inscripcion_dias numeric,
  informe text,
  estado_gestion text,
  notas_gestion text,
  fecha_relanzamiento text,
  permite_certificado boolean,
  plantilla_seguro_url text,
  req_certificado_trabajo boolean default true,
  req_cv boolean default false,
  codigo_tarjeta_campus text
);

create table public.convocatorias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  lanzamiento_id uuid,
  estudiante_id uuid,
  estado_inscripcion text default 'Inscripto',
  termino_cursar text,
  cursando_electivas text,
  finales_adeuda text,
  otra_situacion_academica text,
  informe_subido boolean,
  fecha_entrega_informe text,
  horario_seleccionado text,
  certificado_url jsonb,
  correo text,
  telefono text,
  dni numeric,
  fecha_nacimiento text,
  direccion text,
  nombre_pps text,
  fecha_inicio text,
  fecha_finalizacion text,
  orientacion text,
  horas_acreditadas numeric,
  legajo numeric,
  trabaja boolean default false,
  certificado_trabajo text,
  cv_url text,
  constraint convocatorias_lanzamiento_id_fkey
    foreign key (lanzamiento_id) references public.lanzamientos_pps (id),
  constraint convocatorias_estudiante_id_fkey
    foreign key (estudiante_id) references public.estudiantes (id)
);

create table public.practicas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  estudiante_id uuid,
  lanzamiento_id uuid,
  horas_realizadas numeric,
  fecha_inicio text,
  fecha_finalizacion text,
  estado text,
  especialidad text,
  nota text,
  nombre_institucion text,
  constraint practicas_estudiante_id_fkey
    foreign key (estudiante_id) references public.estudiantes (id),
  constraint practicas_lanzamiento_id_fkey
    foreign key (lanzamiento_id) references public.lanzamientos_pps (id)
);


create table public.penalizaciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  estudiante_id uuid,
  tipo_incumplimiento text,
  fecha_incidente text,
  notas text,
  puntaje_penalizacion numeric,
  convocatoria_afectada text,
  constraint penalizaciones_estudiante_id_fkey
    foreign key (estudiante_id) references public.estudiantes (id)
);

create table public.finalizacion_pps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  estudiante_id uuid,
  fecha_solicitud text,
  estado text,
  informe_final_url jsonb,
  planilla_horas_url jsonb,
  planilla_asistencia_url jsonb,
  certificado_url jsonb,
  sugerencias_mejoras text,
  constraint finalizacion_pps_estudiante_id_fkey
    foreign key (estudiante_id) references public.estudiantes (id)
);

create table public.solicitudes_pps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  airtable_id text unique,
  estudiante_id uuid,
  nombre_institucion text,
  estado_seguimiento text,
  actualizacion text,
  notas text,
  nombre_alumno text,
  legajo text,
  email text,
  localidad text,
  direccion_completa text,
  email_institucion text,
  telefono_institucion text,
  referente_institucion text,
  convenio_uflo text,
  tutor_disponible text,
  contacto_tutor text,
  tipo_practica text,
  descripcion_institucion text,
  orientacion_sugerida text,
  constraint fk_solicitud_estudiante
    foreign key (estudiante_id) references public.estudiantes (id)
);

create table public.app_config (
  id bigint generated by default as identity primary key,
  horas_objetivo_total numeric not null default 250,
  horas_objetivo_orientacion numeric not null default 70,
  rotacion_objetivo numeric not null default 3,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.email_templates (
  id text primary key,
  subject text not null,
  body text not null,
  is_active boolean default true,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text
);

create table public.debug_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  msg text,
  data jsonb
);

-- This pre-existing Web Push table is intentionally the 2025 shape. The
-- canonical history evolves and then removes it before creating fcm_tokens.
create table public.push_subscriptions (
  id bigint generated by default as identity primary key,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade
);


-- Base helpers referenced by ALTER FUNCTION, policies, or later compatibility
-- migrations before any canonical migration creates a replacement.
create function public.auth_email()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'email';
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.estudiantes as e
    where e.user_id = auth.uid()
      and e.role in ('SuperUser', 'Jefe', 'Directivo', 'AdminTester')
  );
$$;

create function public.get_my_role()
returns text
language sql
stable
security definer
as $$
  select e.role
  from public.estudiantes as e
  where e.user_id = auth.uid()
  limit 1;
$$;

create function public.mark_password_changed()
returns void
language sql
security definer
as $$
  update public.estudiantes
  set must_change_password = false
  where user_id = auth.uid();
$$;

create function public.admin_reset_password(
  legajo_input text,
  new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_user_id uuid;
begin
  select e.user_id
  into target_user_id
  from public.estudiantes as e
  where e.legajo = legajo_input
  limit 1;

  if target_user_id is null then
    raise exception 'Student account not found';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;
end;
$$;

create function public.get_student_details_by_legajo(legajo_input text)
returns table (
  id uuid,
  nombre text,
  legajo text,
  dni numeric,
  correo text,
  telefono text,
  user_id uuid,
  must_change_password boolean,
  role text
)
language sql
stable
security definer
as $$
  select e.id, e.nombre, e.legajo, e.dni, e.correo, e.telefono,
         e.user_id, e.must_change_password, e.role
  from public.estudiantes as e
  where e.legajo = legajo_input;
$$;

create function public.get_student_email_by_legajo(legajo_input text)
returns json
language sql
stable
security definer
as $$
  select json_build_object('email', e.correo)
  from public.estudiantes as e
  where e.legajo = legajo_input
  limit 1;
$$;


create function public.get_student_for_signup(legajo_input text)
returns table (
  id uuid,
  legajo text,
  nombre text,
  nombre_separado text,
  apellido_separado text,
  dni numeric,
  correo text,
  telefono text,
  user_id uuid
)
language sql
stable
security definer
as $$
  select e.id, e.legajo, e.nombre, e.nombre_separado, e.apellido_separado,
         e.dni, e.correo, e.telefono, e.user_id
  from public.estudiantes as e
  where e.legajo = legajo_input;
$$;

create function public.safe_date_cast(val text)
returns timestamptz
language sql
immutable
as $$
  select case
    when val is null or val = '' then null
    when val ~ '^\d{4}-\d{2}-\d{2}' then (val || 'T00:00:00Z')::timestamptz
    else null
  end;
$$;

create function public.get_dashboard_metrics(target_year integer)
returns jsonb
language sql
stable
security definer
as $$
  select jsonb_build_object('year', target_year);
$$;

create function public.get_seleccionados(lanzamiento_id_input uuid)
returns table (nombre text, legajo text, horario text)
language sql
stable
security definer
as $$
  select e.nombre, e.legajo, c.horario_seleccionado
  from public.convocatorias as c
  join public.estudiantes as e on e.id = c.estudiante_id
  where c.lanzamiento_id = lanzamiento_id_input
    and c.estado_inscripcion = 'Seleccionado';
$$;

create function public.handle_seleccion_alumno()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.estado_inscripcion = 'Seleccionado'
     and old.estado_inscripcion is distinct from 'Seleccionado' then
    insert into public.practicas (
      estudiante_id,
      lanzamiento_id,
      horas_realizadas,
      fecha_inicio,
      fecha_finalizacion,
      estado,
      especialidad,
      nombre_institucion
    )
    select new.estudiante_id, l.id, l.horas_acreditadas, l.fecha_inicio,
           l.fecha_finalizacion, 'En curso', l.orientacion, l.nombre_pps
    from public.lanzamientos_pps as l
    where l.id = new.lanzamiento_id;
  elsif old.estado_inscripcion = 'Seleccionado'
        and new.estado_inscripcion is distinct from 'Seleccionado' then
    delete from public.practicas
    where estudiante_id = new.estudiante_id
      AND lanzamiento_id = NEW.lanzamiento_id;
  end if;

  return new;
end;
$$;

create function public.log_practica_update()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.debug_logs (msg, data)
  values (
    'practicas update',
    jsonb_build_object('practica_id', new.id, 'operation', tg_op)
  );
  return new;
end;
$$;

create function public.update_push_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Required compatibility object: three canonical July migrations explicitly
-- disable this pre-existing trigger by name. No other baseline triggers are
-- included because they are not required to replay the canonical history.
create trigger trg_debug_practica
after update on public.practicas
for each row
execute function public.log_practica_update();


-- Pre-existing selection trigger, still present in production and referenced
-- by the May 2026 state-normalization overlay. Its creation predates the
-- canonical migration ledger.
create trigger trigger_gestion_automatica_practicas
after update of estado_inscripcion on public.convocatorias
for each row
execute function public.handle_seleccion_alumno();


-- Pre-existing legacy selection RPC. Its runtime usage is present in the
-- December 2025 baseline commit; later canonical migrations harden and wrap it.
create function public.get_postulantes_seleccionados(lanzamiento_uuid uuid)
returns table(nombre text, legajo text, horario text)
language plpgsql
security definer
as $$
begin
  return query
  select
    e.nombre,
    coalesce(e.legajo::text, c.legajo::text, '---') as legajo,
    coalesce(c.horario_seleccionado, 'No especificado') as horario
  from public.convocatorias c
  join public.estudiantes e on c.estudiante_id = e.id
  where c.lanzamiento_id = lanzamiento_uuid
    and (
      c.estado_inscripcion ilike '%Seleccionado%'
      or c.estado_inscripcion ilike '%Asignado%'
      or c.estado_inscripcion ilike '%Confirmado%'
    );
end;
$$;


-- Pre-ledger policies verified in production. Later canonical migrations
-- preserve these objects, so the empty replay must supply their initial state.
create policy "Enable read access for all users"
on public.app_config for select to public using (true);
create policy "Leer instituciones"
on public.instituciones for select to public using (true);
create policy "Leer lanzamientos"
on public.lanzamientos_pps for select to public using (true);

create policy "Admins gestionan todo storage"
on storage.objects for all to authenticated
using (public.is_admin());

create policy "Alumnos suben sus propios archivos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos_finalizacion'
  and (storage.foldername(name))[1] in (
    select e.id::text from public.estudiantes e where e.user_id = auth.uid()
  )
);

create policy "Alumnos ven sus propios archivos"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos_finalizacion'
  and (storage.foldername(name))[1] in (
    select e.id::text from public.estudiantes e where e.user_id = auth.uid()
  )
);
