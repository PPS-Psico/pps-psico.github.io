begin;

-- 13 grupos parecían prácticas duplicadas. Al revisarlos, sólo 7 lo son de
-- verdad -- 9 filas fantasma de 7 alumnos -- y el resto son otra cosa:
--
--   - 5 grupos ("UFLO - Jornadas de Salud Mental", importados el
--     2024-08-15T23:18:41) NO son duplicados: son una jornada de un día que
--     acredita horas en varias orientaciones a la vez, cargada como una fila
--     por área. Se dejan intactos.
--   - "12345 Prueba" / "Centro terapéutico Mirarte" es una cuenta de prueba,
--     no un alumno real.
--
-- Confirmado con Blas: desde 2025 una PPS no se puede repetir, así que las 7
-- reales -- todas de 2025 en adelante -- son error de carga, no una segunda
-- inscripción legítima. Se investigó la causa de cada una antes de tocarla:
--
--   - Laila Aedo (Centro SENSUS) y Parra Candela Dolores (ACUCADES): la misma
--     práctica quedó como 2-3 registros de Airtable distintos (`airtable_id`
--     diferente en cada fila), cargados con minutos u horas de diferencia.
--   - Correa, Rezzónico y Suste (Dige Espacio Terapéutico, mismo lanzamiento):
--     una fila viene de Airtable y la otra se creó directo desde la app, dos
--     caminos de carga corriendo en paralelo sobre el mismo lanzamiento entre
--     el 25 y el 29 de noviembre de 2025.
--   - García (Sanatorio Juan XXIII) y Linares Lara (Barriletes): la fila
--     original nace con la práctica y meses después alguien vuelve a cargarla
--     a mano desde el panel sin ver que ya existía (4 y 13 meses después).
--
-- La causa raíz es una: nada en `practicas` impide crear dos filas idénticas
-- para el mismo alumno + institución + fechas + horas, ni la sincronización
-- de Airtable ni la carga manual chequean si ya existe una antes de insertar.
--
-- Por cada grupo se conserva la fila con más evidencia real (más lecturas de
-- Moodle, o la que ya tiene nota) y se reasignan sus `moodle_grade_observations`
-- antes de borrar la sobrante -- son lecturas históricas de Moodle, no se
-- descartan. Los snapshots y las filas de `moodle_task_expected_participants`
-- de la fila sobrante se dejan caer por cascada: la que se conserva ya tiene
-- las suyas propias para el mismo cmid, conservar las dos violaría su propia
-- clave primaria.
--
-- Un octavo caso -- Linares Lara -- queda fuera de este parche a propósito:
-- sus dos filas apuntan al lanzamiento de Barriletes de 2024, pero sus fechas
-- reales (jul-oct 2025) coinciden mejor con un lanzamiento de 2025 que existe
-- con el mismo nombre. Su convocatoria también apunta al de 2024, así que no
-- es un error de tipeo obvio, y no hay ninguna entrega de Moodle observada
-- que confirme cuál es el vínculo real. Se desduplica su par de filas nada
-- más -- eso sí es inequívoco -- y el vínculo de lanzamiento queda para
-- decidir con más información.

with pares as (
  select * from (values
    ('edaaa90b-1f30-4143-9f38-53319514dc82'::uuid, array['04b6e91c-a5c0-4340-9c79-f31befe65727','8e617d5b-3b00-42a3-8fdf-234e6045d536']::uuid[]), -- Correa María Josefina
    ('18840f7f-963d-4955-aaa4-b6f685c544b9'::uuid, array['6fd6b0fd-480c-42d8-9200-87b9f5812189']::uuid[]),                                          -- Lucrecia Rezzónico
    ('668aebcb-693a-48e5-88a4-491cca2174bd'::uuid, array['2d1e9a03-af82-47cd-b763-49e4ca749b9c']::uuid[]),                                          -- Mara Suste
    ('d2fba419-7a9b-49d1-841f-9b97aea4e666'::uuid, array['eee2b66b-cd33-4efe-8440-ed37f0a56c34','3441fbc1-ed89-4e15-8a1f-dac37f0fd059']::uuid[]),   -- Laila Aedo
    ('7e093e69-2bd6-4799-b290-91fa962fc57c'::uuid, array['3fdf2b47-cfe9-4d86-b218-a30b1d40ff69']::uuid[]),                                          -- Parra Candela Dolores
    ('7229f15c-3fb6-4e8a-a13a-65a57b5b3844'::uuid, array['bbd62582-389f-48e2-9aa6-28c7fa15b8d4']::uuid[]),                                          -- Linares Lara (sólo dedupe, no relink)
    ('c37e069b-fa4f-46a9-b275-649b819a9f1b'::uuid, array['b7b4c24e-2b1d-4c90-974c-201bc0871bfb']::uuid[])                                           -- María Agustina Garcia
  ) as t(survivor, losers)
), reasignadas as (
  update public.moodle_grade_observations o
  set practica_id = p.survivor
  from pares p
  where o.practica_id = any(p.losers)
    and not exists (
      select 1 from public.moodle_grade_observations keep
      where keep.practica_id = p.survivor
        and keep.request_id = o.request_id
        and keep.cmid = o.cmid
    )
  returning o.id
)
select
  (select count(*) from reasignadas) as observaciones_reasignadas;

delete from public.practicas
where id in (
  select unnest(losers) from (values
    (array['04b6e91c-a5c0-4340-9c79-f31befe65727','8e617d5b-3b00-42a3-8fdf-234e6045d536']::uuid[]),
    (array['6fd6b0fd-480c-42d8-9200-87b9f5812189']::uuid[]),
    (array['2d1e9a03-af82-47cd-b763-49e4ca749b9c']::uuid[]),
    (array['eee2b66b-cd33-4efe-8440-ed37f0a56c34','3441fbc1-ed89-4e15-8a1f-dac37f0fd059']::uuid[]),
    (array['3fdf2b47-cfe9-4d86-b218-a30b1d40ff69']::uuid[]),
    (array['bbd62582-389f-48e2-9aa6-28c7fa15b8d4']::uuid[]),
    (array['b7b4c24e-2b1d-4c90-974c-201bc0871bfb']::uuid[])
  ) as t(losers)
);

commit;
