alter table public.special_pps_assignments
  alter column assigned_by drop not null;

alter table public.special_pps_assignments
  drop constraint special_pps_assignments_check;

alter table public.special_pps_assignments
  add constraint special_pps_assignments_lifecycle_check check (
    (status = 'assigned' and cancelled_at is null and cancelled_by is null)
    or
    (status = 'cancelled' and cancelled_at is not null
      and nullif(btrim(cancellation_reason), '') is not null)
  );

comment on column public.special_pps_assignments.assigned_by is
  'Usuario coordinador que asignó la PPS; NULL únicamente para service_role.';
comment on column public.special_pps_assignments.cancelled_by is
  'Usuario coordinador que canceló la PPS; NULL únicamente para service_role.';
