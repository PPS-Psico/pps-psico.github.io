-- Instrumentación de decisiones y cierre de mesa de selección.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.lanzamientos_pps
  add column if not exists selection_closed_at timestamptz,
  add column if not exists selection_closed_by uuid;

alter table public.convocatorias
  add column if not exists selection_decided_at timestamptz;

comment on column public.lanzamientos_pps.selection_closed_at is
  'Instante del cierre vigente de la mesa de selección; las reaperturas quedan en el log.';
comment on column public.convocatorias.selection_decided_at is
  'Instante de la decisión vigente Seleccionado/No Seleccionado.';

create table if not exists public.selection_decision_events (
  id bigint generated always as identity primary key,
  convocatoria_id uuid references public.convocatorias(id) on delete set null,
  lanzamiento_id uuid references public.lanzamientos_pps(id) on delete set null,
  estudiante_id uuid references public.estudiantes(id) on delete set null,
  from_state text,
  to_state text not null,
  decided_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  source text not null default 'database_trigger'
);

create table if not exists public.selection_cycle_events (
  id bigint generated always as identity primary key,
  lanzamiento_id uuid references public.lanzamientos_pps(id) on delete set null,
  event_type text not null check (event_type in ('closed', 'reopened')),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  from_state text,
  to_state text
);

create index if not exists selection_decision_events_launch_idx
  on public.selection_decision_events (lanzamiento_id, decided_at desc);
create index if not exists selection_cycle_events_launch_idx
  on public.selection_cycle_events (lanzamiento_id, occurred_at desc);

alter table public.selection_decision_events enable row level security;
alter table public.selection_cycle_events enable row level security;

drop policy if exists "Staff read selection decision events"
  on public.selection_decision_events;
create policy "Staff read selection decision events"
  on public.selection_decision_events for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Staff read selection cycle events"
  on public.selection_cycle_events;
create policy "Staff read selection cycle events"
  on public.selection_cycle_events for select to authenticated
  using ((select public.is_admin()));

create or replace function private.stamp_selection_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado_inscripcion is distinct from old.estado_inscripcion
     and new.estado_inscripcion in ('Seleccionado', 'No Seleccionado') then
    new.selection_decided_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create or replace function private.log_selection_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado_inscripcion is distinct from old.estado_inscripcion
     and new.estado_inscripcion in ('Seleccionado', 'No Seleccionado') then
    insert into public.selection_decision_events (
      convocatoria_id,
      lanzamiento_id,
      estudiante_id,
      from_state,
      to_state,
      decided_at,
      actor_id
    ) values (
      new.id,
      new.lanzamiento_id,
      new.estudiante_id,
      old.estado_inscripcion,
      new.estado_inscripcion,
      coalesce(new.selection_decided_at, clock_timestamp()),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create or replace function private.log_selection_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado_convocatoria is distinct from old.estado_convocatoria then
    if new.estado_convocatoria = 'Cerrado' then
      insert into public.selection_cycle_events (
        lanzamiento_id, event_type, actor_id, from_state, to_state
      ) values (new.id, 'closed', auth.uid(), old.estado_convocatoria, new.estado_convocatoria);
    elsif old.estado_convocatoria = 'Cerrado' and new.estado_convocatoria = 'Abierta' then
      insert into public.selection_cycle_events (
        lanzamiento_id, event_type, actor_id, from_state, to_state
      ) values (new.id, 'reopened', auth.uid(), old.estado_convocatoria, new.estado_convocatoria);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.stamp_selection_decision() from public, anon, authenticated;
revoke all on function private.log_selection_decision() from public, anon, authenticated;
revoke all on function private.log_selection_cycle() from public, anon, authenticated;

drop trigger if exists stamp_selection_decision on public.convocatorias;
create trigger stamp_selection_decision
before update of estado_inscripcion on public.convocatorias
for each row execute function private.stamp_selection_decision();

drop trigger if exists log_selection_decision on public.convocatorias;
create trigger log_selection_decision
after update of estado_inscripcion on public.convocatorias
for each row execute function private.log_selection_decision();

drop trigger if exists log_selection_cycle on public.lanzamientos_pps;
create trigger log_selection_cycle
after update of estado_convocatoria on public.lanzamientos_pps
for each row execute function private.log_selection_cycle();

-- Backfill únicamente cuando existe un timestamp real. No se inventan fechas.
update public.convocatorias
set selection_decided_at = selected_at
where estado_inscripcion = 'Seleccionado'
  and selected_at is not null
  and selection_decided_at is null;

create or replace function public.close_selection(p_lanzamiento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_not_selected integer := 0;
  v_selected integer := 0;
  v_launches integer := 0;
begin
  update public.convocatorias
  set selection_decided_at = coalesce(selection_decided_at, v_now)
  where lanzamiento_id = p_lanzamiento_id
    and estado_inscripcion = 'Seleccionado';
  get diagnostics v_selected = row_count;

  update public.convocatorias
  set estado_inscripcion = 'No Seleccionado',
      selection_decided_at = v_now
  where lanzamiento_id = p_lanzamiento_id
    and estado_inscripcion = 'Inscripto';
  get diagnostics v_not_selected = row_count;

  update public.lanzamientos_pps
  set estado_convocatoria = 'Cerrado',
      estado_gestion = 'Relanzamiento Confirmado',
      selection_closed_at = v_now,
      selection_closed_by = auth.uid()
  where id = p_lanzamiento_id;
  get diagnostics v_launches = row_count;

  if v_launches <> 1 then
    raise exception 'No se pudo cerrar el lanzamiento %', p_lanzamiento_id;
  end if;

  return jsonb_build_object(
    'lanzamiento_id', p_lanzamiento_id,
    'closed_at', v_now,
    'selected', v_selected,
    'not_selected', v_not_selected
  );
end;
$$;

revoke all on function public.close_selection(uuid) from public, anon;
grant execute on function public.close_selection(uuid) to authenticated;

commit;
