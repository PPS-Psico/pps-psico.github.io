-- Motivo estructurado para analizar por qué una solicitud PPS no se concreta.

begin;

alter table public.solicitudes_pps
  add column if not exists motivo_no_concrecion text,
  add column if not exists motivo_no_concrecion_detalle text;

-- Los cierres históricos no traen motivo. Se preservan sin inventar una causa.
update public.solicitudes_pps
set motivo_no_concrecion = 'Histórico sin clasificar'
where estado_seguimiento = 'No se pudo concretar'
  and motivo_no_concrecion is null;

alter table public.solicitudes_pps
  drop constraint if exists solicitudes_pps_motivo_no_concrecion_check,
  drop constraint if exists solicitudes_pps_motivo_otro_detalle_check,
  drop constraint if exists solicitudes_pps_motivo_solo_no_concretada_check;

alter table public.solicitudes_pps
  add constraint solicitudes_pps_motivo_no_concrecion_check
    check (
      motivo_no_concrecion is null
      or motivo_no_concrecion in (
        'Institución no respondió',
        'Sin cupo disponible',
        'Convenio no viable',
        'El alumno desistió',
        'Otro',
        'Histórico sin clasificar'
      )
    ),
  add constraint solicitudes_pps_motivo_otro_detalle_check
    check (
      motivo_no_concrecion <> 'Otro'
      or nullif(btrim(motivo_no_concrecion_detalle), '') is not null
    ),
  add constraint solicitudes_pps_motivo_solo_no_concretada_check
    check (
      (estado_seguimiento = 'No se pudo concretar' and motivo_no_concrecion is not null)
      or (
        estado_seguimiento is distinct from 'No se pudo concretar'
        and motivo_no_concrecion is null
        and motivo_no_concrecion_detalle is null
      )
    );

comment on column public.solicitudes_pps.motivo_no_concrecion is
  'Motivo canónico cuando estado_seguimiento = No se pudo concretar.';
comment on column public.solicitudes_pps.motivo_no_concrecion_detalle is
  'Detalle obligatorio cuando motivo_no_concrecion = Otro.';

commit;
