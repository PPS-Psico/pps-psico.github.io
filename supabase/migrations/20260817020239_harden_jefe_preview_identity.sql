-- Endurece la simulacion: el cliente deja de conocer los DNI y usa claves
-- opacas listadas por un RPC protegido. Tambien elimina la excepcion por email:
-- el permiso depende exclusivamente del rol persistido en estudiantes.

alter table private.jefe_area_assignments
  add column if not exists preview_key uuid;

update private.jefe_area_assignments
set preview_key = case dni
  when 13842270 then 'c2b55b28-b9c3-4f8e-bb51-73a77832fb28'::uuid
  when 34052382 then '8e2fa1f0-1c3a-47de-8702-66c561f90b4c'::uuid
  when 26777403 then 'a7734b26-8f30-4a54-9cff-802e4d3b6137'::uuid
end
where preview_key is null;

alter table private.jefe_area_assignments
  alter column preview_key set not null;

create index if not exists jefe_area_assignments_preview_key_idx
  on private.jefe_area_assignments (preview_key);

comment on column private.jefe_area_assignments.preview_key is
  'Identificador opaco usado por la simulacion administrativa; evita publicar el DNI en el cliente.';

create or replace function private.require_jefe_preview_access_v1()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.estudiantes e
    where e.user_id = auth.uid()
      and e.role in ('SuperUser', 'AdminTester')
  ) then
    raise exception 'Testing administrator role required' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.list_jefe_preview_profiles_v1_impl()
returns table(
  preview_key uuid,
  name text,
  area_labels text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_jefe_preview_access_v1();

  return query
  with assigned as (
    select
      a.preview_key,
      a.dni,
      array_agg(a.area_label order by a.sort_order, a.area_label) as area_labels,
      min(a.sort_order) as first_sort
    from private.jefe_area_assignments a
    group by a.preview_key, a.dni
  )
  select
    a.preview_key,
    coalesce(nullif(trim(e.nombre), ''), 'Jefatura') as name,
    a.area_labels
  from assigned a
  cross join lateral (
    select candidate.nombre
    from public.estudiantes candidate
    where candidate.dni::bigint = a.dni
    order by (candidate.role = 'Jefe') desc, candidate.created_at desc nulls last
    limit 1
  ) e
  order by a.first_sort, name;
end;
$$;

create or replace function private.get_jefe_dashboard_preview_v2_impl(
  p_preview_key uuid,
  p_year integer,
  p_cutoff date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dni bigint;
  v_areas text[];
  v_dni_count integer;
begin
  perform private.require_jefe_preview_access_v1();

  select
    min(a.dni),
    count(distinct a.dni)::integer,
    array_agg(a.area_key order by a.sort_order, a.area_key)
  into v_dni, v_dni_count, v_areas
  from private.jefe_area_assignments a
  where a.preview_key = p_preview_key;

  if v_dni is null or v_dni_count <> 1 or coalesce(cardinality(v_areas), 0) = 0 then
    raise exception 'Unknown jefe preview identity' using errcode = '22023';
  end if;

  return private.build_jefe_dashboard_v1(v_dni, v_areas, p_year, p_cutoff);
end;
$$;

create or replace function public.list_jefe_preview_profiles_v1()
returns table(
  preview_key uuid,
  name text,
  area_labels text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_jefe_preview_profiles_v1_impl();
$$;

create or replace function public.get_jefe_dashboard_preview_v2(
  p_preview_key uuid,
  p_year integer,
  p_cutoff date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_jefe_dashboard_preview_v2_impl(p_preview_key, p_year, p_cutoff);
$$;

-- Retirar el contrato v1 basado en DNI del rol cliente. Se conserva la
-- funcion para compatibilidad de migraciones, pero queda sin permiso API.
revoke execute on function public.get_jefe_dashboard_preview_v1(bigint, integer, date)
  from authenticated;
revoke execute on function private.get_jefe_dashboard_preview_v1_impl(bigint, integer, date)
  from authenticated;

revoke all on function private.list_jefe_preview_profiles_v1_impl()
  from public, anon, authenticated;
revoke all on function private.get_jefe_dashboard_preview_v2_impl(uuid, integer, date)
  from public, anon, authenticated;
revoke all on function public.list_jefe_preview_profiles_v1()
  from public, anon;
revoke all on function public.get_jefe_dashboard_preview_v2(uuid, integer, date)
  from public, anon;

grant execute on function private.list_jefe_preview_profiles_v1_impl()
  to authenticated;
grant execute on function private.get_jefe_dashboard_preview_v2_impl(uuid, integer, date)
  to authenticated;
grant execute on function public.list_jefe_preview_profiles_v1()
  to authenticated;
grant execute on function public.get_jefe_dashboard_preview_v2(uuid, integer, date)
  to authenticated;

comment on function public.list_jefe_preview_profiles_v1() is
  'Lista protegida de jefaturas disponibles para simulacion, sin exponer DNI.';
comment on function public.get_jefe_dashboard_preview_v2(uuid, integer, date) is
  'Vista previa solo lectura por identificador opaco. Exclusiva para SuperUser/AdminTester.';
