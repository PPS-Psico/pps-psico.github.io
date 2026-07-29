-- Cierra la fuga de PII: las RPCs de métricas/listados eran SECURITY DEFINER y
-- ejecutables por `anon` (vía el grant default a PUBLIC) SIN login, devolviendo
-- nombre+legajo de alumnos. Como la anon key está en el bundle público, cualquiera
-- podía descargarlas. Revocamos PUBLIC/anon y dejamos solo authenticated + service_role.
--
-- NO se tocan las RPCs de login pre-auth (get_student_email_by_legajo,
-- get_student_for_signup, get_student_signup_status): deben seguir con anon.
--
-- Reversible: GRANT EXECUTE ... TO anon; restablece el acceso previo.

do $$
declare
  fn text;
  fns text[] := array[
    'public.get_activos_list(integer)',
    'public.get_admin_metrics_kpis(integer)',
    'public.get_consent_counts_by_launch(uuid[])',
    'public.get_convenios_kpis(integer)',
    'public.get_convenios_list(integer, text)',
    'public.get_convenios_por_vencer(integer)',
    'public.get_convocatoria_counts_by_launch(uuid[])',
    'public.get_estudiantes_en_pps_list(integer)',
    'public.get_finalizados_list(integer)',
    'public.get_haciendo_pps_list(integer)',
    'public.get_heredados_count(integer)',
    'public.get_heredados_list(integer)',
    'public.get_ingresantes_list(integer)',
    'public.get_metrics_years()',
    'public.get_postulantes_seleccionados(uuid)',
    'public.get_proximos_finalizar_list(integer)',
    'public.get_sin_pps_list(integer)',
    'public.get_seleccionados(uuid)',
    'public.get_seleccionados_for_launch(uuid)'
  ];
begin
  foreach fn in array fns loop
    execute format('revoke execute on function %s from public', fn);
    execute format('revoke execute on function %s from anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
