-- Arregla dos comparaciones que ninguna tarea dedicada podia ganar. Ambas se
-- descubrieron en la primera creacion real (Consultorio Psicologico, cmid
-- 1222866): la tarea quedo bien creada en Moodle pero la intencion no pudo
-- verificarse nunca.
--
-- 1. SEGUNDOS IMPOSIBLES. desired_due_at se calcula con time '23:59:59', pero
--    el selector de fecha de Moodle solo tiene hora y minuto: lo guardado
--    siempre cae en :00 segundos. El hash exigia igualdad exacta, asi que la
--    comparacion era irreconciliable por construccion.
--
-- 2. DESCRIPCION QUE NADIE DECLARA. El hash deseado se calcula pasando
--    description_html = null, porque la reconciliacion nunca escribe
--    desired_description_html: la portada HTML se genera en el script JS del
--    worker, no en la base. Del otro lado, lo observado siempre llega como
--    texto. null contra texto no coincide jamas.
--
--    No se resuelve escribiendo la plantilla en PL/pgSQL. Se resuelve
--    aceptando que la descripcion NO es parte de la identidad verificable: es
--    cosmetica, y su version intencional ya viaja aparte en
--    description_template_version, que si entra al hash. Un cambio deliberado
--    de plantilla sigue disparando reconciliacion; que un docente retoque un
--    parrafo, no.
--
-- Se conserva la firma para que los dos llamadores queden consistentes sin
-- tocarlos: p_description_html se recibe y se ignora a proposito.
--
-- Los timestamps entran al hash como minutos de epoch. extract(epoch) es
-- inmutable y no depende de TimeZone, a diferencia de date_trunc sobre
-- timestamptz, que es apenas estable y no corresponde dentro de una funcion
-- declarada immutable.
--
-- Efecto sobre lo existente: cambia el desired_config_hash de las 212
-- intenciones legacy en la proxima reconciliacion, pero no las altera, porque
-- la regla de on-conflict fija provisioning_status = 'verified' para
-- legacy_shared sin mirar el hash. No hay ninguna intencion dedicada verificada
-- todavia, asi que no se degrada nada.

create or replace function private.moodle_v2_config_hash(
  p_stable_key text, p_name text, p_description_html text,
  p_open_at timestamptz, p_due_at timestamptz, p_cutoff_at timestamptz,
  p_grade_mode text, p_grade_max numeric, p_section_key text,
  p_visibility text, p_template_version text
)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select md5(jsonb_build_object(
    'stable_key', p_stable_key,
    'name', p_name,
    -- description_html se ignora deliberadamente: la portada la genera el
    -- worker y no la declara la base. La intencion viaja en template_version.
    'open_minute', floor(extract(epoch from p_open_at) / 60),
    'due_minute', floor(extract(epoch from p_due_at) / 60),
    'cutoff_minute', floor(extract(epoch from p_cutoff_at) / 60),
    'grade_mode', p_grade_mode,
    'grade_max', p_grade_max,
    'section_key', p_section_key,
    'visibility', p_visibility,
    'template_version', p_template_version
  )::text);
$$;

comment on function private.moodle_v2_config_hash(
  text, text, text, timestamptz, timestamptz, timestamptz,
  text, numeric, text, text, text
) is
  'Huella de la configuracion material de una tarea. Los instantes se comparan al minuto porque Moodle no guarda segundos. La descripcion no participa: su intencion viaja en template_version.';
