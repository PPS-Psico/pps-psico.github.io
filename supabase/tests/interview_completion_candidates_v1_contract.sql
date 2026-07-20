-- Contrato manual para interview-completion-candidates-v1.
-- Ejecutar autenticado como personal autorizado en un entorno de prueba.

do $$
begin
  assert not exists (
    select 1
    from public.get_interview_completion_candidates_v1() as c
    where not (
      (c.horas_total >= 230 and c.horas_total < 250)
      or (c.horas_total >= 250 and c.orientaciones = 2)
      or (
        c.horas_total >= 250
        and c.orientaciones >= 3
        and c.horas_especialidad >= 50
        and c.horas_especialidad < 70
      )
    )
  ), 'cada estudiante debe cumplir al menos uno de los tres criterios';

  assert not exists (
    select 1
    from public.get_interview_completion_candidates_v1() as c
    join public.finalizacion_pps as f on f.estudiante_id = c.id
  ), 'la cohorte no debe incluir estudiantes con solicitud de finalizacion';

  assert not exists (
    select 1
    from public.get_interview_completion_candidates_v1() as c
    join public.practicas as p on p.estudiante_id = c.id
    left join public.lanzamientos_pps as l on l.id = p.lanzamiento_id
    where lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
      like '%relevamiento%profesional%'
      or lower(concat_ws(' ', coalesce(p.nombre_institucion, ''), coalesce(l.nombre_pps, '')))
        ~ 'entrevistas?[[:space:]]+a[[:space:]]+profesionales?'
  ), 'la cohorte debe excluir Relevamiento y Entrevista a Profesionales';
end;
$$;
