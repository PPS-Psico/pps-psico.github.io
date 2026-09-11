-- Paso 2 de 3 hacia la FK de lanzamientos_pps.institucion_id.
--
-- El paso 1 dejo institucion_uuid con la FK, llena y sincronizada. Este migra
-- los lectores que todavia tratan la institucion del lanzamiento como texto:
--
--   · las que validan con regex si "parece" un uuid y recien ahi castean
--     (get_management_report_v1_impl, eximir_consentimiento,
--      seleccionar_convocatoria_opcion, seleccionar_convocatoria_opcion_horario);
--   · las que joinean con `i.id::text = l.institucion_id`
--     (jefe_annual_offers_v1, jefe_report_rows_v1);
--   · las que comparan la institucion de una practica contra la del lanzamiento
--     (inscribir_convocatoria_multiopcion y su v2);
--   · y un conteo en get_analytics_v1.
--
-- Toda esa maquinaria de regex existe solo porque la columna es texto y podia
-- contener cualquier cosa. Con la FK ya no hace falta: se reemplaza por la
-- columna uuid, que es lo mismo pero garantizado.
--
-- Se parchea con pg_get_functiondef + regexp_replace, que es el patron que ya usa
-- este repo, en vez de retipear nueve cuerpos a mano. Cada funcion se recrea solo
-- si el parche la cambio, y al final se verifica que no quede ninguna referencia
-- vieja: si algo no coincidio, esto falla en vez de dejar el trabajo a medias.
--
-- Los alias se limitan a los que son lanzamientos (l, v_launch, previous_launch).
-- `p.institucion_id` es de practicas y no se toca.

do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_tocadas int := 0;
begin
  for v_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and p.prosrc like '%lanzamientos_pps%'
      and p.prosrc like '%institucion_id%'
  loop
    v_def := pg_get_functiondef(v_oid);
    v_new := v_def;

    -- 1. case when <alias>.institucion_id ~* '<regex uuid>' then ...::uuid else null end
    v_new := regexp_replace(
      v_new,
      'case\s+when\s+([a-z_]+)\.institucion_id\s*~\*\s*''[^'']*''\s*then\s+\1\.institucion_id::uuid\s+else\s+null\s+end',
      '\1.institucion_uuid',
      'gi');

    -- 2. i.id::text = coalesce(p.institucion_id::text, l.institucion_id)
    v_new := regexp_replace(
      v_new,
      '([a-z_]+)\.id::text\s*=\s*coalesce\(([a-z_]+)\.institucion_id::text,\s*([a-z_]+)\.institucion_id\)',
      '\1.id = coalesce(\2.institucion_id, \3.institucion_uuid)',
      'gi');

    -- 3. i.id::text = l.institucion_id
    v_new := regexp_replace(
      v_new,
      '([a-z_]+)\.id::text\s*=\s*(l|v_launch|previous_launch)\.institucion_id\M',
      '\1.id = \2.institucion_uuid',
      'gi');

    -- 4. p.institucion_id::text = v_launch.institucion_id
    v_new := regexp_replace(
      v_new,
      '([a-z_]+)\.institucion_id::text\s*=\s*(l|v_launch|previous_launch)\.institucion_id\M',
      '\1.institucion_id = \2.institucion_uuid',
      'gi');

    -- 5. lo que quede de los alias que son lanzamientos
    v_new := regexp_replace(
      v_new,
      '\m(l|v_launch|previous_launch)\.institucion_id\M',
      '\1.institucion_uuid',
      'gi');

    if v_new <> v_def then
      execute v_new;
      v_tocadas := v_tocadas + 1;
    end if;
  end loop;

  raise notice 'funciones migradas a institucion_uuid: %', v_tocadas;
end;
$$;

-- Verificacion: que no quede ninguna funcion leyendo la institucion del
-- lanzamiento por la columna de texto.
do $$
declare v_restantes text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ')
  into v_restantes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog', 'information_schema')
    and p.prosrc like '%lanzamientos_pps%'
    and (p.prosrc ~* '(l|v_launch|previous_launch)\.institucion_id\M'
      or p.prosrc ~* 'institucion_id\s*~\*');

  if v_restantes is not null then
    raise exception 'Quedaron funciones leyendo institucion_id como texto: %', v_restantes;
  end if;
end;
$$;
