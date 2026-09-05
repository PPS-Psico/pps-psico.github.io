begin;

-- La orientación se guarda como texto libre y convive escrita de dos formas:
-- "Clínica" y "Clinica". Al 05/09/2026, sobre producción:
--
--   practicas.especialidad        862 "Clínica"  ·  115 "Clinica"
--   convocatorias.orientacion    1158 "Clínica"  ·  141 "Clinica"  ·  11 "Comunitaria, Clinica"
--   lanzamientos_pps.orientacion   82 "Clínica"  ·    7 "Clinica"
--
-- QUÉ SE VERIFICÓ ANTES DE TOCAR NADA
--
-- Hoy esto NO rompe nada. Se revisaron los dos lados:
--
-- * SQL: las nueve funciones que leen orientación normalizan antes de comparar
--   (`private.jefe_orientation_key`, que quita acentos y no alfanuméricos) o
--   usan regex tolerante (`get_admin_metrics_kpis`: `~* 'cl[ií]nica'`). Las que
--   contienen el literal 'Clínica' lo producen como etiqueta canónica de
--   salida, no lo comparan.
-- * Front: `AreaBadge` normaliza con NFD + strip de diacríticos. El único mapa
--   con clave acentuada, `ORIENT_KEY` en MetricasPrimitives.tsx, tiene fallback
--   a "sindefinir" y se alimenta de un RPC que ya devuelve la forma canónica.
--
-- Entonces esto no arregla una falla: cierra una trampa. Cada consumidor nuevo
-- —SQL o TS— tiene que acordarse hoy de normalizar, y el día que uno se olvide
-- va a perder 274 filas en silencio, que es exactamente la clase de error que
-- venimos persiguiendo toda la noche. Se arregla en la capa de datos, que
-- inmuniza a todos los consumidores a la vez y no obliga a tocar ninguno.
--
-- Deliberadamente NO se agrega un CHECK: la columna admite combinaciones
-- ("Clínica, Laboral") y valores fuera del set ("Mixta", "A elección",
-- "No informada") que son legítimos. Un CHECK rechazaría escrituras válidas.
-- La canonicalización normaliza lo que reconoce y deja pasar lo que no.
--
-- `aula_entregas.area` queda afuera a propósito: usa otro vocabulario, en
-- minúsculas y sin acentos ('clinica', 'laboral', 'educacional').

create or replace function public.canonical_orientacion_label(p_value text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select case
    when p_value is null then null
    when btrim(p_value) = '' then p_value
    else (
      select string_agg(u.etiqueta, ', ' order by u.orden)
      from (
        select distinct on (tokens.etiqueta) tokens.etiqueta, tokens.orden
        from (
          select
            case regexp_replace(
                   translate(lower(btrim(t.tok)), 'áéíóúüñ', 'aeiouun'),
                   '[^a-z0-9]+', '', 'g'
                 )
              when 'clinica'     then 'Clínica'
              when 'educacional' then 'Educacional'
              when 'laboral'     then 'Laboral'
              when 'comunitaria' then 'Comunitaria'
              else btrim(t.tok)
            end as etiqueta,
            t.ord as orden
          from unnest(string_to_array(p_value, ',')) with ordinality as t(tok, ord)
          where btrim(t.tok) <> ''
        ) tokens
        order by tokens.etiqueta, tokens.orden
      ) u
    )
  end;
$function$;

comment on function public.canonical_orientacion_label(text) is
  'Devuelve la orientación en su forma canónica acentuada. Respeta el orden original, deduplica, y deja intacto todo token que no reconoce.';

-- Backfill. Verificado en seco: de los 15 valores distintos que existen hoy
-- sólo cambian dos ("Clinica" y "Comunitaria, Clinica"); los 13 restantes,
-- combinaciones y valores sueltos incluidos, quedan idénticos.
update public.practicas
set especialidad = public.canonical_orientacion_label(especialidad)
where especialidad is distinct from public.canonical_orientacion_label(especialidad);

update public.lanzamientos_pps
set orientacion = public.canonical_orientacion_label(orientacion)
where orientacion is distinct from public.canonical_orientacion_label(orientacion);

update public.convocatorias
set orientacion = public.canonical_orientacion_label(orientacion)
where orientacion is distinct from public.canonical_orientacion_label(orientacion);

-- Y que se mantenga así sin depender de que cada escritor se acuerde.
create or replace function public.canonicalizar_orientacion_tg()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_table_name = 'practicas' then
    new.especialidad := public.canonical_orientacion_label(new.especialidad);
  else
    new.orientacion := public.canonical_orientacion_label(new.orientacion);
  end if;
  return new;
end;
$function$;

drop trigger if exists canonicalizar_orientacion on public.practicas;
create trigger canonicalizar_orientacion
before insert or update of especialidad on public.practicas
for each row execute function public.canonicalizar_orientacion_tg();

drop trigger if exists canonicalizar_orientacion on public.lanzamientos_pps;
create trigger canonicalizar_orientacion
before insert or update of orientacion on public.lanzamientos_pps
for each row execute function public.canonicalizar_orientacion_tg();

drop trigger if exists canonicalizar_orientacion on public.convocatorias;
create trigger canonicalizar_orientacion
before insert or update of orientacion on public.convocatorias
for each row execute function public.canonicalizar_orientacion_tg();

commit;
