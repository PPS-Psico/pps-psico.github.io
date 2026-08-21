-- Nombre canonico de las tareas dedicadas: agrega periodo y corrige el acento.
--
-- El nombre generado era `Informe final PPS · Consultorio Psicologico · Clinica`,
-- sin mes ni anio. Como una misma institucion y orientacion se relanza seguido
-- (Fundacion Tiempo 2026 la comparten 6 lanzamientos, Ministerio de Trabajo
-- 2025 cuatro), dos relanzamientos producirian tareas con el nombre IDENTICO en
-- el curso 3615. No rompe nada: la identidad la da el Numero ID, que lleva el
-- UUID del lanzamiento. Pero deja a coordinacion sin poder distinguirlas de un
-- vistazo, que es justo la confusion que "una tarea por PPS" venia a eliminar.
--
-- Tambien escribia "Clinica" sin tilde, porque usaba la clave normalizada de la
-- orientacion en lugar de su nombre legible.
--
-- El estudiante no ve este nombre: en Mi Panel ve el de la institucion. Este
-- rotulo existe para que coordinacion se organice dentro de Moodle.

create or replace function private.moodle_v2_orientation_label(p_key text)
returns text language sql immutable parallel safe set search_path = ''
as $$
  select case p_key
    when 'clinica' then 'Clínica'
    when 'laboral' then 'Laboral'
    when 'comunitaria' then 'Comunitaria'
    when 'educacional' then 'Educacional'
    when 'otra' then 'Otra'
    else initcap(coalesce(p_key, '')) end;
$$;
revoke all on function private.moodle_v2_orientation_label(text) from public, anon, authenticated;

-- Devuelve ' · ago 2026' a partir de un 'YYYY-MM-DD'. Cadena vacia si la fecha
-- no es utilizable, para no dejar un separador colgando.
create or replace function private.moodle_v2_period_suffix(p_fecha text)
returns text language sql immutable parallel safe set search_path = ''
as $$
  select case
    when coalesce(p_fecha, '') !~ '^\d{4}-\d{2}' then ''
    else ' · ' || case substring(p_fecha from 6 for 2)
      when '01' then 'ene' when '02' then 'feb' when '03' then 'mar'
      when '04' then 'abr' when '05' then 'may' when '06' then 'jun'
      when '07' then 'jul' when '08' then 'ago' when '09' then 'sep'
      when '10' then 'oct' when '11' then 'nov' when '12' then 'dic'
      else '?' end || ' ' || substring(p_fecha from 1 for 4)
  end;
$$;
revoke all on function private.moodle_v2_period_suffix(text) from public, anon, authenticated;

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'private.reconcile_moodle_task_intents_v1_impl(uuid)'::regprocedure
  ) into v_def;

  if position('moodle_v2_period_suffix' in v_def) > 0 then
    return; -- ya aplicado
  end if;

  v_new := replace(v_def,
    'initcap(v_unit.orientacion_key)) end;',
    'private.moodle_v2_orientation_label(v_unit.orientacion_key),'
    || ' private.moodle_v2_period_suffix(v_unit.fecha_inicio)) end;');

  if v_new = v_def then
    raise exception 'No se pudo parchear el nombre canonico: cambio la definicion';
  end if;

  execute v_new;
end;
$patch$;
