begin;

-- La primera carga via MCP atravesó una consola que reinterpretó UTF-8 como
-- Latin-1. Se corrigen únicamente los textos creados por esa migración.
update public.penalizaciones
set tipo_incumplimiento = 'PPS desaprobada por la institución'
where practica_id is not null
  and tipo_incumplimiento like 'PPS desaprobada por la instituci%';

update public.penalizaciones
set tipo_incumplimiento = 'Registro inválido heredado'
where estado = 'Anulada'
  and estudiante_id is null
  and tipo_incumplimiento like 'Registro inv%lido heredado';

update public.practicas
set desaprobacion_motivo_publico = convert_from(
  convert_to(desaprobacion_motivo_publico, 'LATIN1'),
  'UTF8'
)
where estado = 'Desaprobada'
  and desaprobacion_motivo_publico like '%Ã%';

update public.admin_action_log
set actor_name = case
      when actor_name is not null and actor_name like '%Ã%'
        then convert_from(convert_to(actor_name, 'LATIN1'), 'UTF8')
      else actor_name
    end,
    summary = case
      when summary like '%Ã%'
        then convert_from(convert_to(summary, 'LATIN1'), 'UTF8')
      else summary
    end,
    metadata = case
      when metadata::text like '%Ã%'
        then convert_from(convert_to(metadata::text, 'LATIN1'), 'UTF8')::jsonb
      else metadata
    end
where action_type in (
  'penalty_score_normalized',
  'pps_disapproval_backfilled',
  'pps_disapproval_registered',
  'pps_disapproval_voided'
);

drop index if exists public.uq_penalizacion_desaprobacion_activa_por_practica;
create unique index uq_penalizacion_desaprobacion_activa_por_practica
  on public.penalizaciones (practica_id)
  where estado = 'Activa'
    and tipo_incumplimiento = 'PPS desaprobada por la institución';

-- Las funciones conservan la misma firma, permisos y semántica; sólo se
-- reinterpreta el texto fuente afectado para que sus mensajes y nuevos datos
-- queden en UTF-8 real.
do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_fixed text;
begin
  foreach v_signature in array array[
    'public.proteger_desaprobacion_pps()'::regprocedure,
    'public.registrar_desaprobacion_pps(uuid,date,text[],text,text,timestamp with time zone)'::regprocedure,
    'public.anular_desaprobacion_pps(uuid,text,text)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_fixed := convert_from(convert_to(v_definition, 'LATIN1'), 'UTF8');
    execute v_fixed;
  end loop;
end;
$$;

comment on column public.practicas.desaprobacion_causas is
  'Causas canónicas: inasistencia_responsabilidad y/o falta_participacion_actitud.';
comment on column public.practicas.desaprobacion_motivo_publico is
  'Explicación visible para el estudiante. No incluir datos sensibles ni referencias internas.';
comment on function public.practica_computa(text) is
  'Regla única para horas, especialidad y rotaciones: las PPS desaprobadas o no concretadas no computan.';

commit;
