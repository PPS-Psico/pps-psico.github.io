begin;

-- Ajustes que el sembrado automático de 20260904210000 no puede decidir solo.
-- Son nueve lanzamientos en total: tres fusiones de claves y seis "UFLO - ...".
-- Cada bloque está fundamentado; revisar antes de aplicar.

-- ------------------------------------------------- A. Fusiones de claves (3)
--
-- El sembrado deriva la unidad del prefijo antes del primer " - ". Estos tres
-- pares quedaron partidos porque el nombre usa raya larga (—) o doble espacio
-- en vez de " - ". Se delatan solos: cada par comparte un cmid, y un cmid
-- compartido entre dos unidades es imposible si son instituciones distintas.
--
-- Estas fusiones NO son cosméticas. Un cmid que queda en dos unidades se marca
-- `compartida` y la atribución por unidad lo excluye, así que dejar el par
-- partido no es "un poco peor": apaga la unidad entera para esa tarea.

-- A.1  "Fundación Tiempo" + "Fundación Tiempo de Niños"  → comparten cmid 631041
update public.lanzamientos_pps lp
set unidad_id = (select id from public.unidades_entrega where clave = 'fundación tiempo')
where lp.unidad_id = (select id from public.unidades_entrega where clave = 'fundación tiempo de niños');

-- A.2  "Centro Salud Parque Industrial" + "… — primer período 2024"  → cmid 631037
update public.lanzamientos_pps lp
set unidad_id = (select id from public.unidades_entrega where clave = 'centro salud parque industrial')
where lp.unidad_id = (select id from public.unidades_entrega where clave = 'centro salud parque industrial — primer período 2024');

-- A.3  "Fundación Sol Patagonia" + "Fundación Sol Patagonia  Crianza Respetuosa"  → cmid 301534
update public.lanzamientos_pps lp
set unidad_id = (select id from public.unidades_entrega where clave = 'fundación sol patagonia')
where lp.unidad_id = (select id from public.unidades_entrega where clave = 'fundación sol patagonia  crianza respetuosa');

-- ---------------------------------------------------------- B. UFLO (6) ----
--
-- Los "UFLO - ..." quedaron sin unidad porque el prefijo los fusionaría a los
-- seis, y son cosas distintas. Agrupación propuesta: tres unidades.
--
--   B.1 SAU          — las dos comparten institucion_id 0801a4fb y cmid 273606.
--                      Se fusionan: si quedaran separadas, 273606 caería en dos
--                      unidades, se marcaría `compartida` y SAU dejaría de
--                      atribuir. La fusión es lo que hace que SAU funcione.
--   B.2 Investigación — una unidad por lanzamiento, NO agrupadas. Los nombres
--                      sugieren un mismo proyecto pero los institucion_id son
--                      tres distintos, y no hay con qué desempatar. Medido: los
--                      tres cuelgan sólo de tareas cajón de sastre (614156 y
--                      614159), que la atribución por unidad excluye igual, así
--                      que agrupar o separar da exactamente lo mismo. Ante
--                      efecto nulo se elige la opción que no afirma una
--                      equivalencia que no se puede sostener: si mañana se les
--                      cuelga una tarea propia, agrupadas cross-atribuirían.
--   B.3 Entrevista a Profesionales — queda sola (cmid 263128 propio).

insert into public.unidades_entrega (clave, nombre, nota) values
  ('uflo sau',                              'UFLO - SAU',                                          'Alta manual: prefijo UFLO ambiguo. Fusión de los dos períodos: comparten institucion_id y cmid 273606'),
  ('uflo investigacion adultos mayores',    'UFLO - Investigación Relaciones de Pareja y Sexualidad en Adultos Mayores', 'Alta manual: separada por institucion_id propio; sólo cuelga de tareas compartidas'),
  ('uflo investigacion registros ago 2024', 'UFLO - PPS Investigación (registros agosto 2024)',    'Alta manual: separada por institucion_id propio; sólo cuelga de tareas compartidas'),
  ('uflo investigacion pareja 50-70',       'UFLO - PPS Investigación Relaciones de Pareja 50-70', 'Alta manual: separada por institucion_id propio; sólo cuelga de tareas compartidas'),
  ('uflo entrevista profesionales',         'UFLO - Entrevista a Profesionales',                   'Alta manual: prefijo UFLO ambiguo')
on conflict (clave) do nothing;

-- B.1
update public.lanzamientos_pps
set unidad_id = (select id from public.unidades_entrega where clave = 'uflo sau')
where nombre_pps in (
  'UFLO - SAU — segundo período legacy 2024',
  'UFLO - SAU/PAOS — primer período legacy 2024'
);

-- B.2  una unidad por lanzamiento
update public.lanzamientos_pps
set unidad_id = (select id from public.unidades_entrega where clave = 'uflo investigacion adultos mayores')
where nombre_pps = 'UFLO - Investigación Relaciones de Pareja y Sexualidad en Adultos Mayores';

update public.lanzamientos_pps
set unidad_id = (select id from public.unidades_entrega where clave = 'uflo investigacion registros ago 2024')
where nombre_pps = 'UFLO - PPS Investigación — registros agosto 2024';

update public.lanzamientos_pps
set unidad_id = (select id from public.unidades_entrega where clave = 'uflo investigacion pareja 50-70')
where nombre_pps = 'UFLO - PPS Investigación — Relaciones de Pareja y Sexualidad 50-70';

-- B.3
update public.lanzamientos_pps
set unidad_id = (select id from public.unidades_entrega where clave = 'uflo entrevista profesionales')
where nombre_pps = 'UFLO - Entrevista a Profesionales — convocatoria continua 2024';

-- ------------------------------------------------------- C. Reconciliación --
-- Las fusiones y las altas manuales cambian el mapa lanzamiento → unidad, así
-- que hay que rehacer las tareas de cada unidad y recalcular `compartida`.

delete from public.unidades_entrega u
where not exists (select 1 from public.lanzamientos_pps lp where lp.unidad_id = u.id);

insert into public.unidad_entrega_tareas (unidad_id, aula_entrega_id)
select distinct lp.unidad_id, lmt.aula_entrega_id
from public.lanzamientos_pps lp
join public.lanzamiento_moodle_tareas lmt
  on lmt.lanzamiento_id = lp.id
 and lmt.validation_status = 'confirmed'
where lp.unidad_id is not null
on conflict (unidad_id, aula_entrega_id) do nothing;

update public.unidad_entrega_tareas set compartida = false where compartida;

update public.unidad_entrega_tareas t
set compartida = true
where t.aula_entrega_id in (
  select aula_entrega_id
  from public.unidad_entrega_tareas
  group by aula_entrega_id
  having count(distinct unidad_id) > 1
);

commit;
