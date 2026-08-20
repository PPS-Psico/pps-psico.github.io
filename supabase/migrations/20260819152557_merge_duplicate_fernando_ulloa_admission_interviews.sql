-- Consolida el registro singular duplicado en la institucion historica canonica.
-- La variante plural concentra la trayectoria de la PPS; las referencias del
-- duplicado se preservan antes de eliminarlo.

do $$
declare
  v_duplicate_id uuid;
  v_duplicate_airtable_id text;
  v_canonical_id uuid;
begin
  select id, airtable_id
    into strict v_duplicate_id, v_duplicate_airtable_id
  from public.instituciones
  where nombre = 'Institución Fernando Ulloa - Entrevista de Admisión';

  select id
    into strict v_canonical_id
  from public.instituciones
  where nombre = 'Institución Fernando Ulloa - Entrevistas de Admisión';

  perform 1
  from public.instituciones
  where id in (v_duplicate_id, v_canonical_id)
  for update;

  -- Ambos registros tenian el mismo convenio generado por backfill. Conserva
  -- una sola copia y reasigna cualquier convenio distinto que pudiera existir.
  delete from public.convenios duplicate_convenio
  where duplicate_convenio.institucion_id = v_duplicate_id
    and exists (
      select 1
      from public.convenios canonical_convenio
      where canonical_convenio.institucion_id = v_canonical_id
        and canonical_convenio.tipo = duplicate_convenio.tipo
        and canonical_convenio.fecha_firma is not distinct from duplicate_convenio.fecha_firma
        and canonical_convenio.fecha_vencimiento is not distinct from duplicate_convenio.fecha_vencimiento
        and canonical_convenio.es_renovacion = duplicate_convenio.es_renovacion
        and canonical_convenio.archivo_url is not distinct from duplicate_convenio.archivo_url
        and canonical_convenio.notas is not distinct from duplicate_convenio.notas
    );

  update public.convenios
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  update public.solicitudes_nueva_pps
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  update public.practicas
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  update public.agent_suggestions
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  update public.gmail_hilos
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  delete from public.institucion_resumen duplicate_summary
  where duplicate_summary.institucion_id = v_duplicate_id
    and exists (
      select 1
      from public.institucion_resumen canonical_summary
      where canonical_summary.institucion_id = v_canonical_id
    );

  update public.institucion_resumen
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  update public.whatsapp_contactos
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  update public.whatsapp_mensajes
  set institucion_id = v_canonical_id
  where institucion_id = v_duplicate_id;

  -- institucion_id es texto en lanzamientos_pps por compatibilidad legacy.
  update public.lanzamientos_pps
  set institucion_id = v_canonical_id::text
  where institucion_id in (v_duplicate_id::text, v_duplicate_airtable_id);

  delete from public.instituciones
  where id = v_duplicate_id;
end
$$;
